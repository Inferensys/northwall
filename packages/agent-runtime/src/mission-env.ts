import os from "node:os";
import path from "node:path";

export interface MissionEnvConfig {
  // Azure Foundry
  foundryResource: string;
  foundryApiKey: string;
  // Model preferences
  defaultModel?: string; // "claude-sonnet-4-6"
  capableModel?: string; // "claude-opus-4-6"
  // Workspace
  workspaceRoot?: string; // default: os.tmpdir()/northwall-engagements/
  // Azure Image Generation
  imageGenEndpoint?: string;
  imageGenApiKey?: string;
}

export function getWorkspaceRoot(config: MissionEnvConfig): string {
  return config.workspaceRoot ?? path.join(os.tmpdir(), "northwall-engagements");
}

export function buildSdkEnv(config: MissionEnvConfig): Record<string, string> {
  const env: Record<string, string> = {
    CLAUDE_CODE_USE_FOUNDRY: "1",
    ANTHROPIC_FOUNDRY_RESOURCE: config.foundryResource,
    ANTHROPIC_FOUNDRY_API_KEY: config.foundryApiKey,
  };
  if (config.defaultModel) {
    env["ANTHROPIC_DEFAULT_SONNET_MODEL"] = config.defaultModel;
  }
  if (config.capableModel) {
    env["ANTHROPIC_DEFAULT_OPUS_MODEL"] = config.capableModel;
  }
  return env;
}

/**
 * Build a complete env for spawning Claude Code subprocesses.
 * Strips CLAUDECODE to allow nesting (Agent SDK spawns claude CLI).
 */
export function buildProcessEnv(config: MissionEnvConfig): Record<string, string> {
  const base = { ...process.env } as Record<string, string>;
  // Remove the nesting guard so Agent SDK can spawn Claude Code
  delete base["CLAUDECODE"];
  // Overlay the SDK-specific vars
  const env = { ...base, ...buildSdkEnv(config) };
  // Pass image generation config to agent subprocesses
  if (config.imageGenEndpoint) {
    env["AZURE_IMAGE_GEN_ENDPOINT"] = config.imageGenEndpoint;
  }
  if (config.imageGenApiKey) {
    env["AZURE_IMAGE_GEN_KEY"] = config.imageGenApiKey;
  }
  return env;
}
