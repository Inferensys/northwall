import { describe, expect, it } from "vitest";
import { parseModelJson } from "./openai-assessment.js";

describe("parseModelJson", () => {
  it("parses fenced JSON responses", () => {
    expect(parseModelJson<{ ok: boolean }>("```json\n{\"ok\":true}\n```")).toEqual({ ok: true });
  });

  it("parses JSON with surrounding assistant text", () => {
    expect(parseModelJson<{ findings: unknown[] }>("Result:\n{\"findings\":[]}")).toEqual({ findings: [] });
  });

  it("rejects malformed model output", () => {
    expect(() => parseModelJson("no structured JSON here")).toThrow("Model response did not contain JSON");
    expect(() => parseModelJson("{not-valid-json")).toThrow();
  });
});
