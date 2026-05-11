![Northwall cover](docs/northwall-cover.svg)

Northwall is an Agentic SOC platform for teams that want multi-agent orchestration using graph-based understanding: custom team of multi-agent specialists, build a knowledge graph, vulnerability analysis & search loops, and GitHub integration.

If you're looking to build a custom agentic SOC tool / platform for your organization, Northwall would be a good fit to start from; whether it is: 
- Multi Agent Orchestration,
- Agentic security operations,
- SOC automation,
- Alert triage,
- Vulnerability / threat investigation,
- Incident response automation,
- Investigation graph,
- Security work item creation, or
- Human-in-the-loop (HITL) security operations.

## Demo

![Northwall landing page](docs/screenshots/landing-page.png)

[Watch the 15-second walkthrough](docs/northwall-agentic-soc-demo.mp4)

<video src="docs/northwall-agentic-soc-demo.mp4" controls width="100%"></video>

### Connect a source

Pick a GitHub repo and branch. Northwall keeps provider tokens server-side.

![Northwall source selection](docs/screenshots/soc-source-selection.png)

### Review the agent plan

Northwall builds source context first, then shows the investigation graph, agent team, task order, and approval notes before anything runs.

![Northwall agent plan](docs/screenshots/agent-plan.png)

### Watch the run

The run log shows what agents are doing, which findings were created, and what evidence was used.

![Northwall live SOC run](docs/screenshots/live-soc-run.png)

### Send work to owners

Findings are selected by the analyst, previewed as GitHub issues, and sent only after approval.

![Northwall findings handoff](docs/screenshots/findings-handoff.png)

### Mobile sign-in

![Northwall mobile login](docs/screenshots/login-mobile.png)

## Core Flow

```text
Connect source -> Build context -> Review plan -> Approve run -> Review findings -> Create GitHub issues
```

- GitHub OAuth for repo context and issue creation
- Repo, branch, package, route, auth, config, and CI inventory
- Investigation graph across services, routes, owners, dependencies, and work items
- Specialist agents with named responsibilities before the run starts
- Human approval before response actions
- Live Socket.IO event stream while agents work
- Findings with severity, confidence, evidence, owner notes, issue body, and labels

GitHub is the first connector. The same pattern can extend to SIEM, EDR, cloud, identity, ticketing, and evidence storage.

## How It Works

The backend keeps source and model credentials server-side.

When a user connects GitHub, Northwall stores the provider token through encrypted local persistence keyed by `TOKEN_ENCRYPTION_KEY`. The frontend only sees connection metadata: account, scopes, and connection time.

When a run starts, the backend reads the selected repo through the GitHub API and inventories the files that usually matter during response:

- package manifests and lockfiles
- API routes and handlers
- auth, session, tenant, middleware, and permission files
- environment and config files
- GitHub Actions and CI files
- service ownership and work item context

OpenAI GPT-5.5 runs on the backend. It turns the source inventory into an agent plan and owner handoff drafts. The prompts stay defensive: owned systems, concrete evidence, no third-party targets, no destructive actions, no exploit payloads.

## Packages

| Package | Role |
| --- | --- |
| `@northwall/frontend` | Next.js app, source picker, investigation graph, plan approval, live run, findings table |
| `@northwall/backend` | Hono API, GitHub integration, assessment worker, OpenAI planning, Socket.IO events |
| `@northwall/shared` | Zod schemas for repos, runs, graphs, plans, findings, and issue payloads |
| `@northwall/agent-runtime` | Agent runtime kept for deeper worker expansion |
| `@northwall/agent-control` | Sandbox control service kept for future runtime checks |

## Stack

- Next.js 15
- React 19
- Tailwind CSS
- Hono
- Socket.IO
- Zod
- Supabase Auth
- GitHub REST API
- OpenAI SDK with Azure-compatible `OPENAI_BASE_URL`

## Local Setup

Install dependencies:

```bash
npm install
cp .env.example .env
```

Set backend secrets in `.env`:

```bash
OPENAI_BASE_URL=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.5
TOKEN_ENCRYPTION_KEY=
```

For local development without Supabase, use a server-side GitHub token:

```bash
DEV_AUTH_BYPASS=true
GITHUB_TOKEN=
GITHUB_ACCOUNT=
```

Start the backend:

```bash
npm run dev:backend
```

Start the frontend:

```bash
NEXT_PUBLIC_DEV_AUTH_BYPASS=true \
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000 \
npm run dev:frontend
```

Open:

```text
http://localhost:3000
http://localhost:3000/workspace
```

## Production Auth

Northwall uses Supabase GitHub OAuth for the first connector.

Configure GitHub as the provider in Supabase and request repo access for private repository read plus issue creation.

Required environment:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Backend JWT issuer/JWKS lookup |
| `NEXT_PUBLIC_SUPABASE_URL` | Frontend Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend Supabase anon key |
| `TOKEN_ENCRYPTION_KEY` | Encrypts stored GitHub provider tokens |
| `OPENAI_BASE_URL` | Azure/OpenAI-compatible endpoint |
| `OPENAI_API_KEY` | Backend-only model key |
| `OPENAI_MODEL` | Defaults to `gpt-5.5` |

## Safety Boundaries

Northwall is for owned systems and authorized security operations work.

It starts with safe triage, static context, dependency context, and owner handoff. It does not run third-party scanning, destructive tests, credential collection, persistence checks, or weaponized exploit output.

The output is plain: what happened, why it matters, what evidence supports it, who owns it, and what work item should be created.

## Work With Us

We build products like this for teams that want agentic security operations without turning the SOC into a black box.

![Inferensys](docs/inferensys.svg)

Talk to [Inferensys](https://inferensys.com/) or contact us at [inferensys.com/contact](https://inferensys.com/contact).
