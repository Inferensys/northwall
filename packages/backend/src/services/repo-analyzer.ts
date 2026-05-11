import type {
  GitHubRepository,
  KnowledgeGraph,
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
} from "@northwall/shared";
import { GitHubClient } from "./github-client.js";

interface TreeFile {
  path: string;
  size?: number;
}

export interface RepoSnapshot {
  files: TreeFile[];
  sampledFiles: Array<{ path: string; content: string }>;
  inventory: {
    files: number;
    packageFiles: string[];
    routes: string[];
    authFiles: string[];
    ciFiles: string[];
    configFiles: string[];
    dependencies: string[];
  };
  graph: KnowledgeGraph;
}

const MAX_FILES_TO_READ = 60;
const MAX_FILE_SIZE = 120_000;

function isPackageFile(path: string): boolean {
  return /(^|\/)(package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|requirements\.txt|pyproject\.toml|go\.mod|pom\.xml|Gemfile\.lock)$/.test(path);
}

function isRouteFile(path: string): boolean {
  return /(app\/.*\/route\.(ts|js)|pages\/api\/|src\/routes\/|src\/api\/|server\/routes|api\/)/.test(path);
}

function isAuthFile(path: string): boolean {
  return /(auth|session|jwt|oauth|middleware|permission|tenant|rbac)/i.test(path);
}

function isCiFile(path: string): boolean {
  return path.startsWith(".github/workflows/") || /(circleci|gitlab-ci|buildkite|jenkins)/i.test(path);
}

function isConfigFile(path: string): boolean {
  return /(^|\/)(\.env\.example|next\.config|vite\.config|dockerfile|docker-compose|tsconfig|eslint|turbo|vercel|netlify|wrangler)/i.test(path);
}

function interestingFiles(files: TreeFile[]): TreeFile[] {
  const selected = files.filter((file) =>
    file.size == null ||
    file.size <= MAX_FILE_SIZE,
  ).filter((file) =>
    isPackageFile(file.path) ||
    isRouteFile(file.path) ||
    isAuthFile(file.path) ||
    isCiFile(file.path) ||
    isConfigFile(file.path),
  );

  return selected.slice(0, MAX_FILES_TO_READ);
}

function parseDependencies(samples: Array<{ path: string; content: string }>): string[] {
  const deps = new Set<string>();
  for (const sample of samples) {
    if (!sample.path.endsWith("package.json")) continue;
    try {
      const parsed = JSON.parse(sample.content) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      for (const name of Object.keys(parsed.dependencies ?? {})) deps.add(name);
      for (const name of Object.keys(parsed.devDependencies ?? {})) deps.add(name);
    } catch {
      // Ignore invalid package manifests; the planner will still see the file path.
    }
  }
  return Array.from(deps).sort().slice(0, 80);
}

function buildGraph(repo: GitHubRepository, inventory: RepoSnapshot["inventory"], samples: RepoSnapshot["sampledFiles"]): KnowledgeGraph {
  const nodes: KnowledgeGraphNode[] = [{
    id: "repo",
    label: repo.fullName,
    kind: "repo",
    risk: "medium",
    evidence: [`${inventory.files} files indexed`],
  }];
  const edges: KnowledgeGraphEdge[] = [];

  const addNode = (node: KnowledgeGraphNode, label = "contains") => {
    nodes.push(node);
    edges.push({ id: `repo-${node.id}`, source: "repo", target: node.id, label });
  };

  if (inventory.routes.length > 0) {
    addNode({
      id: "routes",
      label: "API and route handlers",
      kind: "route",
      risk: "high",
      evidence: inventory.routes.slice(0, 6),
    });
  }
  if (inventory.authFiles.length > 0) {
    addNode({
      id: "auth",
      label: "Auth and authorization code",
      kind: "auth",
      risk: "high",
      evidence: inventory.authFiles.slice(0, 6),
    });
  }
  if (inventory.packageFiles.length > 0) {
    addNode({
      id: "dependencies",
      label: "Dependency graph",
      kind: "package",
      risk: inventory.dependencies.length > 40 ? "medium" : "low",
      evidence: inventory.packageFiles,
    });
  }
  if (inventory.ciFiles.length > 0) {
    addNode({
      id: "ci",
      label: "CI workflows",
      kind: "ci",
      risk: "medium",
      evidence: inventory.ciFiles,
    });
  }
  if (inventory.configFiles.length > 0) {
    addNode({
      id: "config",
      label: "Runtime config",
      kind: "config",
      risk: hasSecretReferences(samples) ? "high" : "medium",
      evidence: inventory.configFiles,
    });
  }

  if (nodes.some((node) => node.id === "routes") && nodes.some((node) => node.id === "auth")) {
    edges.push({ id: "routes-auth", source: "routes", target: "auth", label: "authorization boundary" });
  }
  if (nodes.some((node) => node.id === "routes") && nodes.some((node) => node.id === "dependencies")) {
    edges.push({ id: "routes-deps", source: "routes", target: "dependencies", label: "runtime packages" });
  }

  return {
    nodes,
    edges,
    confidence: Math.min(95, 55 + nodes.length * 7),
    summary: `Indexed ${repo.fullName}; mapped ${nodes.length} investigation areas from code, ownership clues, dependencies, config, and CI.`,
  };
}

function hasSecretReferences(samples: RepoSnapshot["sampledFiles"]): boolean {
  return samples.some((sample) => /(api[_-]?key|secret|token|password|private[_-]?key)/i.test(sample.content));
}

export class RepoAnalyzer {
  constructor(private readonly github = new GitHubClient()) {}

  async analyze(token: string, repo: GitHubRepository, branch: string): Promise<RepoSnapshot> {
    const tree = await this.github.getTree(token, repo, branch);
    const files = tree.map((item) => ({ path: item.path, size: item.size }));
    const selected = interestingFiles(files);
    const sampledFiles = await Promise.all(selected.map(async (file) => ({
      path: file.path,
      content: await this.github.readFile(token, repo, branch, file.path),
    })));

    const inventory = {
      files: files.length,
      packageFiles: files.filter((file) => isPackageFile(file.path)).map((file) => file.path).slice(0, 20),
      routes: files.filter((file) => isRouteFile(file.path)).map((file) => file.path).slice(0, 40),
      authFiles: files.filter((file) => isAuthFile(file.path)).map((file) => file.path).slice(0, 40),
      ciFiles: files.filter((file) => isCiFile(file.path)).map((file) => file.path).slice(0, 20),
      configFiles: files.filter((file) => isConfigFile(file.path)).map((file) => file.path).slice(0, 30),
      dependencies: parseDependencies(sampledFiles),
    };

    return {
      files,
      sampledFiles,
      inventory,
      graph: buildGraph(repo, inventory, sampledFiles),
    };
  }
}
