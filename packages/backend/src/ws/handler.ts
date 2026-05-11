import type { Server as SocketServer } from "socket.io";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { AssessmentManager } from "../services/assessment-manager.js";
import type { MissionManager } from "../services/mission-manager.js";

let _wsJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getWsJWKS() {
  const url = process.env.SUPABASE_URL;
  if (!url) return null;
  if (!_wsJwks) {
    _wsJwks = createRemoteJWKSet(new URL(`${url}/auth/v1/.well-known/jwks.json`));
  }
  return _wsJwks;
}

async function verifyToken(token: string): Promise<string | null> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const jwks = getWsJWKS();
  if (!jwks || !supabaseUrl) return null;
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `${supabaseUrl}/auth/v1`,
      audience: "authenticated",
    });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

/**
 * WebSocket handler — real-time event streaming to the frontend.
 *
 * Clients join a mission room and receive all events in real-time.
 */
export function setupWebSocket(
  io: SocketServer,
  missionManager?: MissionManager,
  assessmentManager?: AssessmentManager,
): void {
  // Authenticate socket connections
  io.use(async (socket, next) => {
    // Dev-mode auth bypass
    if (process.env.DEV_AUTH_BYPASS === "true") {
      (socket.data as Record<string, unknown>).userId = "dev-user-001";
      return next();
    }

    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      return next(new Error("Authentication required"));
    }

    const userId = await verifyToken(token);
    if (!userId) {
      return next(new Error("Invalid token"));
    }

    (socket.data as Record<string, unknown>).userId = userId;
    next();
  });

  io.on("connection", (socket) => {
    const userId = (socket.data as Record<string, unknown>).userId as string;
    console.log(`Client connected: ${socket.id} (user: ${userId})`);
    let unsubscribe: (() => void) | null = null;
    let unsubscribeSDK: (() => void) | null = null;
    let unsubscribeAssessment: (() => void) | null = null;

    // Join a mission room (supports both new and legacy event names)
    const handleJoin = (missionId: string) => {
      if (!missionManager) {
        socket.emit("error", { message: "Mission runtime is not enabled" });
        return;
      }

      // Verify mission ownership
      const missionUserId = missionManager.getMissionUserId(missionId);
      if (missionUserId && missionUserId !== userId) {
        socket.emit("error", { message: "Forbidden" });
        return;
      }

      // Leave previous mission
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      if (unsubscribeSDK) {
        unsubscribeSDK();
        unsubscribeSDK = null;
      }

      socket.join(missionId);
      console.log(`Client ${socket.id} joined mission ${missionId}`);

      // Send current mission state
      const mission = missionManager.getMission(missionId);
      if (mission) {
        socket.emit("mission_state", mission);
      }

      // Send all events (for restored sessions too)
      const events = missionManager.getEvents(missionId);
      if (events.length > 0) {
        socket.emit("events_batch", events);
      }

      // Subscribe to live events
      unsubscribe = missionManager.subscribe(missionId, (event) => {
        socket.emit("event", event);

        // Push updated mission state on lifecycle transitions
        if (
          event.type === "session_started" ||
          event.type === "session_completed" ||
          event.type === "session_error" ||
          event.type === "mission_planned" ||
          event.type === "agent_working" ||
          event.type === "agent_completed" ||
          event.type === "task_status_changed" ||
          event.type === "container_creating" ||
          event.type === "container_running" ||
          event.type === "container_stopped" ||
          event.type === "container_error" ||
          event.type === "credential_request"
        ) {
          const updated = missionManager.getMission(missionId);
          if (updated) {
            socket.emit("mission_state", updated);
          }
        }
      });

      // Send historical SDK messages for replay
      const sdkMessages = missionManager.getSDKMessages(missionId);
      if (sdkMessages.length > 0) {
        socket.emit("sdk_messages_batch", sdkMessages);
      }

      // Subscribe to live SDK message relay
      unsubscribeSDK = missionManager.subscribeSDK(missionId, (envelope) => {
        socket.emit("sdk_message", envelope);
      });
    };

    socket.on("join_mission", handleJoin);
    socket.on("join_session", handleJoin); // backwards compat

    socket.on("join_assessment", (assessmentId: string) => {
      if (!assessmentManager) return;
      const assessmentUserId = assessmentManager.getAssessmentUserId(assessmentId);
      if (assessmentUserId && assessmentUserId !== userId) {
        socket.emit("error", { message: "Forbidden" });
        return;
      }

      if (unsubscribeAssessment) {
        unsubscribeAssessment();
        unsubscribeAssessment = null;
      }

      socket.join(assessmentId);
      const assessment = assessmentManager.getAssessment(assessmentId);
      if (assessment) socket.emit("assessment_state", assessment);
      const events = assessmentManager.getEvents(assessmentId);
      if (events.length > 0) socket.emit("assessment_events_batch", events);

      unsubscribeAssessment = assessmentManager.subscribe(assessmentId, (event) => {
        socket.emit("assessment_event", event);
        const updated = assessmentManager.getAssessment(assessmentId);
        if (updated) socket.emit("assessment_state", updated);
      });
    });

    // Leave mission
    const handleLeave = (missionId: string) => {
      socket.leave(missionId);
      if (unsubscribe) { unsubscribe(); unsubscribe = null; }
      if (unsubscribeSDK) { unsubscribeSDK(); unsubscribeSDK = null; }
    };

    socket.on("leave_mission", handleLeave);
    socket.on("leave_session", handleLeave); // backwards compat
    socket.on("leave_assessment", (assessmentId: string) => {
      socket.leave(assessmentId);
      if (unsubscribeAssessment) {
        unsubscribeAssessment();
        unsubscribeAssessment = null;
      }
    });

    // Send message to mission
    socket.on(
      "send_message",
      async (data: { sessionId?: string; missionId?: string; content: string }) => {
      const id = data.missionId ?? data.sessionId;
      if (!id) return;
      if (!missionManager) {
        socket.emit("error", { message: "Mission runtime is not enabled" });
        return;
      }

      // Verify ownership
        const missionUserId = missionManager.getMissionUserId(id);
        if (missionUserId && missionUserId !== userId) {
          socket.emit("error", { message: "Forbidden" });
          return;
        }

        try {
          const message = await missionManager.sendMessage(id, data.content);
          socket.emit("message_sent", message);

          const mission = missionManager.getMission(id);
          if (mission) {
            socket.emit("mission_state", mission);
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          socket.emit("error", { message: msg });
        }
      }
    );

    // Relay credentials from frontend to container
    socket.on(
      "credential_provided",
      async (data: { missionId: string; requestId: string; credentials: Record<string, string> }) => {
      const id = data.missionId;
      if (!id) return;
      if (!missionManager) {
        socket.emit("error", { message: "Mission runtime is not enabled" });
        return;
      }

      // Verify ownership
        const missionUserId = missionManager.getMissionUserId(id);
        if (missionUserId && missionUserId !== userId) {
          socket.emit("error", { message: "Forbidden" });
          return;
        }

        try {
          await missionManager.relayCredential(id, {
            requestId: data.requestId,
            credentials: data.credentials,
          });
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          socket.emit("error", { message: msg });
        }
      }
    );

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
      if (unsubscribe) unsubscribe();
      if (unsubscribeSDK) unsubscribeSDK();
      if (unsubscribeAssessment) unsubscribeAssessment();
    });
  });
}
