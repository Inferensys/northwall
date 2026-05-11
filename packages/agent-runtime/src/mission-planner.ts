import { query, type SDKMessage, type Options } from "@anthropic-ai/claude-agent-sdk";
import { nanoid } from "nanoid";
import type { ChatMessage, MissionPlan, MissionTask } from "@northwall/shared";
import { type MissionEnvConfig, buildSdkEnv, buildProcessEnv } from "./mission-env.js";

export interface ExplorationActivity {
  type: "tool_start" | "tool_progress" | "tool_summary";
  summary: string;
  tool?: string;
  timestamp: number;
}

function summarizeExplorationTool(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case "WebSearch":
      return `Searching for "${(input.query as string) ?? ""}"`;
    case "WebFetch":
      return `Reading ${(input.url as string) ?? "a page"}`;
    case "Read":
      return `Reading file ${(input.file_path as string)?.split("/").pop() ?? ""}`;
    case "Glob":
      return `Looking for files matching ${(input.pattern as string) ?? ""}`;
    case "Grep":
      return `Searching code for "${(input.pattern as string) ?? ""}"`;
    default:
      return `Using ${toolName}`;
  }
}

function buildExplorationPrompt(envConfig: MissionEnvConfig): string {
  return `You are Aria, a defensive AppSec research assistant helping shape an authorized security assessment before it gets planned. Your role is DISCOVERY: understand the owned target, scope, security goals, and evidence needs. You are NOT an attacker and NOT a builder. Never write exploit code, never provide weaponized payloads, never target third-party systems.

## Your Process
1. **Research first.** Use WebSearch to understand the domain, find best practices, identify common patterns and pitfalls. Say what you're looking into: "Let me research X..."
2. **Analyze what you find.** Read relevant docs, examples, and discussions using WebFetch.
3. **Present structured findings:**
   - What the user wants assessed (your understanding)
   - Scope and authorization assumptions
   - Key technical decisions to make (with options you found)
   - Relevant defensive references such as OWASP ASVS, CWE, CISA KEV, and NIST SSDF
   - Potential challenges or risks
   - What you'd recommend (with reasoning)
4. **Ask targeted questions** only for genuine gaps — use numbered format with options.

## When You Do Ask Questions
- Use short numbered format with options the user can quickly pick from:
  1. Scale? a) Prototype/MVP  b) Production-ready  c) Enterprise
  2. Auth needed? a) None  b) Simple login  c) OAuth/SSO
- Max 3-4 questions per round
- The user can reply concisely: "1b, 2a, 3c"
- NEVER ask open-ended questions that require long typed answers

## Narrative Flow
The user sees your text and tool usage interleaved chronologically. Create a readable narrative by emitting short "bridge" text between tool calls:
- "Let me research X..." → [tools run] → "Good findings. Let me also check Y..." → [tools run] → "Here's what I found: ..."
- Always emit at least a short sentence BEFORE your first tool call
- After a batch of tool calls, emit a brief transition before the next batch or your final analysis
- This creates a natural text → tool → text → tool → text reading flow

## Rules
- NEVER write exploit code, destructive commands, credential theft guidance, or bypass instructions
- NEVER target third-party systems or suggest scanning outside confirmed owned scope
- NEVER output a "here's your X" solution — evidence-backed assessment agents handle execution later
- DO use code-style formatting for technical terms (\`localStorage\`, \`Chart.js\`)
- DO reference specific libraries, APIs, or tools you found during research
- Keep responses concise — bullets over paragraphs
- Show your research process — the user should see what you searched and what you learned
- If you can infer something reasonable, state your assumption instead of asking

## CRITICAL RULE
At the very end of every response, you MUST include a readiness assessment tag on its own line:
[READINESS: X/10]

Score honestly:
- 1-3: Still gathering basic understanding of the goal
- 4-6: Have a good picture but missing important details (constraints, scale, key decisions)
- 7-8: Strong understanding, only minor details would improve the plan
- 9-10: Crystal clear requirements, ready to plan immediately

This tag will be stripped before showing your response to the user — it's for internal use only.`;
}

