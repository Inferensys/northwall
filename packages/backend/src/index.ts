import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Load .env from monorepo root
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../.env"), override: true });
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { Server as SocketServer } from "socket.io";
import { assessmentsRouter } from "./routes/assessments.js";
import { githubRouter } from "./routes/github.js";
import { missionsRouter } from "./routes/missions.js";
import { AssessmentManager } from "./services/assessment-manager.js";
import { MissionManager } from "./services/mission-manager.js";
import { setupWebSocket } from "./ws/handler.js";
import { authMiddleware } from "./middleware/auth.js";

const app = new Hono();
const localOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:3003",
  "http://localhost:3004",
  "http://localhost:3005",
];
const allowedOrigins = [
  ...localOrigins,
  ...(process.env.ALLOWED_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean) ?? []),
];

// CORS for frontend
app.use(
  "/*",
  cors({
    origin: allowedOrigins,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

// Health check
app.get("/health", (c) => c.json({ status: "ok", timestamp: Date.now() }));

// Initialize services
const missionManager = process.env.ENABLE_LEGACY_MISSIONS === "true"
  ? await MissionManager.create()
  : null;
const assessmentManager = await AssessmentManager.create();

// Auth middleware for product API routes
if (missionManager) app.use("/api/missions/*", authMiddleware);
app.use("/api/github/*", authMiddleware);
app.use("/api/assessments/*", authMiddleware);

// Mount routes
if (missionManager) app.route("/api/missions", missionsRouter(missionManager));
app.route("/api/github", githubRouter(assessmentManager));
app.route("/api/assessments", assessmentsRouter(assessmentManager));

// Start server
const port = parseInt(process.env.PORT ?? "4000", 10);

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Northwall Backend running on http://localhost:${info.port}`);
});

// WebSocket server
const io = new SocketServer(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
});

setupWebSocket(io, missionManager ?? undefined, assessmentManager);

console.log("WebSocket server ready");
