# Autonomous AI Agent Runtime — Product Discovery & Feature Documentation

> Auto-generated from codebase scan on 2026-02-16
> Includes competitive analysis and multi-specialist strategic directions
> See also: `ARCHITECTURE-V2.md` (hierarchical security model), `CLI-BACKEND-RESEARCH.md` (session persistence)

## Overview

An open-source template runtime that turns CLI AI tools (`claude -p`, Codex CLI, Gemini CLI) into a **24/7 autonomous multi-agent system** with persistent memory, a Conductor (Mother AI) orchestrator, accessible via messaging channels and a cyberpunk Dashboard UI. Positioned as **"Organization as a Service"** — an entire AI-powered team as a deployable unit.

**Template = Game Engine. Product = Game built on the engine.**

## Tech Stack

- **Runtime**: Bun (latest) + TypeScript 5+
- **Monorepo**: Bun workspaces + Turborepo v2
- **Frontend**: Next.js 16.1 (App Router) + Tailwind CSS 4 + shadcn/ui
- **Backend**: Bun.serve (HTTP + WebSocket)
- **Structured DB**: bun:sqlite (embedded, WAL mode)
- **Vector DB**: LanceDB (embedded default), Qdrant (optional)
- **AI Backend**: `claude -p` (default), pluggable via CLIBackend interface
- **Linter**: Biome 2.4+
- **Tests**: bun:test (500+ tests, 800+ assertions)
- **CI**: GitHub Actions

---

## System Architecture (Visual)

