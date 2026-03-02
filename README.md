<div align="center">

# AI-Powered Knowledge Hub

### Multi-Source RAG SaaS Platform

Connect any data source. Ask questions in natural language.<br>
Get AI-powered answers with citations — embedded anywhere.

[What is this?](#what-is-this) &bull; [Architecture](#architecture-overview) &bull; [Current State](#current-state) &bull; [Quick Start](#quick-start)

</div>

---

## What is this?

A **B2B SaaS platform** that lets organizations connect diverse data sources — databases, documents, SaaS tools — and interact with them through an AI-powered chatbot interface.

- **Accept any data source** — SQL/NoSQL databases, PDFs, Excel, Notion, Slack, Jira, ERP systems
- **AI agent finds answers** — intelligent orchestration across 5 RAG strategies (vector, code, graph, SQL, logical reasoning)
- **Embeddable widget** — drop a chat widget into any customer website with a single script tag
- **Multi-tenant by design** — logical isolation with Row Level Security, per-tenant connectors and permissions

Built on the [Agent Forge](https://github.com/fysoul17/agent-forge) autonomous agent engine, which provides the conductor, agent pool, plugin system, and memory infrastructure.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                      PRESENTATION                        │
│   Dashboard (Next.js)  ·  Embeddable Widget  ·  API      │
└────────────────────────────┬─────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────┐
│                   AGENTIC RAG SYSTEM                     │
│                                                          │
│   Orchestration: Ingestion Agent · Retrieval Agent       │
│                  Evaluation Agent                        │
│                                                          │
│   Strategies:  VectorRAG · CodeRAG · GraphRAG            │
│                Text2SQL  · KAG (logical reasoning)       │
└────────────────────────────┬─────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ Supabase │  │  Qdrant  │  │  Neo4j   │
        │ (Auth,DB,│  │ (Vector  │  │ (Graph   │
        │ Storage) │  │  Search) │  │  Search) │
        └──────────┘  └──────────┘  └──────────┘
```

See [`docs/architecture.md`](docs/architecture.md) for the full architecture specification including data flows, RAG strategy details, widget security, and agentic orchestration.

---

## Current State

This project is in active development. The Agent Forge engine layer is functional; the product-specific RAG SaaS features are being built on top.

### What's working today

| Layer | Status |
|-------|--------|
| **Agent Forge engine** | Conductor, agent pool, plugin system, cron manager |
| **pyx-memory integration** | Vector search (LanceDB), structured storage (SQLite), Graph RAG (Neo4j), file ingestion, lifecycle management |
| **5 AI backends** | Claude, Codex, Gemini, Pi, Ollama — per-agent backend selection via BackendRegistry |
| **Cyberpunk dashboard** | Next.js 16.1 — chat, agents, memory browser, debug console, sessions, settings |
| **Observability** | DebugBus ring buffer, pipeline visualization, activity log |
| **Docker deployment** | Runtime + dashboard + optional memory server & Neo4j |
| **CI/CD** | GitHub Actions — lint, typecheck, unit tests, E2E (27 scenarios), Docker build |

### What's next

The product layers described in the architecture spec: multi-tenant auth, document ingestion pipeline, agentic RAG orchestration, embeddable widget, and SaaS connectors.

---

## Product Roadmap

| Phase | Focus | Key Deliverables |
|-------|-------|-----------------|
| **Phase 1** (Foundation) | Auth, upload, basic search | Multi-tenant auth, file upload, VectorRAG, basic chat & widget |
| **Phase 2** (Multi-Strategy) | Expand retrieval | CodeRAG, Text2SQL, SaaS connectors, basic agent orchestration, monitoring |
| **Phase 3** (Full Agentic) | Intelligent orchestration | GraphRAG, KAG, ingestion/retrieval/evaluation agents, full orchestration |
| **Phase 4+** (Enterprise) | Scale & compliance | Public API, plan tiers, on-premise deployment, custom connector SDK, SOC2 |

See [`docs/architecture.md` §12](docs/architecture.md#12-implementation-phases) for detailed phase breakdowns.

---

## Tech Stack

| Layer | Current (Engine) | Planned (Product) |
|-------|-----------------|-------------------|
| Runtime | Bun + TypeScript | — |
| Monorepo | Bun workspaces + Turborepo v2 | — |
| Frontend | Next.js 16.1 + Tailwind CSS 4 + shadcn/ui | — |
| Backend | Bun.serve (HTTP + WebSocket) | Next.js Server Actions + Route Handlers |
| Auth | — | Supabase Auth (RLS) |
| Structured DB | bun:sqlite (WAL mode) | Supabase (PostgreSQL) |
| Vector DB | LanceDB (embedded) | Qdrant |
| Graph DB | Neo4j (via pyx-memory) | Neo4j AuraDB |
| AI | Claude CLI + 4 other backends | Claude API (native tool use) |
| Background Jobs | Cron Manager | Trigger.dev |
| SaaS Connectors | — | Nango |
| Doc Processing | — | Docling + Tree-sitter |
| Linter | Biome 2.4+ | — |
| Tests | bun:test | — |

---

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.2+
- [Claude CLI](https://docs.anthropic.com/en/docs/claude-cli) (for the default `claude -p` backend)

### Development Mode

```bash
# Clone (include submodules for pyx-memory)
git clone --recurse-submodules https://github.com/fysoul17/ai-rag-hub.git
cd ai-rag-hub

# Or if already cloned without submodules:
git submodule update --init --recursive

# Install dependencies
bun install

# Start everything (runtime + dashboard)
bun run dev

# Or start individually
bun run dev:runtime    # Runtime server on :7820
bun run dev:dashboard  # Dashboard on :7821
```

### Docker

```bash
# Minimal — runtime (:7820) + dashboard (:7821)
docker compose -f docker/docker-compose.yaml up

# Full stack — adds memory server (:7822) + Neo4j (:7474/:7687)
docker compose -f docker/docker-compose.yaml --profile full up
```

See `.env.example` or [`docs/SPEC.md` §12](docs/SPEC.md#12-environment-variables) for environment variables.

---

## Project Structure

```
ai-rag-hub/
├── packages/
│   ├── shared/          # Types, interfaces, constants
│   ├── agent-manager/   # CLIBackend, AgentProcess, AgentPool, BackendRegistry
│   ├── conductor/       # AI agent with memory + delegation
│   ├── cron-manager/    # Scheduled tasks
│   ├── plugin-system/   # Event hooks, middleware pipeline
│   └── server/          # Bun.serve HTTP + WebSocket + routes
├── vendor/
│   └── pyx-memory/      # Git submodule → fysoul17/pyx-memory-v1
├── dashboard/           # Next.js 16.1 cyberpunk dashboard
├── docker/              # Dockerfiles + docker-compose.yaml
├── docs/                # Specifications & research
└── turbo.json           # Turborepo config
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [`docs/SPEC.md`](docs/SPEC.md) | Agent Forge engine specification (runtime, API, WebSocket) |
| [`docs/architecture.md`](docs/architecture.md) | Product architecture — RAG strategies, orchestration, data flows |
| [`docs/design-system.md`](docs/design-system.md) | Cyberpunk design system tokens and guidelines |
| [`docs/CLI-BACKEND-RESEARCH.md`](docs/CLI-BACKEND-RESEARCH.md) | CLI backend comparison and research |

---

## Development

```bash
bun install               # Install dependencies
bun run dev               # All packages + dashboard
bun run dev:runtime       # Server only
bun run dev:dashboard     # Dashboard only

bun run test              # All tests
bun run typecheck         # Type checking
bun run lint              # Check
bun run lint:fix          # Auto-fix
```

---

## License

MIT

---

<div align="center">

**Built with Bun, TypeScript, and Claude.**

</div>