function buildPlanningPrompt(envConfig: MissionEnvConfig): string {
  const imageGenSection = envConfig.imageGenEndpoint
    ? `
## Image Generation
An Azure OpenAI image generation model is available. Agents that need to generate images should use \`Bash\` (with curl) or \`WebFetch\` to call the API:
- Endpoint: available via \$AZURE_IMAGE_GEN_ENDPOINT env var
- API Key: available via \$AZURE_IMAGE_GEN_KEY env var
- Usage: POST to the endpoint with JSON body \`{"prompt": "description", "n": 1, "size": "1024x1024"}\` and header \`api-key: $AZURE_IMAGE_GEN_KEY\`
- When a task involves image/visual generation, assign it to an agent with Bash or WebFetch tools and include image generation instructions in their system prompt.
`
    : "";

  return `You are an Assessment Planner for Northwall. Your job is to analyze an authorized AppSec request and design an optimal defensive team of AI agents to map the system, collect evidence, and produce remediation-ready findings.

## Your Process
1. Confirm the target is owned or explicitly authorized
2. Map the system first: routes, services, auth boundaries, data stores, packages, secrets, integrations
3. If scope is ambiguous, ask clarifying questions (max 2 rounds)
4. Design a specialist AppSec team with clear responsibilities
5. Create an ordered task breakdown with dependencies, evidence requirements, and safe verification steps
6. Estimate complexity

## Agent Design Guidelines
- Give agents descriptive kebab-case names (e.g. "system-cartographer", "code-auditor", "dependency-analyst")
- Give each agent a human persona: a \`displayName\` and a \`specialization\` (one-line expertise, e.g. "Tenant isolation review")
- Each agent needs a clear description (used by the orchestrator to decide when to dispatch)
- Each agent needs a detailed system prompt defining their persona and approach
- Assign appropriate tool sets: Read, Write, Bash, Glob, Grep, WebFetch, WebSearch, Task, NotebookEdit
- Choose model tiers wisely: "opus" for complex reasoning, "sonnet" for standard work, "haiku" for simple tasks
- Keep teams small — 4-7 agents for AppSec assessments
${imageGenSection}
## Task Design Guidelines
- Break work into concrete, actionable tasks
- Define clear dependencies between tasks
- Assign tasks to specific agents when obvious, or leave null for the orchestrator to decide
- Each task should have a clear deliverable, evidence expectation, and safe verification boundary
- Do not include destructive tests, credential harvesting, third-party scanning, persistence, stealth, or weaponized exploit output
- Findings should map to ASVS/CWE/CVE/KEV where relevant and include owner-ready remediation steps

## Output Format
When you're ready to output the plan, respond with ONLY a JSON object matching this schema:
{
  "title": "string — assessment title",
  "objective": "string — clear statement of what this assessment will accomplish",
  "agents": [
    {
      "name": "string — kebab-case agent name",
      "displayName": "string — friendly first name (e.g. 'Sarah', 'Alex')",
      "specialization": "string — one-line expertise (e.g. 'RESTful API design')",
      "description": "string — when to use this agent (1-2 sentences)",
      "prompt": "string — detailed system prompt for this agent",
      "tools": ["string — tool names"],
      "model": "sonnet | opus | haiku | inherit"
    }
  ],
  "tasks": [
    {
      "id": "string — unique task id like t1, t2, etc.",
      "title": "string — task title",
      "description": "string — what to do, including evidence and safety boundary",
      "assignee": "string | null — agent name or null",
      "dependencies": ["string — task ids this depends on"]
    }
  ],
  "estimatedComplexity": "simple | moderate | complex"
}

If the request asks for third-party targeting, destructive activity, credential theft, stealth, persistence, or exploit weaponization, refuse that scope and propose a safe owned-environment assessment instead.

If you need clarification, respond with natural language questions instead of JSON.`;
}

export class MissionPlanner {
  private envConfig: MissionEnvConfig;
  private conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = [];
  private roundCount = 0;
  private readonly maxQARounds = 2;

  constructor(envConfig: MissionEnvConfig) {
    this.envConfig = envConfig;
  }

