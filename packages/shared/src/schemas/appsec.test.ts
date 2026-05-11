import { describe, expect, it } from "vitest";
import {
  findingPriorityScore,
  validateScopeGate,
  type EngagementScope,
  type Finding,
  type SystemGraph,
} from "./appsec";

const baseScope: EngagementScope = {
  targetName: "AcmePay SaaS",
  targetType: "sample-app",
  ownedEnvironment: true,
  authorizationConfirmed: true,
  allowedHosts: ["localhost"],
  maxRequestsPerMinute: 30,
  destructiveTesting: false,
  thirdPartyTargets: false,
};

describe("AppSec scope gate", () => {
  it("allows owned and authorized safe AppSec targets", () => {
    expect(validateScopeGate(baseScope)).toEqual({ allowed: true, reasons: [] });
  });

  it("rejects third-party or destructive scopes", () => {
    const result = validateScopeGate({
      ...baseScope,
      thirdPartyTargets: true,
      destructiveTesting: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain("Third-party targets are outside scope.");
    expect(result.reasons).toContain("Destructive testing is disabled for safe SOC runs.");
  });

  it("requires allowed hosts for staging URL assessments", () => {
    const result = validateScopeGate({
      ...baseScope,
      targetType: "staging-url",
      allowedHosts: [],
    });
    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain("Staging URL runs require at least one allowed host.");
  });
});

describe("finding priority", () => {
  it("weights severity, confidence, and known exploitation", () => {
    const finding: Pick<Finding, "severity" | "confidence" | "kev"> = {
      severity: "high",
      confidence: "high",
      kev: true,
    };
    expect(findingPriorityScore(finding)).toBe(90);
  });
});

describe("system graph fixture shape", () => {
  it("connects findings to existing graph nodes", () => {
    const graph: SystemGraph = {
      confidence: 92,
      lastUpdatedAt: Date.now(),
      nodes: [
        { id: "api", label: "API", kind: "api", risk: "high" },
        { id: "postgres", label: "Postgres", kind: "database", risk: "medium" },
      ],
      edges: [{ id: "api-db", source: "api", target: "postgres", label: "reads/writes" }],
    };
    const findingNodeIds = ["api", "postgres"];
    const known = new Set(graph.nodes.map((node) => node.id));
    expect(findingNodeIds.every((id) => known.has(id))).toBe(true);
  });
});
