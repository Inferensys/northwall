import type { GitHubRepository, VulnerabilityFinding } from "@northwall/shared";
import { buildGitHubIssuePayload } from "@northwall/shared";

const GITHUB_API = "https://api.github.com";

interface GitHubUser {
  login: string;
}

interface GitHubRepoResponse {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
  owner: { login: string };
  permissions?: { admin?: boolean; push?: boolean; pull?: boolean };
}

interface GitHubTreeItem {
  path: string;
  type: "blob" | "tree" | "commit";
  size?: number;
}

interface GitHubBranchResponse {
  commit: { sha: string };
}

interface GitHubContentResponse {
  content?: string;
  encoding?: string;
}

interface GitHubIssueResponse {
  number: number;
  html_url: string;
}

function headers(token: string): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Northwall",
  };
}

async function githubFetch<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      ...headers(token),
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub ${res.status}: ${text.slice(0, 240)}`);
  }

  return res.json() as Promise<T>;
}

export class GitHubClient {
  async viewer(token: string): Promise<{ account: string; scopes: string[] }> {
    const res = await fetch(`${GITHUB_API}/user`, { headers: headers(token) });
    if (!res.ok) throw new Error(`GitHub ${res.status}: could not verify token`);
    const user = await res.json() as GitHubUser;
    const scopes = res.headers.get("x-oauth-scopes")?.split(",").map((scope) => scope.trim()).filter(Boolean) ?? [];
    return { account: user.login, scopes };
  }

  async listRepos(token: string): Promise<GitHubRepository[]> {
    const repos = await githubFetch<GitHubRepoResponse[]>(
      token,
      "/user/repos?affiliation=owner,collaborator,organization_member&sort=updated&per_page=100",
    );

    return repos.map((repo) => ({
      id: repo.id,
      owner: repo.owner.login,
      name: repo.name,
      fullName: repo.full_name,
      private: repo.private,
      defaultBranch: repo.default_branch,
      htmlUrl: repo.html_url,
      permissions: {
        admin: repo.permissions?.admin,
        push: repo.permissions?.push,
        pull: repo.permissions?.pull,
      },
    }));
  }

  async getTree(token: string, repo: GitHubRepository, branch: string): Promise<GitHubTreeItem[]> {
    const branchInfo = await githubFetch<GitHubBranchResponse>(
      token,
      `/repos/${repo.owner}/${repo.name}/branches/${encodeURIComponent(branch)}`,
    );
    const tree = await githubFetch<{ tree: GitHubTreeItem[] }>(
      token,
      `/repos/${repo.owner}/${repo.name}/git/trees/${branchInfo.commit.sha}?recursive=1`,
    );
    return tree.tree.filter((item) => item.type === "blob");
  }

  async readFile(token: string, repo: GitHubRepository, branch: string, filePath: string): Promise<string> {
    const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
    const content = await githubFetch<GitHubContentResponse>(
      token,
      `/repos/${repo.owner}/${repo.name}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`,
    );
    if (content.encoding !== "base64" || !content.content) return "";
    return Buffer.from(content.content, "base64").toString("utf-8");
  }

  async createIssue(
    token: string,
    repo: GitHubRepository,
    finding: VulnerabilityFinding,
  ): Promise<{ number: number; url: string }> {
    const payload = buildGitHubIssuePayload(finding);
    await this.ensureLabels(token, repo, payload.labels);

    const issue = await githubFetch<GitHubIssueResponse>(
      token,
      `/repos/${repo.owner}/${repo.name}/issues`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    return { number: issue.number, url: issue.html_url };
  }

  private async ensureLabels(token: string, repo: GitHubRepository, labels: string[]): Promise<void> {
    await Promise.all(labels.map(async (label) => {
      try {
        await githubFetch(token, `/repos/${repo.owner}/${repo.name}/labels`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: label,
            color: label === "security" ? "d73a4a" : "0e8a16",
          }),
        });
      } catch {
        // Existing labels or missing label permissions should not block issue creation.
      }
    }));
  }
}