  async planMission(
    userPrompt: string,
    _conversation: ChatMessage[],
  ): Promise<{ type: "questions" | "plan"; content: string | MissionPlan }> {
    this.conversationHistory.push({ role: "user", content: userPrompt });
    this.roundCount++;

    // Build the full prompt from conversation history
    const fullPrompt = this.conversationHistory
      .map((m) => `${m.role === "user" ? "User" : "Planner"}: ${m.content}`)
      .join("\n\n");

    const forceOutput = this.roundCount > this.maxQARounds;
    const prompt = forceOutput
      ? `${fullPrompt}\n\nIMPORTANT: You have asked enough questions. Now output the mission plan as JSON.`
      : fullPrompt;

    const sdkEnv = buildSdkEnv(this.envConfig);
    const options: Options = {
      systemPrompt: buildPlanningPrompt(this.envConfig),
      tools: ["Read", "Glob", "Grep", "WebSearch", "WebFetch"],
      cwd: process.cwd(),
      env: buildProcessEnv(this.envConfig),
      maxTurns: 3,
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
    };

    let resultText = "";

    console.log("[MissionPlanner] Starting query with env:", {
      CLAUDE_CODE_USE_FOUNDRY: sdkEnv.CLAUDE_CODE_USE_FOUNDRY,
      ANTHROPIC_FOUNDRY_RESOURCE: sdkEnv.ANTHROPIC_FOUNDRY_RESOURCE,
      hasApiKey: !!sdkEnv.ANTHROPIC_FOUNDRY_API_KEY,
    });

    const queryResult = query({ prompt, options });
    for await (const msg of queryResult) {
      if (msg.type === "assistant") {
        for (const block of msg.message.content) {
          if (block.type === "text") {
            resultText += block.text;
          }
        }
      } else if (msg.type === "result") {
        if (msg.subtype === "success") {
          if (msg.result) resultText = msg.result;
        } else {
          console.error("[MissionPlanner] Query error:", msg.subtype, "errors" in msg ? (msg as Record<string, unknown>).errors : "");
        }
      }
    }

    this.conversationHistory.push({ role: "assistant", content: resultText });

    // Try to parse as JSON plan
    const planJson = extractJson(resultText);
    if (planJson) {
      const plan = hydratePlan(planJson);
      return { type: "plan", content: plan };
    }

    // Otherwise it's questions/conversation
    return { type: "questions", content: resultText };
  }

  async explore(
    userPrompt: string,
    chatHistory: Array<{ role: string; content: string }>,
    onActivity?: (activity: ExplorationActivity) => void,
    onToken?: (chunk: string) => void,
  ): Promise<{ text: string; readiness: number }> {
    this.conversationHistory.push({ role: "user", content: userPrompt });

    // Build full prompt from history
    const fullPrompt = this.conversationHistory
      .map((m) => `${m.role === "user" ? "User" : "Aria"}: ${m.content}`)
      .join("\n\n");

    const sdkEnv = buildSdkEnv(this.envConfig);
    const options: Options = {
      systemPrompt: buildExplorationPrompt(this.envConfig),
      tools: ["Read", "Glob", "Grep", "WebSearch", "WebFetch"],
      cwd: process.cwd(),
      env: buildProcessEnv(this.envConfig),
      maxTurns: 5,
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      ...(onToken ? { includePartialMessages: true } : {}),
    };

    let resultText = "";

    console.log("[MissionPlanner] Starting exploration query");

    const queryResult = query({ prompt: fullPrompt, options });
    for await (const msg of queryResult) {
      if (msg.type === "stream_event" && onToken) {
        const event = (msg as { event: Record<string, unknown> }).event;
        if (event.type === "content_block_delta") {
          const delta = event.delta as Record<string, unknown> | undefined;
          if (delta?.type === "text_delta" && typeof delta.text === "string") {
            onToken(delta.text);
          }
        }
      } else if (msg.type === "assistant") {
        for (const block of msg.message.content) {
          if (block.type === "text") {
            resultText += block.text;
          } else if (block.type === "tool_use" && onActivity) {
            const summary = summarizeExplorationTool(
              block.name,
              (block.input as Record<string, unknown>) ?? {},
            );
            onActivity({
              type: "tool_start",
              summary,
              tool: block.name,
              timestamp: Date.now(),
            });
          }
        }
      } else if (msg.type === "tool_use_summary" && onActivity) {
        const summary = typeof (msg as Record<string, unknown>).summary === "string"
          ? (msg as Record<string, unknown>).summary as string
          : "Tool completed";
        onActivity({
          type: "tool_summary",
          summary,
          timestamp: Date.now(),
        });
      } else if (msg.type === "result") {
        if (msg.subtype === "success") {
          if (msg.result) resultText = msg.result;
        } else {
          console.error("[MissionPlanner] Exploration query error:", msg.subtype);
        }
      }
    }

    const readiness = parseReadiness(resultText);
    const cleanText = stripReadinessTag(resultText);

    this.conversationHistory.push({ role: "assistant", content: cleanText });

    return { text: cleanText, readiness };
  }

