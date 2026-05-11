import fs from "node:fs/promises";
import path from "node:path";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";

// ─── SessionStore ─────────────────────────────────────────────────────────────
// Host-side JSONL and workspace file persistence.
// Storage layout: ~/.Northwall/sessions/<sessionId>/
//   - <sessionId>.jsonl   — JSONL events for session resume
//   - workspace.tar       — workspace tar archive

export class SessionStore {
  constructor(private baseDir: string) {}

  async getSessionDir(sessionId: string): Promise<string> {
    const dir = path.join(this.baseDir, sessionId);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  async saveJsonl(sessionId: string, jsonlContent: Buffer): Promise<void> {
    const dir = await this.getSessionDir(sessionId);
    await fs.writeFile(path.join(dir, `${sessionId}.jsonl`), jsonlContent);
  }

  async loadJsonl(sessionId: string): Promise<Buffer | null> {
    const filePath = path.join(this.baseDir, sessionId, `${sessionId}.jsonl`);
    try {
      return await fs.readFile(filePath);
    } catch {
      return null;
    }
  }

  async saveWorkspace(sessionId: string, tarStream: NodeJS.ReadableStream): Promise<void> {
    const dir = await this.getSessionDir(sessionId);
    const outputPath = path.join(dir, "workspace.tar");
    await pipeline(tarStream, createWriteStream(outputPath));
  }
}
