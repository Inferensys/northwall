"use client";

import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useMissionStore } from "@/store/mission-store";
import { createClient } from "@/lib/supabase/client";
import { authFetch } from "@/lib/api";
import type { Mission, ChatMessage, SDKEnvelope } from "@northwall/shared";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";
const DEV_BYPASS = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";

export function useSocket(missionId: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const {
    setMission,
    addEvent,
    addEvents,
    addChatMessage,
    setConnected,
    startTimer,
    stopTimer,
    appendExplorationToken,
    addExplorationActivity,
    setReadinessScore,
    clearExplorationStream,
    addSDKMessage,
    addSDKMessages,
    addCredentialRequest,
  } = useMissionStore();

  useEffect(() => {
    if (!missionId) return;

    let cancelled = false;

    async function connect() {
      let token: string | undefined;

      if (!DEV_BYPASS) {
        // Get auth token for socket connection
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        token = session?.access_token;
      }

      if (cancelled) return;

      const socket = io(BACKEND_URL, {
        transports: ["websocket"],
        auth: DEV_BYPASS ? { devBypass: true } : { token },
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        setConnected(true);
        socket.emit("join_mission", missionId);
      });

      socket.on("disconnect", () => {
        setConnected(false);
      });

      socket.on("mission_state", (mission: Mission) => {
        setMission(mission);

        // Start/stop timer based on mission status
        if (mission.status === "running") {
          startTimer();
        } else if (mission.status === "completed" || mission.status === "failed") {
          stopTimer();
        }
      });

      socket.on("events_batch", (events) => {
        addEvents(events);
      });

      socket.on("event", (event) => {
        // Handle exploration streaming events
        if (event.type === "exploration_token") {
          appendExplorationToken(event.summary);
          return;
        }
        if (event.type === "exploration_activity") {
          addExplorationActivity({
            summary: event.summary,
            tool: (event.data as Record<string, unknown>)?.tool as string | undefined,
            timestamp: event.timestamp,
          });
          return;
        }
        if (event.type === "exploration_done") {
          const data = event.data as Record<string, unknown> | undefined;
          if (data?.readiness != null) {
            setReadinessScore(data.readiness as number);
          }
          // Don't clear stream here — page.tsx will finalize
          return;
        }

        // Handle credential request events from container
        if (event.type === "credential_request") {
          const data = event.data as Record<string, unknown> | undefined;
          if (data) {
            addCredentialRequest({
              id: (data.id as string) ?? event.id,
              platform: (data.platform as string) ?? "unknown",
              type: (data.type as "password" | "oauth" | "otp" | "api_key") ?? "password",
              context: data.context as string | undefined,
              timestamp: event.timestamp,
            });
          }
        }

        addEvent(event);
      });

      // Raw SDK message relay (execution phase)
      socket.on("sdk_message", (envelope: SDKEnvelope) => {
        addSDKMessage(envelope);
      });

      socket.on("sdk_messages_batch", (envelopes: SDKEnvelope[]) => {
        addSDKMessages(envelopes);
      });

      socket.on("error", (err: { message?: string } | string) => {
        const message = typeof err === "string" ? err : err.message ?? "Unknown error";
        console.error("Socket error:", message);

        addEvent({
          id: `evt-err-${Date.now()}`,
          sessionId: missionId!,
          type: "session_error",
          summary: message,
          timestamp: Date.now(),
        });
      });
    }

    connect();

    return () => {
      cancelled = true;
      if (socketRef.current) {
        socketRef.current.emit("leave_mission", missionId);
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [missionId, setMission, addEvent, addEvents, addChatMessage, setConnected, startTimer, stopTimer, appendExplorationToken, addExplorationActivity, setReadinessScore, clearExplorationStream, addSDKMessage, addSDKMessages, addCredentialRequest]);

  // Hydrate mission data from REST immediately on mount (don't wait for WS connect)
  useEffect(() => {
    if (!missionId) return;

    // Fetch mission state
    authFetch(`/api/missions/${missionId}`)
      .then((res) => res.json())
      .then((data) => {
        const mission = data.mission as Mission | undefined;
        if (mission && !useMissionStore.getState().mission) {
          setMission(mission);
          if (mission.status === "running") startTimer();
        }
      })
      .catch(() => {});

    // Fetch events history
    authFetch(`/api/missions/${missionId}/events`)
      .then((res) => res.json())
      .then((data) => {
        const events = data.events ?? [];
        if (events.length > 0 && useMissionStore.getState().events.length === 0) {
          addEvents(events);
        }
      })
      .catch(() => {});

    // Fetch chat history
    authFetch(`/api/missions/${missionId}/chat`)
      .then((res) => res.json())
      .then((data) => {
        const messages = (data.chat ?? []) as ChatMessage[];
        const existing = useMissionStore.getState().chatMessages;
        if (existing.length === 0 && messages.length > 0) {
          for (const msg of messages) {
            addChatMessage(msg);
          }
        }
      })
      .catch(() => {});

    // Fetch SDK messages (for execution phase replay)
    authFetch(`/api/missions/${missionId}/sdk-messages`)
      .then((res) => res.json())
      .then((data) => {
        const msgs = data.sdkMessages ?? [];
        if (msgs.length > 0 && useMissionStore.getState().sdkMessages.length === 0) {
          addSDKMessages(msgs);
        }
      })
      .catch(() => {});
  }, [missionId, setMission, addEvents, addChatMessage, addSDKMessages, startTimer]);

  const sendMessage = useCallback(
    (content: string) => {
      if (!socketRef.current || !missionId) return;
      socketRef.current.emit("send_message", { missionId, content });
    },
    [missionId]
  );

  const sendCredential = useCallback(
    (requestId: string, credentials: Record<string, string>) => {
      if (!socketRef.current || !missionId) return;
      socketRef.current.emit("credential_provided", {
        missionId,
        requestId,
        credentials,
      });
    },
    [missionId]
  );

  return { sendMessage, sendCredential };
}