  async planFromContext(
    explorationContext: string,
  ): Promise<MissionPlan | null> {
    const prompt = `The following is a complete discovery conversation between a user and an exploration assistant. Based on this conversation, output the mission plan as JSON directly — do NOT ask questions.\n\n${explorationContext}`;

    const sdkEnv = buildSdkEnv(this.envConfig);
    const options: Options = {
      systemPrompt: buildPlanningPrompt(this.envConfig),
      tools: ["Read", "Glob", "Grep", "WebSearch", "WebFetch"],
      cwd: process.cwd(),
      env: buildProcessEnv(this.envConfig),
      maxTurns: 5,
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
    };

    let resultText = "";

    console.log("[MissionPlanner] Starting planFromContext query");

    const queryResult = query({ prompt, options });
    for await (const msg of queryResult) {
      if (msg.type === "assistant") {
        for (const block of msg.message.content) {
          if (block.type === "text") {
            resultText += block.text;
          }
        }
      } else if (msg.type === "result") {
        if (msg.subtype === "success") {
          if (msg.result) resultText = msg.result;
        } else {
          console.error("[MissionPlanner] planFromContext error:", msg.subtype);
        }
      }
    }

    const planJson = extractJson(resultText);
    if (planJson) {
      return hydratePlan(planJson);
    }
    return null;
  }

  reset(): void {
    this.conversationHistory = [];
    this.roundCount = 0;
  }
}

function parseReadiness(text: string): number {
  const match = text.match(/\[READINESS:\s*(\d+)\s*\/\s*10\]/i);
  return match ? Math.min(10, Math.max(0, parseInt(match[1]!, 10))) : 0;
}

function stripReadinessTag(text: string): string {
  return text.replace(/\n?\[READINESS:\s*\d+\s*\/\s*10\]\s*$/i, "").trim();
}

function extractJson(text: string): Record<string, unknown> | null {
  // Try to find JSON in the response — it might be wrapped in markdown code blocks
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = jsonMatch ? jsonMatch[1]!.trim() : text.trim();

  try {
    const parsed = JSON.parse(candidate);
    if (typeof parsed === "object" && parsed !== null && "agents" in parsed && "tasks" in parsed) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Try to find a JSON object in the text
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        const parsed = JSON.parse(text.slice(start, end + 1));
        if (typeof parsed === "object" && parsed !== null && "agents" in parsed) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        // Not valid JSON
      }
    }
  }
  return null;
}

function hydratePlan(raw: Record<string, unknown>): MissionPlan {
  const tasks = (raw.tasks as Array<Record<string, unknown>>).map((t) => ({
    id: (t.id as string) || nanoid(8),
    title: t.title as string,
    description: t.description as string,
    assignee: (t.assignee as string) ?? null,
    dependencies: (t.dependencies as string[]) ?? [],
    status: "pending" as const,
  })) satisfies MissionTask[];

  return {
    id: nanoid(12),
    title: raw.title as string,
    objective: raw.objective as string,
    agents: (raw.agents as Array<Record<string, unknown>>).map((a) => ({
      name: a.name as string,
      displayName: (a.displayName as string) ?? undefined,
      specialization: (a.specialization as string) ?? undefined,
      description: a.description as string,
      prompt: a.prompt as string,
      tools: a.tools as string[] | undefined,
      model: (a.model as "sonnet" | "opus" | "haiku" | "inherit") ?? "inherit",
      mcpServers: a.mcpServers as string[] | undefined,
    })),
    tasks,
    mcpServers: raw.mcpServers as Record<string, unknown> | undefined,
    estimatedComplexity: (raw.estimatedComplexity as "simple" | "moderate" | "complex") ?? "moderate",
    createdAt: Date.now(),
  };
}
