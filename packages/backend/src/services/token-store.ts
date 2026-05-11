import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

interface StoredToken {
  userId: string;
  account: string;
  scopes: string[];
  connectedAt: number;
  encryptedToken?: string;
}

interface TokenFile {
  tokens: StoredToken[];
}

export interface GitHubTokenRecord {
  token: string;
  account: string;
  scopes: string[];
  connectedAt: number;
}

function keyFromEnv(): Buffer | null {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) return null;
  return crypto.createHash("sha256").update(raw).digest();
}

export class TokenStore {
  private readonly filePath = path.join(os.homedir(), ".Northwall", "github-tokens.json");
  private readonly memory = new Map<string, GitHubTokenRecord>();

  async saveGitHubToken(userId: string, token: string, account: string, scopes: string[]): Promise<void> {
    const connectedAt = Date.now();
    this.memory.set(userId, { token, account, scopes, connectedAt });

    const key = keyFromEnv();
    if (!key) return;

    const file = await this.readFile();
    const encryptedToken = this.encrypt(token, key);
    const next: StoredToken = { userId, account, scopes, connectedAt, encryptedToken };
    const tokens = file.tokens.filter((entry) => entry.userId !== userId);
    tokens.push(next);

    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify({ tokens }, null, 2), "utf-8");
  }

  async getGitHubToken(userId: string): Promise<GitHubTokenRecord | null> {
    const fromMemory = this.memory.get(userId);
    if (fromMemory) return fromMemory;

    const envToken = process.env.GITHUB_TOKEN;
    if (process.env.DEV_AUTH_BYPASS === "true" && envToken) {
      return {
        token: envToken,
        account: process.env.GITHUB_ACCOUNT ?? "server-token",
        scopes: ["repo"],
        connectedAt: Date.now(),
      };
    }

    const key = keyFromEnv();
    if (!key) return null;

    const file = await this.readFile();
    const stored = file.tokens.find((entry) => entry.userId === userId);
    if (!stored?.encryptedToken) return null;

    const token = this.decrypt(stored.encryptedToken, key);
    const record = {
      token,
      account: stored.account,
      scopes: stored.scopes,
      connectedAt: stored.connectedAt,
    };
    this.memory.set(userId, record);
    return record;
  }

  async getConnection(userId: string) {
    const record = await this.getGitHubToken(userId);
    return {
      connected: Boolean(record),
      provider: "github" as const,
      account: record?.account ?? null,
      scopes: record?.scopes ?? [],
      connectedAt: record?.connectedAt ?? null,
    };
  }

  private async readFile(): Promise<TokenFile> {
    try {
      const raw = await fs.readFile(this.filePath, "utf-8");
      return JSON.parse(raw) as TokenFile;
    } catch {
      return { tokens: [] };
    }
  }

  private encrypt(plainText: string, key: Buffer): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, "utf-8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
  }

  private decrypt(payload: string, key: Buffer): string {
    const [ivRaw, tagRaw, encryptedRaw] = payload.split(".");
    if (!ivRaw || !tagRaw || !encryptedRaw) throw new Error("Invalid token payload");

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivRaw, "base64"));
    decipher.setAuthTag(Buffer.from(tagRaw, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedRaw, "base64")),
      decipher.final(),
    ]).toString("utf-8");
  }
}
