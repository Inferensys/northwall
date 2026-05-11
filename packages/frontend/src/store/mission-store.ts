"use client";

import { create } from "zustand";
import type {
  Mission,
  MissionPlan,
  SessionEvent,
  ChatMessage,
  MissionAgentState,
  SDKEnvelope,
} from "@northwall/shared";

export interface ExplorationFeedEntry {
  id: string;
  type: "text" | "tool";
  content: string;
  tool?: string;
  timestamp: number;
}

export interface PendingCredentialRequest {
  id: string;
  platform: string;
  type: "password" | "oauth" | "otp" | "api_key";
  context?: string;
  timestamp: number;
}

interface MissionStore {
  // State
  mission: Mission | null;
  events: SessionEvent[];
  chatMessages: ChatMessage[];
  connected: boolean;
  elapsedMs: number;
  timerInterval: ReturnType<typeof setInterval> | null;
  readinessScore: number | null;

  // Exploration streaming state — single chronological feed
  explorationFeed: ExplorationFeedEntry[];

  // Raw SDK message stream (for execution phase)
  sdkMessages: SDKEnvelope[];

  // Credential requests from container agents
  credentialRequests: PendingCredentialRequest[];

  // Actions
  setMission: (mission: Mission) => void;
  addEvent: (event: SessionEvent) => void;
  addEvents: (events: SessionEvent[]) => void;
  addChatMessage: (message: ChatMessage) => void;
  setConnected: (connected: boolean) => void;
  setReadinessScore: (score: number | null) => void;
  appendExplorationToken: (chunk: string) => void;
  addExplorationActivity: (act: { summary: string; tool?: string; timestamp: number }) => void;
  clearExplorationStream: () => void;
  addSDKMessage: (envelope: SDKEnvelope) => void;
  addSDKMessages: (envelopes: SDKEnvelope[]) => void;
  addCredentialRequest: (request: PendingCredentialRequest) => void;
  removeCredentialRequest: (requestId: string) => void;
  startTimer: () => void;
  stopTimer: () => void;
  tickTimer: () => void;
  reset: () => void;

  // Derived
  plan: () => MissionPlan | null;
  activeAgents: () => MissionAgentState[];
  completionPercent: () => number;
}

export const useMissionStore = create<MissionStore>((set, get) => ({
  mission: null,
  events: [],
  chatMessages: [],
  connected: false,
  elapsedMs: 0,
  timerInterval: null,
  readinessScore: null,
  explorationFeed: [],
  sdkMessages: [],
  credentialRequests: [],

  setMission: (mission) => set({ mission, readinessScore: mission.readinessScore }),

  addEvent: (event) =>
    set((state) => ({
      events: [...state.events, event],
    })),

  addEvents: (events) =>
    set((state) => {
      const existingIds = new Set(state.events.map((e) => e.id));
      const newEvents = events.filter((e) => !existingIds.has(e.id));
      return newEvents.length > 0 ? { events: [...state.events, ...newEvents] } : {};
    }),

  addChatMessage: (message) =>
    set((state) => {
      if (state.chatMessages.some((m) => m.id === message.id)) return {};
      return { chatMessages: [...state.chatMessages, message] };
    }),

  setConnected: (connected) => set({ connected }),

  setReadinessScore: (score) => set({ readinessScore: score }),

  appendExplorationToken: (chunk) =>
    set((state) => {
      const feed = [...state.explorationFeed];
      const last = feed[feed.length - 1];
      if (last && last.type === "text") {
        // Append to existing text entry (new object for immutability)
        feed[feed.length - 1] = { ...last, content: last.content + chunk };
      } else {
        // Start a new text entry (previous was tool or feed is empty)
        feed.push({ id: `feed-text-${Date.now()}`, type: "text", content: chunk, timestamp: Date.now() });
      }
      return { explorationFeed: feed };
    }),

  addExplorationActivity: (act) =>
    set((state) => ({
      explorationFeed: [
        ...state.explorationFeed,
        { id: `feed-tool-${Date.now()}-${state.explorationFeed.length}`, type: "tool" as const, content: act.summary, tool: act.tool, timestamp: act.timestamp },
      ],
    })),

  clearExplorationStream: () =>
    set({ explorationFeed: [] }),

  addSDKMessage: (envelope) =>
    set((state) => ({
      sdkMessages: [...state.sdkMessages, envelope],
    })),

  addSDKMessages: (envelopes) =>
    set((state) => {
      const existingIds = new Set(state.sdkMessages.map((e) => e.id));
      const newEnvelopes = envelopes.filter((e) => !existingIds.has(e.id));
      return newEnvelopes.length > 0
        ? { sdkMessages: [...state.sdkMessages, ...newEnvelopes] }
        : {};
    }),

  addCredentialRequest: (request) =>
    set((state) => ({
      credentialRequests: [...state.credentialRequests, request],
    })),

  removeCredentialRequest: (requestId) =>
    set((state) => ({
      credentialRequests: state.credentialRequests.filter((r) => r.id !== requestId),
    })),

  startTimer: () => {
    const existing = get().timerInterval;
    if (existing) return;
    const interval = setInterval(() => get().tickTimer(), 1000);
    set({ timerInterval: interval });
  },

  stopTimer: () => {
    const interval = get().timerInterval;
    if (interval) clearInterval(interval);
    set({ timerInterval: null });
  },

  tickTimer: () => {
    const mission = get().mission;
    if (mission?.startedAt) {
      set({ elapsedMs: Date.now() - mission.startedAt });
    }
  },

  reset: () => {
    const interval = get().timerInterval;
    if (interval) clearInterval(interval);
    set({
      mission: null,
      events: [],
      chatMessages: [],
      connected: false,
      elapsedMs: 0,
      timerInterval: null,
      readinessScore: null,
      explorationFeed: [],
      sdkMessages: [],
      credentialRequests: [],
    });
  },

  plan: () => get().mission?.plan ?? null,

  activeAgents: () =>
    get().mission?.agents.filter((a) => a.status === "working") ?? [],

  completionPercent: () => {
    const plan = get().mission?.plan;
    if (!plan) return 0;
    const tasks = plan.tasks;
    if (tasks.length === 0) return 0;
    const completed = tasks.filter((t) => t.status === "completed").length;
    return Math.round((completed / tasks.length) * 100);
  },
}));

/** Build a display name lookup from plan agents. Use with useMemo in components. */
export function buildDisplayNameMap(plan: MissionPlan | null | undefined): Record<string, string> {
  const map: Record<string, string> = { orchestrator: "Mission Control" };
  if (plan) {
    for (const agent of plan.agents) {
      if (agent.displayName) {
        map[agent.name] = agent.displayName;
      }
    }
  }
  return map;
}
