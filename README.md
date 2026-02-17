<div align="center">

# Agent Forge

### Autonomous AI Agent Runtime

Turn any CLI AI tool into an autonomous agent system.<br>
Persistent memory. Pluggable backends. Cyberpunk dashboard.

[Quick Start](#quick-start) &bull; [Architecture](#architecture) &bull; [Features](#features) &bull; [Development](#development) &bull; [Roadmap](#roadmap)

</div>

---

## What is this?

An open-source **runtime template** that wraps CLI AI tools (`claude -p`, Codex CLI, Gemini CLI) into an agent system with:

- A **Conductor** — AI agent that responds to messages, searches memory for context, and delegates to specialist agents
- An **Agent Pool** of AI agents with pluggable backends (per-agent backend selection)
- **Persistent Memory** with vector search (LanceDB) and structured storage (SQLite)
- A real-time **Cyberpunk Dashboard** with streaming chat, agent management, and debug console
- **Scheduled tasks** via Cron Manager (planned)

**This is not a product. It's the engine.** Fork it, add your agent definitions and domain data, ship your product.

```
              This Template (Engine)
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
   ┌─────────┐  ┌──────────┐  ┌──────────┐
   │  Your   │  │  Your    │  │  Your    │
   │  OaaS   │  │  QA Team │  │  Content │
   │ Product │  │ Product  │  │ Product  │
   └─────────┘  └──────────┘  └──────────┘
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                    Runtime Container (Bun)                            │
│                                                                      │
│  ┌────────────────┐    ┌──────────────────────────────────────────┐  │
│  │   Bun.serve    │    │       Conductor (AI Agent)               │  │
│  │   HTTP + WS    │───▶│                                          │  │
│  │                │    │  ┌────────────┐  ┌───────────────────┐   │  │
│  │  /health       │    │  │  Memory    │  │  AI Response      │   │  │
│  │  /api/*        │    │  │  Search    │  │  (CLIBackend)     │   │  │
│  │  /ws/chat      │    │  └────────────┘  └───────────────────┘   │  │
│  │  /ws/debug     │    │         │                                │  │
│  └────────────────┘    │         ▼                                │  │
│                        │  ┌─────────────┐     ┌──────────────┐    │  │
│                        │  │ Agent Pool  │     │    Memory     │    │  │
│                        │  │             │     │              │    │  │
│                        │  │ Agent #1    │     │ bun:sqlite   │    │  │
│                        │  │ Agent #2    │     │ LanceDB      │    │  │
│                        │  │ Agent #N    │     │ Naive RAG    │    │  │
│                        │  └─────────────┘     └──────────────┘    │  │
│                        └──────────────────────────────────────────┘  │
│                                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────────┐  │
│  │  DebugBus   │  │ ActivityLog  │  │    Cron Manager (planned)  │  │
│  └─────────────┘  └──────────────┘  └────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                  Dashboard (Next.js 16.1)                             │
│  ┌──────┐ ┌────────┐ ┌──────┐ ┌──────────┐ ┌────────┐ ┌──────────┐ │
│  │ Home │ │ Agents │ │ Chat │ │ Activity │ │ Memory │ │Automation│ │
│  │ SSR  │ │  CRUD  │ │  WS  │ │  Debug   │ │ (stub) │ │  (stub)  │ │
│  └──────┘ └────────┘ └──────┘ └──────────┘ └────────┘ └──────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

### Conductor Pipeline

Every message flows through a simple pipeline:

```
Message In ──▶ Memory Search ──▶ Respond or Delegate ──▶ Memory Store ──▶ Response Out
                 (context)       (AI backend / agent)     (if valuable)    (stream WS)
```

The Conductor is a simple AI agent: it searches memory for context, then either responds directly via its AI backend or delegates to a specific agent when `targetAgentId` is set.

---

## Features

### Pluggable AI Backends
Swap AI providers without changing code. Any CLI tool that reads stdin and writes stdout works. `claude -p` is the default. Codex CLI, Gemini CLI, and Goose slot in via the `CLIBackend` interface. Each agent can use a different backend via the BackendRegistry.

### Persistent Dual-Storage Memory
Structured data in bun:sqlite (WAL mode) + vector embeddings in LanceDB. Naive RAG engine: embed query, vector search, hydrate from SQLite. Memory persists across sessions and agent restarts.

### Agent Lifecycle Management
Full CRUD for AI agents with serial message queues, idle timeout auto-shutdown, configurable pool limits, session persistence (`--resume` flags), and ownership-based permissions (user-created vs conductor-created agents).

### Real-time Dashboard
Cyberpunk-themed Next.js dashboard with glass-morphism cards, neon accents, and scanline effects. SSR for initial load, WebSocket for live updates. Includes streaming chat, agent cards with backend/status badges, and a full debug console.

### Observability Built In
DebugBus (ring buffer + pub/sub) streams events across 5 categories (conductor, agent, memory, websocket, system) to a filterable debug console with pause/resume, search, and JSON expansion.

### Pipeline Visualization
See exactly how the Conductor processes each message: which phase it's in, timing data per step — all rendered live in the chat UI.

---

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.2+
- [Claude CLI](https://docs.anthropic.com/en/docs/claude-cli) (for the default `claude -p` backend)

### Development Mode

```bash
# Clone
git clone https://github.com/your-org/agent-forge.git
cd agent-forge

# Install dependencies
bun install

# Start everything (runtime + dashboard)
bun run dev

# Or start individually
bun run dev:runtime    # Runtime server on :3000
bun run dev:dashboard  # Dashboard on :3001
```

### Docker (Coming Soon)

```bash
docker-compose up
```

### Run Tests

```bash
bun run test           # All packages (437 tests)
bun run typecheck      # TypeScript checking
bun run lint           # Biome linting
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun + TypeScript |
| Monorepo | Bun workspaces + Turborepo v2 |
| Frontend | Next.js 16.1 + Tailwind CSS 4 + shadcn/ui |
| Backend | Bun.serve (HTTP + WebSocket) |
| Structured DB | bun:sqlite (embedded, WAL mode) |
| Vector DB | LanceDB (embedded) |
| AI Backend | `claude -p` (default), pluggable |
| Linter | Biome 2.4+ |
| Tests | bun:test |

---

## Project Structure

```
agent-forge/
├── packages/
│   ├── shared/          # Types, interfaces, constants
│   ├── agent-manager/   # CLIBackend, AgentProcess, AgentPool, BackendRegistry
│   ├── memory/          # SQLite + LanceDB + Naive RAG
│   ├── conductor/       # Simple AI agent with memory + delegation
│   ├── cron-manager/    # Scheduled tasks (planned)
│   └── server/          # Bun.serve HTTP + WebSocket + routes
├── dashboard/           # Next.js 16.1 cyberpunk dashboard
├── docs/
│   ├── SPEC.md          # Full specification (single source of truth)
│   └── CLI-BACKEND-RESEARCH.md  # Backend capabilities research
├── package.json         # Monorepo root
├── turbo.json           # Turborepo config
└── biome.json           # Linter config
```

### Package Dependencies

```
@autonomy/shared
       │
       ├──▶ @autonomy/agent-manager
       ├──▶ @autonomy/memory
       └──▶ @autonomy/cron-manager
                    │
                    ▼
            @autonomy/conductor
                    │
                    ▼
             @autonomy/server  ◀──  dashboard (HTTP + WS)
```

---

## Development

```bash
# Install
bun install

# Development (all packages + dashboard)
bun run dev

# Individual packages
bun run dev:runtime          # Server only
bun run dev:dashboard        # Dashboard only

# Testing
bun run test                 # All tests
bun test packages/conductor  # Single package

# Code quality
bun run lint                 # Check
bun run lint:fix             # Auto-fix
bun run typecheck            # Type checking
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | System health + uptime |
| GET | `/api/agents` | List all agents |
| POST | `/api/agents` | Create agent |
| DELETE | `/api/agents/:id` | Delete agent |
| POST | `/api/agents/:id/restart` | Restart agent |
| GET | `/api/memory/search?q=` | Semantic search |
| POST | `/api/memory/ingest` | Store to memory |
| GET | `/api/memory/stats` | Memory statistics |
| GET | `/api/activity` | Activity log |
| GET | `/api/config` | Runtime config |

### WebSocket

- **`/ws/chat`** — Chat with streaming responses, conductor status events, agent status broadcasts
- **`/ws/debug`** — Real-time debug event stream with history replay

---

## Roadmap

### Core Template (Steps 1-7) ✅

- [x] **Monorepo scaffold** — Bun workspaces + Turborepo + Biome
- [x] **Agent Manager** — CLIBackend abstraction, process lifecycle, pool management
- [x] **Memory System** — SQLite + LanceDB + Naive RAG
- [x] **Conductor** — AI agent with memory search + delegation
- [x] **Server** — REST API + WebSocket + graceful shutdown
- [x] **Dashboard** — Cyberpunk UI with chat, agents, debug console
- [x] **Backend Registry** — Per-agent backend selection, session support

### Next Up

- [ ] **Step 8: Cron Manager** — CronManager class, workflow executor, server routes, dashboard Automation page
- [ ] **Step 9: Docker** — Dockerfile.runtime, Dockerfile.dashboard, docker-compose.yaml, config update API
- [ ] **Step 10: Advanced Memory** — Graph RAG, Agentic RAG, file ingest (PDF/CSV/TXT), dashboard Memory browser
- [ ] **Channel Adapters** — Telegram, Discord, Slack (extension point)
- [ ] **Step 11: Control Plane** — Container orchestration, auth, billing (optional, cloud mode)

---

## Extending the Template

This template is designed to be forked and extended. Products add:

1. **Custom Conductor logic** — routing, permissions, personality, question tracking
2. **Agent definitions** — roles, prompts, tools
3. **Domain data** — ingest into memory via API or dashboard
4. **Channel adapters** — webhook handlers for messaging platforms
5. **Additional dashboard pages** — product-specific UI
6. **Organization templates** — YAML-based agent team definitions

---

## Contributing

Contributions welcome. Please read the spec at `docs/SPEC.md` before contributing.

```bash
# Fork, clone, create branch
git checkout -b feat/your-feature

# Make changes, test, lint
bun run test && bun run lint

# Submit PR
```

---

## License

TBD

---

<div align="center">

**Built with Bun, TypeScript, and Claude.**

[Report Bug](../../issues) &bull; [Request Feature](../../issues)

</div>
