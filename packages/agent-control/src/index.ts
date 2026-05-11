import http from "node:http";
import { z } from "zod";
import { createEventRelay } from "./event-relay.js";
import { runSession } from "./executor.js";
import { handleFileList, handleFileRead } from "./file-api.js";

// ─── Configuration ────────────────────────────────────────────────────────────

const CONTROL_AUTH_TOKEN = process.env["CONTROL_AUTH_TOKEN"] ?? "";
const WORKSPACE_DIR = process.env["WORKSPACE_DIR"] ?? "/workspace";
const CONTROL_PORT = parseInt(process.env["CONTROL_PORT"] ?? "3001", 10);

// Inline validation schema — matches @northwall/shared StartSessionRequest schema
const StartSessionRequest = z.object({
  prompt: z.string(),
  sessionId: z.string(),
  resumeSessionId: z.string().optional(),
});

// ─── Session State ────────────────────────────────────────────────────────────

let activeSessionId: string | null = null;
let activeAbortController: AbortController | null = null;
const serverStartTime = Date.now();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function respond(
  res: http.ServerResponse,
  statusCode: number,
  data: unknown,
): void {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

// ─── Server ───────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  // Auth middleware — all requests must have matching x-control-token
  const token = req.headers["x-control-token"];
  if (!CONTROL_AUTH_TOKEN || token !== CONTROL_AUTH_TOKEN) {
    respond(res, 401, { error: "Unauthorized" });
    return;
  }

  const url = new URL(req.url ?? "/", `http://localhost:${CONTROL_PORT}`);
  const pathname = url.pathname;
  const method = req.method?.toUpperCase() ?? "GET";

  try {
    // POST /start — start a new session
    if (method === "POST" && pathname === "/start") {
      const raw = await readBody(req);
      const parsed = StartSessionRequest.safeParse(JSON.parse(raw));
      if (!parsed.success) {
        respond(res, 400, { error: "Invalid request body", details: parsed.error.issues });
        return;
      }

      const { prompt, sessionId, resumeSessionId } = parsed.data;

      if (activeSessionId) {
        respond(res, 409, { error: "Session already active", sessionId: activeSessionId });
        return;
      }

      // Create abort controller for this session
      activeAbortController = new AbortController();
      activeSessionId = sessionId;

      // Start session non-blocking
      runSession(
        {
          prompt,
          sessionId,
          resumeSessionId,
          abortSignal: activeAbortController.signal,
        },
        (envelope) => relay.broadcast(envelope),
      )
        .then(({ sessionId: sdkSessionId, totalCostUsd }) => {
          relay.broadcast({
            type: "session_completed",
            sessionId,
            sdkSessionId,
            totalCostUsd,
          });
        })
        .catch((err: unknown) => {
          const errorMsg = err instanceof Error ? err.message : String(err);
          relay.broadcast({
            type: "session_error",
            sessionId,
            error: errorMsg,
          });
        })
        .finally(() => {
          activeSessionId = null;
          activeAbortController = null;
        });

      respond(res, 200, { ok: true, sessionId });
      return;
    }

    // POST /message — follow-up / resume message
    if (method === "POST" && pathname === "/message") {
      const raw = await readBody(req);
      const parsed = StartSessionRequest.safeParse(JSON.parse(raw));
      if (!parsed.success) {
        respond(res, 400, { error: "Invalid request body", details: parsed.error.issues });
        return;
      }

      const { prompt, sessionId, resumeSessionId } = parsed.data;

      if (activeSessionId) {
        respond(res, 409, { error: "Session already active", sessionId: activeSessionId });
        return;
      }

      activeAbortController = new AbortController();
      activeSessionId = sessionId;

      runSession(
        {
          prompt,
          sessionId,
          resumeSessionId,
          abortSignal: activeAbortController.signal,
        },
        (envelope) => relay.broadcast(envelope),
      )
        .then(({ sessionId: sdkSessionId, totalCostUsd }) => {
          relay.broadcast({
            type: "session_completed",
            sessionId,
            sdkSessionId,
            totalCostUsd,
          });
        })
        .catch((err: unknown) => {
          const errorMsg = err instanceof Error ? err.message : String(err);
          relay.broadcast({
            type: "session_error",
            sessionId,
            error: errorMsg,
          });
        })
        .finally(() => {
          activeSessionId = null;
          activeAbortController = null;
        });

      respond(res, 200, { ok: true, sessionId });
      return;
    }

    // POST /abort — abort active session
    if (method === "POST" && pathname === "/abort") {
      if (activeAbortController) {
        activeAbortController.abort();
        respond(res, 200, { ok: true });
      } else {
        respond(res, 200, { ok: false, message: "No active session" });
      }
      return;
    }

    // GET /status — server health
    if (method === "GET" && pathname === "/status") {
      const status: Record<string, unknown> = {
        status: activeSessionId ? "busy" : "ready",
        uptime: (Date.now() - serverStartTime) / 1000,
      };
      if (activeSessionId) {
        status["sessionId"] = activeSessionId;
      }
      respond(res, 200, status);
      return;
    }

    // GET /files — list workspace files
    if (method === "GET" && pathname === "/files") {
      const files = await handleFileList(WORKSPACE_DIR);
      respond(res, 200, files);
      return;
    }

    // GET /files/read?path=<relpath> — read a workspace file
    if (method === "GET" && pathname === "/files/read") {
      const filePath = url.searchParams.get("path") ?? "";
      const result = await handleFileRead(WORKSPACE_DIR, filePath);
      if ("error" in result) {
        respond(res, 400, result);
      } else {
        respond(res, 200, result);
      }
      return;
    }

    // 404 for anything else
    respond(res, 404, { error: "Not found" });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[server] Request error:", errorMsg);
    respond(res, 500, { error: "Internal server error", message: errorMsg });
  }
});

// ─── Event Relay (WebSocket) ──────────────────────────────────────────────────

const relay = createEventRelay(server, CONTROL_AUTH_TOKEN);

// ─── Start ────────────────────────────────────────────────────────────────────

server.listen(CONTROL_PORT, () => {
  console.log(`[server] Control server ready on :${CONTROL_PORT}`);
  console.log(`[server] Workspace: ${WORKSPACE_DIR}`);
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

function shutdown(signal: string): void {
  console.log(`[server] Received ${signal}, shutting down...`);

  if (activeAbortController) {
    console.log("[server] Aborting active session...");
    activeAbortController.abort();
  }

  relay.wss.close();
  server.close(() => {
    console.log("[server] Server closed");
    process.exit(0);
  });

  // Force exit after 5s if graceful shutdown stalls
  setTimeout(() => {
    console.error("[server] Forced shutdown after timeout");
    process.exit(1);
  }, 5000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