### 1. High-Level System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DEPLOYMENT BOUNDARY                            │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    Runtime Container (Bun)                        │  │
│  │                                                                   │  │
│  │  ┌─────────────┐    ┌──────────────────────────────────────────┐  │  │
│  │  │  Bun.serve   │    │         Conductor (Mother AI)            │  │  │
│  │  │  HTTP + WS   │───▶│  ┌─────────┐  ┌──────────┐  ┌───────┐  │  │  │
│  │  │             │    │  │AI Router │  │ Keyword  │  │Permis.│  │  │  │
│  │  │ /health     │    │  │(claude-p)│  │ Fallback │  │Checker│  │  │  │
│  │  │ /api/*      │    │  └─────────┘  └──────────┘  └───────┘  │  │  │
│  │  │ /ws/chat    │    │                    │                     │  │  │
│  │  │ /ws/debug   │    │           ┌────────┴────────┐           │  │  │
│  │  └─────────────┘    │           ▼                 ▼           │  │  │
│  │                      │  ┌──────────────┐  ┌──────────────┐    │  │  │
│  │                      │  │  AgentPool    │  │   Memory     │    │  │  │
│  │                      │  │              │  │              │    │  │  │
│  │                      │  │ ┌──────────┐ │  │ ┌──────────┐ │    │  │  │
│  │                      │  │ │Agent #1  │ │  │ │bun:sqlite│ │    │  │  │
│  │                      │  │ │claude -p │ │  │ │(struct.) │ │    │  │  │
│  │                      │  │ ├──────────┤ │  │ ├──────────┤ │    │  │  │
│  │                      │  │ │Agent #2  │ │  │ │ LanceDB  │ │    │  │  │
│  │                      │  │ │codex CLI │ │  │ │(vectors) │ │    │  │  │
│  │                      │  │ ├──────────┤ │  │ └──────────┘ │    │  │  │
│  │                      │  │ │Agent #N  │ │  │              │    │  │  │
│  │                      │  │ │gemini    │ │  │ ┌──────────┐ │    │  │  │
│  │                      │  │ └──────────┘ │  │ │Naive RAG │ │    │  │  │
│  │                      │  └──────────────┘  │ └──────────┘ │    │  │  │
│  │                      │                     └──────────────┘    │  │  │
│  │                      └──────────────────────────────────────────┘  │  │
│  │                                                                   │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────────┐  │  │
│  │  │  DebugBus   │  │ ActivityLog │  │    Cron Manager (TBD)    │  │  │
│  │  │ (ring buf)  │  │ (ring buf)  │  │    scheduled tasks       │  │  │
│  │  └─────────────┘  └─────────────┘  └──────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                   Dashboard (Next.js 16.1)                        │  │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌────────┐ ┌──────┐ ┌────────────┐  │  │
│  │  │ Home │ │Agents│ │ Chat │ │Activity│ │Memory│ │  Settings  │  │  │
│  │  │ SSR  │ │ CRUD │ │  WS  │ │ Debug  │ │(TBD) │ │   (TBD)    │  │  │
│  │  └──────┘ └──────┘ └──────┘ └────────┘ └──────┘ └────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
         ▲              ▲                ▲
         │              │                │
    ┌────┴────┐   ┌─────┴─────┐   ┌─────┴─────┐
    │Dashboard│   │ Telegram  │   │  Discord   │
    │  (Web)  │   │  (TBD)    │   │   (TBD)    │
    └─────────┘   └───────────┘   └───────────┘
```

### 2. Package Dependency Graph

```
                    ┌──────────────────┐
                    │  @autonomy/shared │ ◄─── types, interfaces, constants
                    └────────┬─────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
            ▼                ▼                ▼
  ┌─────────────────┐ ┌───────────┐ ┌──────────────┐
  │ @autonomy/       │ │@autonomy/ │ │ @autonomy/    │
  │ agent-manager    │ │  memory   │ │ cron-manager  │
  │                  │ │           │ │   (Step 8)    │
  │ • CLIBackend     │ │ • SQLite  │ └──────┬───────┘
  │ • AgentProcess   │ │ • LanceDB │        │
  │ • AgentPool      │ │ • NaiveRAG│        │
  └────────┬─────────┘ └─────┬─────┘        │
           │                  │              │
           └────────┬─────────┘              │
                    │                        │
                    ▼                        │
          ┌─────────────────┐                │
          │  @autonomy/      │                │
          │  conductor       │ ◄──────────────┘
          │                  │
          │ • AI Router      │
          │ • Permissions    │
          │ • ActivityLog    │
          │ • Pipeline       │
          └────────┬─────────┘
                   │
                   ▼
          ┌─────────────────┐       ┌─────────────────────┐
          │  @autonomy/      │       │  @autonomy/dashboard │
          │  server          │◄──────│  (Next.js 16.1)      │
          │                  │ HTTP  │                       │
          │ • Bun.serve      │  +    │ • SSR pages           │
          │ • REST routes    │  WS   │ • Client components   │
          │ • WebSocket      │       │ • Cyberpunk theme     │
          │ • DebugBus       │       └───────────────────────┘
          └──────────────────┘
```

### 3. Conductor Message Pipeline (5-Step Flow)

```
    Incoming Message
          │
          ▼
┌─────────────────────┐
│  STEP 1: MEMORY     │  Search for relevant context
│  SEARCH             │  (non-fatal — continues if fails)
│                     │
│  query → LanceDB   │──▶ vector similarity search
│         → SQLite    │──▶ hydrate full entries
│                     │
│  Output: memory     │
│  context (may be ∅) │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  STEP 2: ROUTING    │  Decide what to do with the message
│                     │
│  ┌───────────────┐  │
│  │ AI Router     │  │  Send message + memory + agent list
│  │ (claude -p)   │──┼──▶ Returns JSON: { action, target,
│  └───────┬───────┘  │     confidence, reasoning }
│          │ fail?    │
│          ▼          │  Actions:
│  ┌───────────────┐  │  • respond_directly
│  │Keyword Router │  │  • delegate_to_agent
│  │  (fallback)   │  │  • create_agent
│  └───────────────┘  │  • pipeline (multi-agent)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  STEP 3: DISPATCH   │  Execute the routing decision
│                     │
│  ┌─ respond_directly ──▶ Conductor answers itself
│  │
│  ├─ delegate_to_agent ─▶ Send to existing agent
│  │                        (with memory context tags)
│  │
│  ├─ create_agent ───────▶ Validate → Create → Delegate
│  │                        (security blocklist check)
│  │
│  └─ pipeline ───────────▶ Sequential relay through
│                            multiple agents (accum. context)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  STEP 4: MEMORY     │  AI decides if response is worth
│  STORE              │  remembering (storeInMemory flag)
│                     │
│  Store if valuable → │  bun:sqlite (structured)
│                      │  + LanceDB (vector embedding)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  STEP 5: RESPONSE   │  Stream back to user
│                     │
│  WebSocket chunks  ──▶ Dashboard (real-time)
│  conductor_status  ──▶ Pipeline visualization
│  debug_events      ──▶ Debug console
└─────────────────────┘
```

### 4. Data Flow & Storage

```
                          ┌─────────────────────────────┐
                          │       User Message           │
                          └──────────────┬──────────────┘
                                         │
                    ┌────────────────────┐│┌────────────────────┐
                    │   HTTP REST API    │││   WebSocket        │
                    │   /api/*           │││   /ws/chat         │
                    │                    │││   /ws/debug        │
                    └────────┬───────────┘│└─────────┬──────────┘
                             │            │          │
                             ▼            ▼          ▼
                       ┌──────────────────────────────────┐
                       │           Conductor               │
                       └──────────┬────────────┬──────────┘
                                  │            │
                    ┌─────────────┘            └──────────────┐
                    ▼                                          ▼
           ┌────────────────┐                        ┌────────────────┐
           │   Agent Pool   │                        │  Memory System │
           │                │                        │                │
           │ Each agent is  │                        │ Dual Storage:  │
           │ a CLI process: │                        │                │
           │                │                        │ ┌────────────┐ │
           │ stdin ──▶ AI   │                        │ │ bun:sqlite │ │
           │ stdout ◀── AI  │                        │ │            │ │
           │                │                        │ │ Tables:    │ │
           │ Supported:     │                        │ │ • entries  │ │
           │ • claude -p    │                        │ │ • edges    │ │
           │ • codex        │                        │ ├────────────┤ │
           │ • gemini       │                        │ │  LanceDB   │ │
           │ • any CLI      │                        │ │            │ │
           └────────────────┘                        │ │ • vectors  │ │
                                                     │ │ • cosine   │ │
                                                     │ │   search   │ │
                                                     │ └────────────┘ │
                                                     │                │
                                                     │ ┌────────────┐ │
                                                     │ │ Naive RAG  │ │
                                                     │ │ embed →    │ │
                                                     │ │ search →   │ │
                                                     │ │ hydrate    │ │
                                                     │ └────────────┘ │
                                                     └────────────────┘
```

### 5. Deployment Architecture

```
┌─── Self-Hosted (docker-compose up) ──────────────────────────────────┐
│                                                                       │
│  ┌─────────────────────┐      ┌─────────────────────┐                │
│  │  runtime container  │      │ dashboard container  │                │
│  │                     │      │                      │                │
│  │  Bun.serve          │◄────▶│  Next.js 16.1        │                │
│  │  + Conductor        │ HTTP │  + Tailwind v4       │                │
│  │  + Agent Pool       │  +   │  + shadcn/ui         │                │
│  │  + Memory           │  WS  │                      │                │
│  │  + Cron Manager     │      │  Port 3001           │                │
│  │                     │      └─────────────────────┘                │
│  │  Port 3000          │                                              │
│  └─────────┬───────────┘                                              │
│            │                                                          │
│  ┌─────────▼───────────┐                                              │
│  │  Volumes            │                                              │
│  │  ./data/memory/  → bun:sqlite                                     │
│  │  ./data/vectors/ → LanceDB                                        │
│  └─────────────────────┘                                              │
│                                                                       │
│  Single user • No auth needed • All data local • Free forever        │
└───────────────────────────────────────────────────────────────────────┘

┌─── Cloud Mode (Planned — Step 11) ───────────────────────────────────┐
│                                                                       │
│  ┌──────────────────┐                                                 │
│  │  Control Plane   │  Auth, billing, container orchestration         │
│  │  (Fly.io/K8s)    │                                                 │
│  └────────┬─────────┘                                                 │
│           │                                                           │
│    ┌──────┴──────┬──────────────┐                                     │
│    ▼             ▼              ▼                                     │
│  ┌──────┐  ┌──────────┐  ┌──────────┐                                │
│  │User A│  │  User B  │  │  User C  │  Isolated containers           │
│  │runtime│ │  runtime │  │  runtime │  per tenant                    │
│  └──────┘  └──────────┘  └──────────┘                                │
│                                                                       │
│  Multi-tenant • SSO/OAuth • Per-seat billing • SLA                   │
└───────────────────────────────────────────────────────────────────────┘
```

### 6. WebSocket Protocol

```
  Dashboard (Browser)                    Server (Bun.serve)
       │                                       │
       │──── { type: "message",  ──────────▶  │
       │       content: "...",                  │
       │       agentId?: "..." }                │
       │                                       │
       │                              ┌────────┴─────────┐
       │                              │    Conductor      │
       │                              │    Pipeline       │
       │                              └────────┬─────────┘
       │                                       │
       │  ◀── { type: "conductor_status",  ────│  (routing phase)
       │        action: "analyzing" }           │
       │                                       │
       │  ◀── { type: "conductor_status",  ────│  (delegation)
       │        action: "delegating",           │
       │        agentId: "..." }                │
       │                                       │
       │  ◀── { type: "chunk",  ───────────────│  (streaming)
       │        content: "partial..." }         │
       │                                       │
       │  ◀── { type: "complete",  ────────────│  (done)
       │        content: "full response",       │
       │        pipeline_steps: [...] }         │
       │                                       │
       │  ◀── { type: "agent_status",  ────────│  (every 5s)
       │        agents: [...] }                 │
       │                                       │
       │──── { type: "ping" }  ────────────▶  │  (keepalive)
       │  ◀── { type: "pong" }  ───────────────│
       │                                       │
```

---

## Features

### 1. Conductor (Mother AI) — Intelligent Orchestrator

**Status**: Implemented

The system-level AI orchestrator that cannot be deleted, receives all messages first, and routes/delegates/synthesizes across the agent pool. Supports both AI-powered and keyword-based routing with automatic fallback.

**Key Files**:
- `packages/conductor/src/conductor.ts` — main orchestrator class (5-step pipeline)
- `packages/conductor/src/conductor-prompt.ts` — AI routing prompts + security validation
- `packages/conductor/src/router.ts` — dual routing system (AI + keyword fallback)
- `packages/conductor/src/permissions.ts` — ownership-based access control

**Capabilities**:
- AI routing: analyzes message + memory context + available agents, returns JSON routing decision
- Dynamic agent creation: creates specialist agents on the fly when no suitable agent exists
- Memory-augmented delegation: wraps memory context in `<memory-context>` tags
- MaxAgents eviction: evicts idle conductor-owned agents when pool is full
- Delegation depth limiting (default: 5) to prevent infinite loops
- Security validation: blocklists dangerous patterns in AI-generated prompts
- Activity logging: ring buffer tracking all conductor actions
- ConductorEvent callback system for real-time status

**Dependencies**: @autonomy/shared, @autonomy/agent-manager, @autonomy/memory, nanoid

---

### 2. Agent Lifecycle Management

**Status**: Implemented

Full CRUD for AI agent processes backed by pluggable CLI backends. Manages process spawn, communication, idle timeout, and pool limits.

**Key Files**:
- `packages/agent-manager/src/agent-process.ts` — individual agent lifecycle
- `packages/agent-manager/src/agent-pool.ts` — pool with maxAgents enforcement
- `packages/agent-manager/src/backends/claude.ts` — Claude CLI backend
- `packages/agent-manager/src/backends/types.ts` — CLIBackend interface

**Capabilities**:
- Spawn/stop/restart agent processes
- Serial message queue per agent
- Configurable idle timeout auto-shutdown
- Backend abstraction: any CLI tool implementing CLIBackend interface
- Environment allowlist for security
- Mock backend for testing

**Dependencies**: Bun.spawn, nanoid

---

### 3. Persistent Memory System

**Status**: Implemented (Naive RAG). Graph RAG & Agentic RAG planned.

Dual-storage memory with bun:sqlite for structured data and LanceDB for vector embeddings. Supports short-term (session) and long-term (persistent) memory types.

**Key Files**:
- `packages/memory/src/memory.ts` — unified Memory class
- `packages/memory/src/sqlite-store.ts` — SQLite CRUD with WAL mode
- `packages/memory/src/providers/lancedb.ts` — vector search provider
- `packages/memory/src/rag/naive.ts` — Naive RAG engine

**Capabilities**:
- Store/search/get/delete memory entries
- Vector similarity search (cosine) via LanceDB
- SQLite hydration of vector results
- Session-scoped clearing
- Memory statistics
- Embedding provider injection (no API key dependency in core)

**Dependencies**: @lancedb/lancedb, bun:sqlite, nanoid

---

### 4. REST API & WebSocket Server

**Status**: Implemented (core endpoints functional, some stubs)

Bun.serve-based HTTP + WebSocket server wiring all packages together. Supports real-time streaming, agent status broadcasts, and debug event streaming.

**Key Files**:
- `packages/server/src/index.ts` — entry point, bootstraps all services
- `packages/server/src/websocket.ts` — chat + debug WebSocket handlers
- `packages/server/src/router.ts` — pattern-based URL routing
- `packages/server/src/routes/` — 6 route modules

**Endpoints**:

| Endpoint | Status | Description |
|----------|--------|-------------|
| `GET /health` | Working | System health + uptime + degraded detection |
| `GET /api/agents` | Working | List all agents with runtime info |
| `POST /api/agents` | Working | Create user-owned agent |
| `DELETE /api/agents/:id` | Working | Remove agent |
| `POST /api/agents/:id/restart` | Working | Restart agent process |
| `PUT /api/agents/:id` | Stubbed (501) | Update agent |
| `GET /api/memory/search` | Working | Semantic memory search |
| `POST /api/memory/ingest` | Working | Store to memory |
| `GET /api/memory/stats` | Working | Memory statistics |
| `GET /api/activity` | Working | Activity log (ring buffer) |
| `GET /api/config` | Working | Config with redacted keys |
| `PUT /api/config` | Stubbed (501) | Update config |
| `/api/crons/*` | Stubbed (501) | All cron endpoints |

**WebSocket** (`/ws/chat`):
- Ping/pong keepalive
- Message → Conductor → chunk streaming + complete
- conductor_status events (routing, creating_agent, delegating)
- agent_status broadcast every 5s
- Max 100 concurrent clients, 64KB message limit

**Debug WebSocket** (`/ws/debug`):
- Real-time debug event streaming
- History replay on connect
- Category filtering (conductor, agent, memory, websocket, system)

**Dependencies**: nanoid

---

### 5. Dashboard UI — Cyberpunk Agent Control Center

**Status**: 4 pages functional, 4 placeholder

Next.js 16.1 + Tailwind v4 + shadcn/ui dashboard with cyberpunk dark theme, glass-morphism, neon accents, and real-time WebSocket integration.

**Key Files**:
- `dashboard/app/page.tsx` — Home (SSR health/agents/memory stats)
- `dashboard/app/agents/page.tsx` — Agent management (CRUD + RPG cards)
- `dashboard/app/chat/page.tsx` — Real-time chat with streaming
- `dashboard/app/activity/page.tsx` — Debug console with filtering
- `dashboard/app/hooks/use-websocket.ts` — Chat WebSocket hook
- `dashboard/app/hooks/use-debug-websocket.ts` — Debug stream hook
- `dashboard/app/lib/api.ts` — Browser API client
- `dashboard/app/lib/api-server.ts` — SSR API client

**Functional Pages**:

| Page | Features |
|------|----------|
| **Home** `/` | System/Uptime/Agents/Memory status cards, recent activity feed, RuntimeOffline fallback |
| **Agents** `/agents` | Grouped by owner (system/conductor/user), create dialog, restart/delete, status badges |
| **Chat** `/chat` | Agent selector, streaming chunks, markdown rendering (GFM), pipeline step visualization, keyboard shortcuts |
| **Activity** `/activity` | Full debug console: category/level/search filters, pause/resume, copy all, expandable event data |

**Placeholder Pages**: Memory `/memory`, Automation `/automation`, Channels `/channels`, Settings `/settings`

**Dependencies**: next, react, react-markdown, remark-gfm, rehype-raw, lucide-react, radix-ui, shadcn/ui

---

### 6. Debug & Observability System

**Status**: Implemented

Real-time debug event bus with ring buffer, WebSocket streaming, and a full dashboard debug console with filtering.

**Key Files**:
- `packages/server/src/debug-bus.ts` — DebugBus (ring buffer + pub/sub)
- `dashboard/app/components/debug/debug-console.tsx` — Full debug UI
- `dashboard/app/components/debug/debug-toolbar.tsx` — Filters
- `dashboard/app/components/debug/debug-event-row.tsx` — Event display

**Capabilities**:
- 5 event categories: conductor, agent, memory, websocket, system
- 4 log levels: debug, info, warn, error
- Ring buffer (500 events, configurable)
- Real-time streaming to dashboard via WebSocket
- Filter by category, level, search text
- Pause/resume auto-scroll
- Copy filtered logs to clipboard
- Expandable JSON data payloads

---

### 7. Pipeline Visualization

**Status**: Implemented

Visual representation of the Conductor's processing pipeline in the chat interface, showing each step with timing data.

**Key Files**:
- `dashboard/app/components/chat/pipeline-summary-bar.tsx` — Collapsible summary
- `dashboard/app/components/chat/pipeline-timeline.tsx` — Step-by-step timeline
- `dashboard/app/components/chat/pipeline-constants.ts` — Phase configurations

**Phases Tracked**: memory_search, analyzing, routing_complete, creating_agent, delegating, delegation_complete, memory_store, responding

---

### 8. Markdown Rendering in Chat

**Status**: Implemented

GFM-compatible markdown rendering for chat messages with code blocks, tables, links, and lists.

**Key Files**:
- `dashboard/app/components/chat/markdown-renderer.tsx` — React-markdown wrapper
- `dashboard/app/components/chat/chat-message.tsx` — Message bubble component

**Dependencies**: react-markdown, remark-gfm, rehype-raw

---

## Architecture Notes

```
User (Dashboard/Channel/API)
    |
    v
Bun.serve (HTTP + WebSocket)
    |
    v
Conductor (Mother AI)
    |-- Memory Search (non-fatal)
    |-- AI/Keyword Routing
    |-- Agent Creation or Delegation
    |-- Memory Storage (AI-driven decision)
    |
    +---> AgentPool
    |       |-- AgentProcess (claude -p / codex / gemini)
    |       |-- AgentProcess
    |       +-- AgentProcess
    |
    +---> Memory System
            |-- bun:sqlite (structured)
            +-- LanceDB (vectors)
```

**Data flow**: User message -> WebSocket -> Conductor -> Memory search -> AI routing -> Agent delegation -> Streaming response -> Memory store -> User

**State management**: Server-side (agent pool state, memory). Dashboard uses SSR for initial data + WebSocket for real-time updates + `router.refresh()` for mutations.

## Integrations

| Service | Purpose | Config Location |
|---------|---------|----------------|
| claude -p | Default AI backend | `AI_BACKEND` env var |
| LanceDB | Vector embeddings | Embedded, `DATA_DIR/vectors/` |
| bun:sqlite | Structured storage | Embedded, `DATA_DIR/memory/` |
| Telegram (planned) | Channel adapter | `/webhook/telegram` |
| Discord (planned) | Channel adapter | `/webhook/discord` |
| Slack (planned) | Channel adapter | `/webhook/slack` |

## Not Yet Implemented

| Feature | Status | Priority |
|---------|--------|----------|
| **Cron Manager** | Step 8, next up | High |
| **Docker Deployment** | Step 9 | High |
| **Graph RAG** | Step 10 | Medium |
| **Agentic RAG** | Step 10 | Medium |
| **File Ingest** (PDF/CSV/TXT) | Step 10 | Medium |
| **Qdrant Provider** | Step 10 | Low |
| **A2A Direct Mode** (custom tools) | Deferred | Medium |
| **Control Plane** (cloud mode) | Step 11 | Low |
| **Channel Adapters** (Telegram/Discord/Slack) | Not started | Medium |
| **Memory Browser UI** | Dashboard Phase 5 | Medium |
| **Settings UI** | Dashboard Phase 7 | Low |
| **Onboarding Wizard** | Dashboard Phase 8 | Medium |
| **Agent Update API** | Stubbed (501) | Low |
| **Config Update API** | Stubbed (501) | Low |
| **Auth / Rate Limiting** | Not started | High (for cloud) |
| **Real Streaming** | Uses pre-buffered | Medium |

---

# Competitive Landscape & Strategic Analysis

> Researched from live web data, February 2026

## Market Context

| Metric | Data |
|--------|------|
| AI Agent market size (2025) | $7.6-7.8B |
| Projected (2026) | $10.9B |
| Projected (2030) | $50B+ |
| Enterprise apps with AI agents (2025) | <5% |
| Gartner prediction (end of 2026) | 40% |
| Multi-agent inquiry growth (Gartner) | +1,445% (Q1 2024 to Q2 2025) |
| Orgs using 3+ LLMs in production | 59% |

## Competitor Comparison

| Platform | Stars | Language | Multi-Agent | Self-Hosted | Free Tier | Pricing Model |
|----------|-------|----------|-------------|-------------|-----------|---------------|
| AutoGPT | 167k | Python | Limited | Yes | OSS | BYOK |
| OpenClaw | 200k | TypeScript | Config-based routing | Yes | OSS | BYOK |
| LangChain | 90k | Python/JS | Via LangGraph | Yes | OSS | $39/seat + traces |
| AutoGen | 50k | Python | Yes | Yes | OSS | Via Azure |
| n8n | 50k+ | TypeScript | Limited | Yes (free) | Unlimited | EUR24-800/mo cloud |
| CrewAI | 34-44k | Python | Yes | Yes | 50 exec/mo | $99-custom/mo |
| LangGraph | 14k | Python/JS | Yes | Yes | OSS | Usage-based |
| Google ADK | 10k | Python | Yes | Partial | OSS | GCP pricing |
| OpenAI Agents SDK | Growing | Python | Yes | Yes | OSS | BYOK |
| Devin | Closed | Closed | No | No | No | $20-500/mo |
| Agentforce | Closed | Closed | Yes | No | No | $125-650/user |
| **This Project** | -- | **TypeScript** | **Yes** | **Yes (free)** | **Full** | **Planned** |

## Deep Dive: OpenClaw (Primary Competitor)

> 200k stars, 35k forks, MIT license, TypeScript, daily releases. Created Nov 2025.

### What OpenClaw Is

A **personal AI assistant gateway** — a hub-and-spoke message proxy that connects one AI brain to 13+ messaging channels. It answers: "How do I talk to my AI from everywhere?"

**Core architecture**: Gateway WebSocket server (`ws://127.0.0.1:18789`) receives messages from channels, forwards them to a Pi agent runtime (third-party `@mariozechner/pi-*` packages), returns responses. Local-first design — binds to loopback by default.

### Where OpenClaw Leads

| Capability | OpenClaw | Pyx (This Project) | Gap Severity |
|---|---|---|---|
| **Channel adapters** | 13+ production channels (WhatsApp, Telegram, Slack, Discord, Signal, iMessage, Matrix, Teams, Line, IRC, Twitch, etc.) with pairing security, mention gating, DM policies | 0 channels implemented | Critical |
| **Plugin/Hook SDK** | Full SDK: `before_agent_start`, `agent_end`, `after_tool_call` hooks + tool/route/CLI/HTTP registration. 34+ extensions. | No plugin system | Critical |
| **Skill marketplace** | ClawHub registry — `clawhub install spotify` adds prompt-template skills with dependency metadata | No skill system | High |
| **Memory hybrid search** | Vector + BM25 full-text search, embedding cache, auto-fallback (OpenAI → Gemini → local GGUF), batch processing | Vector-only (Naive RAG), stub embedder | High |
| **Voice** | ElevenLabs TTS, Whisper STT, wake-word detection, push-to-talk, Talk Mode | None | Medium |
| **Native apps** | macOS menu bar (Swift), iOS (Swift), Android (Kotlin) | Web dashboard only | Medium |
| **Canvas/A2UI** | Agent-driven interactive HTML/JS rendering via WebSocket | None | Low |
| **Onboarding** | CLI wizard (@clack/prompts), QR pairing for WhatsApp, `openclaw doctor` health check | None | High |
| **Browser automation** | CDP-based Chrome control with snapshots | None | Medium |
| **OpenAI-compatible API** | `/v1/chat/completions` + `/v1/responses` endpoints | None | High |
| **Model providers** | Anthropic, OpenAI, Gemini, Ollama, Bedrock, HuggingFace, many more | Claude only (pluggable interface exists but 1 impl) | Medium |
| **Remote access** | Tailscale Serve/Funnel integration | Localhost only | Medium |
| **Cron system** | Full cron with job management, catch-up, delivery tracking | Stub (501) | Medium |

### Where Pyx Leads

| Capability | Pyx (This Project) | OpenClaw | Gap Severity |
|---|---|---|---|
| **AI-driven orchestration** | Conductor AI analyzes messages + memory + agent list, returns JSON routing decisions with confidence scores | Zero orchestration — purely static config-based binding rules (`openclaw.json`) | Foundational |
| **Dynamic agent creation** | Conductor creates/destroys specialist agents at runtime based on message content | All agents must be pre-configured in JSON. No runtime creation. | Foundational |
| **Multi-agent collaboration** | Delegation pipeline: sequential relay through multiple agents with accumulated context | Agents are isolated silos. A2A is opt-in, basic, off by default. | Foundational |
| **Ownership permissions** | Conductor-created vs user-created agents with different ACLs, protected system agent | No permission model between agents | Major |
| **Backend independence** | CLIBackend interface wraps ANY CLI tool (claude, codex, gemini) — first-party code | Core agent logic depends on third-party `@mariozechner/pi-*` packages | Major |
| **Architectural cleanliness** | 7 clean packages with clear boundaries, injectable dependencies, 500+ tests with mocks | Massive `src/` monolith, 100+ files per directory, 120+ imports in gateway server | Major |
| **Bun runtime** | ~3x faster startup, native TypeScript (no build step), built-in SQLite + test runner | Node.js 22+ with tsdown/rolldown build pipeline | Moderate |
| **Dashboard UX** | Cyberpunk Next.js 16 with pipeline visualization, debug console, RPG agent cards | Basic Lit-based "Control UI" — functional but minimal | Moderate |
| **Pipeline visualization** | Real-time 5-step pipeline rendering in chat (memory → routing → dispatch → store → response) | No pipeline visibility | Moderate |
| **Event system** | ConductorEvent callbacks: routing, creating_agent, agent_created, delegating — all streamed to dashboard | Agent events exist but no orchestration-level events | Moderate |
| **Graph data structure** | SQLite `graph_edges` table ready for Graph RAG | No graph structures | Minor |
| **Test infrastructure** | MockBackend, MockMemory, MockPool, MockConductor per package | Tests lean on e2e with real services | Minor |

### The Fundamental Asymmetry

**OpenClaw's 200k-star architecture fundamentally cannot do what our Conductor does.** Adding multi-agent orchestration to their gateway would require a ground-up rewrite — it's a proxy, not an orchestrator. Their agents are isolated processes bound to channels via static config.

**Adding channels to our runtime is incremental work.** grammY, discord.js, @slack/bolt are well-documented libraries. The channel adapter pattern is a solved problem.

This means: **Their moat is breadth (channels, plugins, voice, native apps). Our moat is depth (orchestration intelligence).** The market is moving from single-agent to multi-agent (+1,445% Gartner inquiry growth). OpenClaw is optimized for the previous era. We're building for the next.

### Lessons to Adopt from OpenClaw

1. **Plugin/Hook SDK** — Their hook system (`before_agent_start`, `agent_end`, `after_tool_call`) is the right abstraction. We need this for community extensibility.
2. **Hybrid memory search** — Vector + BM25 FTS is strictly better than vector-only. SQLite FTS5 is trivial with bun:sqlite.
3. **Skill-as-prompt-template** — Skills are just markdown with YAML frontmatter injected into the system prompt. Lightweight, effective, no code required.
4. **Onboarding wizard** — `@clack/prompts` for CLI first-run experience. API key → first response in < 3 minutes.
5. **OpenAI-compatible API** — `/v1/chat/completions` gives instant compatibility with thousands of existing tools.
6. **Channel security patterns** — Pairing codes for unknown senders, mention gating for groups, configurable DM policies.
7. **Organization Templates** (our unique spin) — Their ClawHub is single-agent skills. Ours should be multi-agent "org templates": pre-built teams (Customer Support Org, Research Org, Content Org) that you deploy in one command. This is something OpenClaw structurally cannot offer.

---

## Key Market Gaps This Project Fills

### 1. No "docker-compose up" Multi-Agent Runtime
Every framework provides building blocks, but none provide a **complete self-hosted runtime** with orchestrator + agent pool + memory + dashboard + channels in a single deploy.

### 2. TypeScript-Native Multi-Agent Orchestration
The multi-agent space is overwhelmingly Python. TypeScript alternatives (Mastra, Vercel AI SDK) are application frameworks, not deployable runtime orchestration platforms.

### 3. "Experimentation to Production" Bridge
~2/3 of organizations experimenting with agents, fewer than 1 in 4 at production scale. This template includes everything needed: lifecycle management, persistent memory, scheduling, monitoring, graceful shutdown.

### 4. Pluggable Backend Abstraction
Most frameworks are model-locked. With 59% of enterprises using 3+ LLMs, the CLIBackend interface supporting any CLI-based LLM matches enterprise reality.

### 5. "Organization as a Service" Concept
Nobody is selling an entire AI-powered organizational structure as a deployable unit. A Conductor (CEO) managing specialist agents with organizational memory maps to how enterprises think about teams.

### 6. n8n-Proven Free Self-Hosted Model
n8n's free self-hosted tier (unlimited executions) fueled a $2.3B valuation and $40M+ ARR. This same model — free self-hosted + paid cloud — is directly replicable.

---

# Multi-Specialist Strategic Directions

## Product Owner Perspective

**Current state is strong.** 7 of 11 build steps complete. Core value proposition (multi-agent orchestration with persistent memory) is functional end-to-end. The "template = game engine" framing is correct.

**Critical path to market:**
1. Docker deployment (Step 9) — without this, nobody can try it
2. Onboarding wizard — first-run experience determines adoption
3. At least one channel adapter (Telegram is lowest friction)
4. README with a 60-second demo GIF

**Product risk:** The spec is ambitious (11 steps + cloud). Ship docker-compose + one channel + working demo before polishing. A working product with rough edges beats a polished product nobody can run.

## Product Designer Perspective

**The cyberpunk dashboard is a differentiation moat.** Every agent framework has a generic white UI or no UI at all. The RPG-style agent creation, pipeline visualization, and debug console are genuinely unique.

**Improvement directions:**
- Onboarding flow is the #1 missing UX piece — first-time users need to: enter API key, see their first agent respond, feel the "wow"
- The chat experience with pipeline steps and conductor status is already ahead of competitors — lean into this
- Mobile-responsive sidebar is present but chat experience needs mobile optimization
- Consider: agent "personality" avatars/icons in the RPG theme

## Architect Perspective

**Architecture is sound.** The Conductor pattern with fallback chains (AI routing -> keyword routing, memory non-fatal, graceful degradation) shows production-grade thinking.

**Key technical strengths:**
- Ring buffers everywhere (activity log, debug bus) — bounded memory
- Ownership-based permissions — simple but effective security model
- DebugBus for full observability — most competitors lack this
- Mock backend infrastructure for testing without real CLI

**What to watch:**
- Real streaming (currently pre-buffered) should come before cloud mode
- A2A direct mode via custom tools will be a major differentiator vs conductor-relay
- MCP protocol integration — the ecosystem is standardizing on this (97M+ SDK downloads). Consider MCP compatibility for the agent communication layer
- The stub embedder (zero vectors) works for dev but needs real embedding before any demo

## Marketer Perspective

**Positioning statement:** "The open-source multi-agent runtime. docker-compose up your AI organization."

**Naming/Branding observations:**
- "Autonomous AI Agent Runtime" is descriptive but forgettable
- "Pyx" (the product name) has good characteristics: short, memorable, pronounceable
- Consider: "Pyx — Organization as a Service" as the hero tagline

**Go-to-market strategy (based on what worked for competitors):**
1. **OpenClaw's viral growth** (9k to 180k stars) was driven by: clear README, GIF demo, solves real pain
2. **n8n's $2.3B valuation** was driven by: free self-hosted + product-led growth
3. **CrewAI's adoption** (100k+ certified developers) was driven by: opinionated framework + cloud platform

**Recommended launch sequence:**
1. Polish README with architecture diagram + demo GIF
2. Working docker-compose (the "it just works" moment)
3. Hacker News / Product Hunt launch with clear framing: "n8n for AI agent teams"
4. Template marketplace (pre-built agent configurations for common use cases)

## Growth Strategist Perspective

**The n8n model is the playbook.** Free self-hosted forever, cloud for convenience. This is proven at $2.3B scale.

**Pricing recommendations for cloud tier:**
- Free: Self-hosted, unlimited agents/messages
- Starter ($29/mo): Hosted, 5 agents, 1000 messages/month
- Team ($99/mo): 20 agents, 10k messages, 3 channels
- Enterprise (custom): SSO, VPC, unlimited, SLA

**Key metric to optimize:** Time-to-first-response. How fast from `docker-compose up` to seeing an agent answer a question? Target: under 3 minutes.

**Template marketplace as growth engine:** Pre-built "organizations" (customer support team, research team, content team) dramatically lower barrier to entry. Users should be able to pick a template and be operational immediately.

---

## Build Priority (Updated Post-OpenClaw Analysis)

Based on all specialist input + OpenClaw competitive deep dive:

### Close the Gap (Must-Have)

| Priority | What | Why | OpenClaw Parity? |
|----------|------|-----|-----------------|
| P0 | Docker deployment (Step 9) | Cannot demo/distribute without it | They have it |
| P0 | Real embedding provider | Zero-vector stub breaks memory search | They have multi-provider + fallback |
| P0 | Hybrid memory search (Vector + BM25 FTS) | Strictly better than vector-only. SQLite FTS5 is trivial. | They have it |
| P0 | Plugin/Hook SDK | Without this, no community ecosystem. Adopt their hook model. | They have 34+ extensions |
| P1 | 3 channel adapters (Telegram, Discord, Slack) | Our #1 gap. Without channels, it's a localhost demo. | They have 13+ |
| P1 | Onboarding wizard (CLI + Dashboard) | First-run experience determines adoption. `@clack/prompts`. | They have polished CLI wizard |
| P1 | OpenAI-compatible API (`/v1/chat/completions`) | Instant compatibility with thousands of tools | They have it |
| P1 | README + demo GIF | Distribution requires clear communication | ~~Done~~ README created, GIF pending |

### Widen the Lead (Our Differentiators)

| Priority | What | Why | OpenClaw Can't Match |
|----------|------|-----|---------------------|
| P0 | Organization Templates marketplace | Pre-built multi-agent orgs (Support Team, Research Team, Content Team). One-command deploy. | Their architecture can't do multi-agent orchestration |
| P1 | Conductor intelligence improvements | Learning from past routing decisions, confidence calibration, user feedback loop | They have zero orchestration |
| P1 | Pipeline visualization polish | Agent collaboration graphs, memory flow diagrams, cost tracking | They have no pipeline concept |
| P2 | A2A direct mode (custom tools) | Agent-to-agent without Conductor relay. True swarm intelligence. | Their agents are isolated silos |
| P2 | Cron Manager (Step 8) | Autonomous scheduling with Conductor integration | They have basic cron |

### Polish Later

| Priority | What | Why |
|----------|------|-----|
| P2 | Memory browser UI | Users need to see what agents remember |
| P2 | MCP compatibility | Industry standardizing; future-proof |
| P3 | Graph/Agentic RAG (Step 10) | Nice-to-have, Naive RAG works |
| P3 | Voice integration | Nice-to-have, OpenClaw's strength not ours |
| P3 | Native apps | Different product surface, web-first is fine |
| P4 | Control Plane (Step 11) | Only needed for cloud launch |
