# Moltbot Architecture Overview

Moltbot is a personal AI assistant platform that runs locally, providing a unified gateway for messaging channels and AI agents.

## What Moltbot Does

- **Multi-channel inbox**: WhatsApp, Telegram, Slack, Discord, Signal, iMessage, Google Chat, Microsoft Teams, Matrix, and more
- **Local-first gateway**: Single control plane at `127.0.0.1:18789` managing sessions, channels, tools, and events
- **Companion apps**: macOS menu bar, iOS/Android nodes
- **Agent runtime**: AI agent with tool streaming (browser, canvas, bash, etc.)
- **Voice & Talk Mode**: Always-on speech for macOS/iOS/Android
- **Extensible via plugins**: Workspace skills, bundled tools, channel extensions

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          CLIENTS                                 │
│   CLI  │  macOS App  │  iOS/Android  │  WebChat  │  Admin UI    │
└────────────────────────────┬────────────────────────────────────┘
                             │ WebSocket
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                         GATEWAY                                  │
│   (ws://127.0.0.1:18789)                                        │
│   • Session owner (transcripts, presence, memory)                │
│   • Channel multiplexer                                          │
│   • Agent spawner (RPC mode)                                     │
│   • Tool executor                                                │
│   • Config holder + hot-reload                                   │
│   • Device pairing & auth                                        │
└──────────┬─────────────────────────────┬────────────────────────┘
           │                             │
           ▼                             ▼
┌──────────────────────┐    ┌──────────────────────────────────────┐
│   CHANNEL PLUGINS    │    │          AGENT RUNTIME               │
│   • Telegram         │    │   • Model inference (Claude, etc.)   │
│   • Discord          │    │   • Tool streaming                   │
│   • Slack            │    │   • Session management               │
│   • WhatsApp         │    │   • Memory/embeddings                │
│   • Signal           │    └──────────────────────────────────────┘
│   • iMessage         │
│   • Matrix, Teams... │
└──────────────────────┘
```

---

## Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **Entry/CLI** | `src/cli/`, `src/entry.ts` | CLI commands (gateway, agent, channels, config) |
| **Gateway** | `src/gateway/` | WebSocket server, session management, message routing |
| **Channels** | `src/telegram/`, `src/discord/`, etc. | Inbound monitors, outbound send, per-channel adapters |
| **Agents** | `src/agents/` | Model inference, tool execution, session transcripts |
| **Routing** | `src/routing/` | Message to session key resolution, channel bindings |
| **Media** | `src/media/` | Fetch, process, store media (images, audio, docs) |
| **Plugins** | `src/plugins/`, `extensions/` | Extensibility: new channels, tools, providers |
| **Config** | `src/config/` | YAML/JSON config, Zod schemas, hot-reload |
| **Apps** | `apps/ios/`, `apps/android/`, `apps/macos/` | Native companion apps |

---

## Directory Structure

```
src/
├── cli/           # CLI wiring, commands
├── gateway/       # WebSocket server, protocol
├── agents/        # Agent runtime, tools
├── channels/      # Channel abstraction layer
├── telegram/      # Telegram-specific
├── discord/       # Discord-specific
├── slack/         # Slack-specific
├── whatsapp/      # WhatsApp (Baileys)
├── signal/        # Signal-cli integration
├── imessage/      # iMessage
├── routing/       # Message routing
├── media/         # Media pipeline
├── config/        # Config loading
├── plugins/       # Plugin registry
└── infra/         # Utilities

extensions/        # Plugin packages (Teams, Matrix, etc.)
apps/              # Native apps (iOS, Android, macOS)
docs/              # Mintlify documentation
```

---

## Supported Channels

**Core** (in `src/`):
- Telegram
- Discord
- Slack
- Signal
- iMessage
- WhatsApp (Baileys)
- Google Chat
- WebChat

**Extensions** (in `extensions/`):
- Microsoft Teams
- Matrix
- BlueBubbles
- Zalo
- Line
- Mattermost
- Nextcloud Talk
- Twitch
- Nostr

---

## Message Flow

### Inbound Flow

```
┌─ INBOUND ──────────────────────────────────────────────────────┐
│                                                                 │
│ 1. Channel monitor detects message                             │
│    └─ Telegram polling, Discord gateway, Slack bolt, etc.     │
│                                                                 │
│ 2. Inbound adapter parses channel-specific format              │
│    └─ Extract: from, to, body, media, peerId, etc.           │
│                                                                 │
│ 3. Security: allowlist, mention gating, DM policy              │
│    └─ Reject if not allowed, request pairing if needed        │
│                                                                 │
│ 4. Dedupe: check against recent message cache                  │
│    └─ Skip if recently seen (guard against retransmits)       │
│                                                                 │
│ 5. Debounce: batch rapid messages (e.g., 2s window)            │
│    └─ Merge text, use latest for threading/IDs               │
│                                                                 │
│ 6. Route resolution: channel + peer → session key              │
│    └─ Config bindings → agent                                 │
│                                                                 │
│ 7. Message history context: build pending buffer              │
│    └─ Include recent group msgs (not in transcript yet)       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Agent Run

```
┌─ AGENT RUN ────────────────────────────────────────────────────┐
│                                                                 │
│ 1. Check queue: is a run active?                              │
│    └─ interrupt | steer | followup | collect (configurable)   │
│                                                                 │
│ 2. Load session transcript                                     │
│    └─ From SQLite, via moltbot sessions                       │
│                                                                 │
│ 3. Build prompt                                                │
│    └─ System prompt + channel envelope + history + current    │
│       + hook templates (auto-reply, formatted)                │
│                                                                 │
│ 4. Select model/provider                                       │
│    └─ Via agents.model, auth profile selection, failover      │
│                                                                 │
│ 5. Stream inference                                            │
│    └─ Pi agent RPC → tool streaming                           │
│       Block streaming emits partial blocks                    │
│                                                                 │
│ 6. Tool execution                                              │
│    └─ Browser, canvas, bash, camera, cron, etc.              │
│       Emit events in real-time to clients                    │
│                                                                 │
│ 7. Save transcript                                             │
│    └─ Agent response → session (SQLite)                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Outbound Flow

```
┌─ OUTBOUND ─────────────────────────────────────────────────────┐
│                                                                 │
│ 1. Block streaming: emit partial blocks as model produces      │
│    └─ Control UI / client shows live updates                  │
│                                                                 │
│ 2. Chunk to channel limits (e.g., 4000 for Telegram)          │
│    └─ Avoid splitting code fences                             │
│                                                                 │
│ 3. Build channel-specific message                              │
│    └─ Discord Embed, Slack Block Kit, Telegram HTML, etc.     │
│                                                                 │
│ 4. Media handling: upload inline assets                        │
│    └─ Images from canvas, files from tools, etc.              │
│                                                                 │
│ 5. Send to channel                                             │
│    └─ REST API (Discord, Slack, etc.) or daemon (Signal)      │
│       Return msg ID for threading                             │
│                                                                 │
│ 6. Set presence back to "available"                            │
│    └─ Emit presence event to all clients                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## The Gateway

The Gateway is the central control plane - a WebSocket server that manages everything.

**Default binding**: `ws://127.0.0.1:18789`

### Responsibilities

1. **Session owner**: Holds all session transcripts, presence, and agent memory
2. **Channel multiplexer**: Routes messages between all connected channels
3. **Agent spawner**: RPC calls into Pi agent runtime
4. **Tool executor**: Executes browser, canvas, bash, node, cron tools
5. **Event emitter**: Broadcasts presence, agent results, health to all connected clients
6. **Config holder**: Loads and hot-reloads configuration
7. **Auth enforcer**: Token validation, device pairing, DM policies
8. **Device manager**: Maintains device identities and pairing state

### Clients

- **Operators**: CLI, macOS app, web admin UI (port 18792)
- **Nodes**: iOS/Android companions (role: "node")
- **WebChat**: Static frontend hitting the same WS

### Protocol

- Frames: JSON text over WebSocket
- Request/response pattern with idempotency keys
- Server-push events for streaming (agent, presence, heartbeat)
- Sequence numbering for gap detection

---

## Extensions and Plugins

Located in `extensions/` (workspace packages) + `src/plugin-sdk/` + `src/plugins/`

### Plugin Types

| Type | Purpose |
|------|---------|
| **Channel plugins** | New messaging surfaces (implement `ChannelPlugin`) |
| **Tool/Agent plugins** | New capabilities (tool definitions) |
| **Provider plugins** | New AI model providers (OAuth/API auth) |
| **HTTP route plugins** | Custom webhooks under `/api/<plugin>/` |
| **CLI plugins** | New CLI commands |
| **Service plugins** | Background services (e.g., memory embedding) |

### Plugin Loading

```
moltbot startup
  → loadConfig()
  → loadPlugins() — scan extensions/, load npm packages
  → setActivePluginRegistry(registry)
  → channels/plugins/index.ts:getChannelPlugin(id) — lookup
```

---

## Media Pipeline

Located in `src/media/`

1. **Parse** (`parse.ts`) - Extract media from inbound message (URLs, attachments, captions)
2. **Fetch** (`fetch.ts`) - Download remote media with size validation (~50MB cap)
3. **Process** (`image-ops.ts`) - Resize, optimize images via Sharp
4. **Store** (`store.ts`) - Temp file caching, cleanup after use
5. **Upload** - Send back to channel via channel-specific APIs

---

## Key Architectural Patterns

| Pattern | Implementation |
|---------|----------------|
| **Dependency Injection** | `src/cli/deps.ts` - `createDefaultDeps()` for testability |
| **Plugin Registry** | Global singleton in `plugins/runtime.ts` |
| **Config-driven** | Zod schemas, hot-reload via `gateway/config-reload.ts` |
| **Session-centric** | Gateway owns all session state exclusively |
| **Event-driven** | Clients subscribe to server-push events |
| **Channel dock** | `src/channels/dock.ts` - lightweight metadata for shared code |

---

# Agent System

The agent system handles AI model inference, tool execution, and session management.

## Agent Spawning

### Entry Points

| Trigger | Location | How |
|---------|----------|-----|
| CLI | `moltbot agent --message "..."` | Direct command execution |
| Gateway | WebSocket message | Enqueued in CommandLane |
| Auto-reply | Inbound channel message | Route resolution → agent run |
| Subagent | Parent agent tool | `clawdbot_sessions_spawn` tool |
| Cron | Scheduled job | Heartbeat trigger |

### Spawn Flow

```
agentCommand()
├─ Resolve agent config & workspace
├─ Load model catalog & auth profiles
├─ Determine thinking level (off/low/medium/high)
├─ runWithModelFallback()
│   └─ runEmbeddedPiAgent()
│       └─ runEmbeddedAttempt()
│           └─ subscribeEmbeddedPiSession() ← streaming starts
└─ deliverAgentCommandResult()
```

---

## Context and Session Management

### Session Key Format

`agent:channel:recipient`

Example: `mario:telegram:5551234567`

### Storage Locations

```
~/.clawdbot/
├── sessions.json                    # Session index (metadata)
└── agents/<agentId>/sessions/
    └── <sessionId>.jsonl            # Transcript (JSONL)
```

### Transcript Format (JSONL)

```json
{"type": "session", "version": 1, "id": "sess_abc", "timestamp": "..."}
{"type": "message", "message": {"role": "user", "content": [...]}}
{"type": "message", "message": {"role": "assistant", "content": [...], "usage": {...}}}
```

### Session Entry Metadata

```typescript
{
  sessionId: string;
  updatedAt: number;
  channel?: string;           // telegram, discord, etc.
  chatType?: string;          // dm, group, channel
  modelOverride?: string;     // Per-session model
  thinkingLevel?: "off" | "low" | "medium" | "high";
  spawnedBy?: string;         // Parent agent (for subagents)
}
```

### Context Preservation

- SessionManager (Pi SDK) opens transcript file
- Appends messages atomically
- Write lock prevents concurrent modifications
- Compaction summarizes old turns when context overflows

---

## Tool Streaming Architecture

### Pi SDK Foundation

Moltbot wraps the Mariozechner Pi SDK:

```
@mariozechner/pi-agent-core
@mariozechner/pi-ai
@mariozechner/pi-coding-agent
```

### Event Flow

```
Pi SDK streams events
    ↓
subscribeEmbeddedPiSession()
    ↓
Route to handlers:
├─ handleMessageStart()       → Reset state
├─ handleMessageUpdate()      → text_delta → block chunker
├─ handleToolExecutionStart() → Flush blocks, emit tool event
├─ handleToolExecutionUpdate()→ Partial tool output (bash streaming)
├─ handleToolExecutionEnd()   → Commit sends, emit result
└─ handleMessageEnd()         → Finalize
```

### Tool Execution Lifecycle

```
┌─ TOOL START ────────────────────────────────┐
│ • Flush pending text blocks                  │
│ • Emit tool event (phase: "start")          │
│ • Track pending messaging sends              │
└──────────────────────────────────────────────┘
           ↓
┌─ TOOL UPDATE (optional) ────────────────────┐
│ • Stream partial output (bash, browser)      │
│ • Emit updates to subscribers                │
└──────────────────────────────────────────────┘
           ↓
┌─ TOOL END ──────────────────────────────────┐
│ • Commit messaging tool sends (if success)   │
│ • Sanitize sensitive data from result        │
│ • Emit tool event (phase: "result")         │
└──────────────────────────────────────────────┘
```

---

## Block Streaming (Partial Replies)

The `EmbeddedBlockChunker` buffers text and emits at natural break points:

```typescript
class EmbeddedBlockChunker {
  append(text);      // Buffer incoming stream
  drain({ force });  // Emit when threshold met
}
```

### Break Point Priority

1. Paragraph breaks (`\n\n`)
2. Newline boundaries (`\n`)
3. Sentence endings (`. ! ?`)

### Code Fence Handling

- If inside ` ``` `, close fence before break
- Reopen fence after break with same language tag

### Configuration

```typescript
{
  minChars: 300,    // Buffer before considering emit
  maxChars: 1000,   // Force emit if exceeded
}
```

---

## Available Tools

### Built-in (Pi SDK)

- `read` - File read
- `write` - File write
- `edit` - File editing
- `exec` - Bash execution
- `process` - Long-running processes

### Moltbot Extensions

- `bash` - Wrapped exec with sandbox
- `apply_patch` - Git-style diffs
- `clawdbot_sessions_*` - Subagent spawning, history
- `clawdbot_channels_*` - Send to Slack/Discord/etc.
- `browser_*` - Playwright automation
- `web_search`, `web_fetch` - Web interaction
- `image_*` - Image analysis/generation
- Plugin tools from extensions

### Tool Policy

```typescript
{
  allowlist?: string[];   // Only these tools available
  denylist?: string[];    // Block these tools
  groups?: string[];      // Tool groups (e.g., "dangerous")
}
```

---

## Model Inference and Failover

### Resolution Order

1. CLI flags (`--provider`, `--model`)
2. Session override (stored in session entry)
3. Agent config (`agents.{agentId}.model`)
4. Global default (`agents.defaults.model`)

### Auth Profile Rotation

```
Profile 1 → Try → Auth Error?
    ↓                 ↓
Success           Profile 2 → Try → Rate Limit?
                      ↓                ↓
                   Success          Profile 3...
```

### Failover Chain

```
Primary Model → Context Overflow? → Compact session → Retry
      ↓
   Auth Error? → Next auth profile → Retry
      ↓
   Rate Limit? → Fallback model → Retry
      ↓
   Success → Return result
```

### Thinking Level Downgrade

If repeated failures: `high → medium → low` (reduces token usage)

---

## Queue Management

### Lane-Based Serialization

```typescript
enqueueCommandInLane(
  "session:user@example.com",   // Lane name
  async () => { /* agent run */ }
);
```

- Default: 1 concurrent per lane (serialized)
- Different sessions run in parallel
- Same session runs sequentially

### Queue Modes

| Mode | Behavior |
|------|----------|
| `steer` | Replace pending message, single reply |
| `followup` | Queue messages, sequential replies |
| `collect` | Batch all pending, process as group |
| `interrupt` | Immediate priority |
| `queue` | Standard FIFO |

### Mid-Stream Message Injection

```typescript
queueEmbeddedPiMessage(sessionId, text)
// Queues follow-up while agent is streaming
```

---

## Agent Event System

### Event Streams

```typescript
type AgentEventStream = "lifecycle" | "tool" | "assistant" | "error";
```

### Event Emission

```typescript
emitAgentEvent({
  runId: string;
  stream: "tool",
  data: { phase: "start", name: "bash", args: {...} }
});
```

### Lifecycle Events

- `phase: "start"` - Agent run begins
- `phase: "end"` - Agent run completes
- `phase: "error"` - Agent run failed

### Tool Events

- `phase: "start"` - Tool execution begins
- `phase: "update"` - Partial output (streaming)
- `phase: "result"` - Tool execution complete

---

## Complete Agent Lifecycle

```
┌─ INPUT ─────────────────────────────────────────────────────────┐
│ User message via CLI / Gateway / Channel                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─ RESOLVE ───────────────────────────────────────────────────────┐
│ Session key → Agent config → Model → Auth profile               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─ LOAD ──────────────────────────────────────────────────────────┐
│ Open transcript (JSONL) → Build system prompt → Load tools      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─ STREAM ────────────────────────────────────────────────────────┐
│ Pi SDK streams: text_delta → block chunker → emit partial       │
│                 tool_start → flush → execute → tool_end         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─ RETRY (if needed) ─────────────────────────────────────────────┐
│ Context overflow → Compact → Retry                              │
│ Auth error → Next profile → Retry                               │
│ Rate limit → Fallback model → Retry                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─ PERSIST ───────────────────────────────────────────────────────┐
│ Append to transcript → Update session store → Emit events       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─ DELIVER ───────────────────────────────────────────────────────┐
│ Send to channel (Telegram, Discord, etc.) → Return result       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Architectural Patterns Summary

| Pattern | Purpose |
|---------|---------|
| **Stateless Streaming** | Events flow through handlers immediately, no buffering |
| **Session Isolation** | Each session has dedicated workspace, write lock |
| **Lane Serialization** | Same session serialized, different sessions parallel |
| **Failure Resilience** | Profile rotation, model fallback, thinking downgrade |
| **Event-Driven** | Central emit system, monotonic seq per run |
| **Tool Abstraction** | Pi SDK interface + sandbox + policy + abort signal |

---

# Workspace System

The workspace is the agent's persistent home directory containing configuration, memory, and user files.

## Workspace Directory Resolution

**Default path**: `$HOME/clawd`

**Resolution order**:
1. Profile-aware: `$HOME/clawd-{PROFILE}` if `CLAWDBOT_PROFILE` env var is set
2. Per-agent override: `agents.list[].workspace` in config
3. Default: `$HOME/clawd`

**Creation**: `ensureAgentWorkspace(dir)` creates the directory and initializes git repo on first run.

## Workspace Structure

```
~/clawd/                     # Default workspace
├── AGENTS.md               # Available agents, workspace instructions
├── SOUL.md                 # Agent personality, tone, boundaries
├── TOOLS.md                # Local environment notes (camera names, SSH hosts)
├── IDENTITY.md             # Agent identity context
├── USER.md                 # User/owner information
├── HEARTBEAT.md            # Periodic check reminders
├── BOOTSTRAP.md            # One-time initialization (deleted after first read)
├── MEMORY.md               # Long-term curated memory
├── memory/                 # Raw memory files
│   ├── YYYY-MM-DD.md       # Daily session logs
│   └── heartbeat-state.json
├── .git/                   # Optional git repo
└── [user files]            # Code, docs, projects
```

## Bootstrap Files

Bootstrap files are **injected into the system prompt** at the start of each agent session.

### Loading Flow

```
loadWorkspaceBootstrapFiles(dir)
  → resolveMemoryBootstrapEntries()     # Handle MEMORY.md deduping
  → Read all files into memory
  → filterBootstrapFilesForSession()    # Restrict subagents
  → applyBootstrapHookOverrides()       # Dynamic modifications via hooks
  → buildBootstrapContextFiles()        # Truncate oversized files
```

### File Purposes

| File | Purpose | Loaded For |
|------|---------|------------|
| `AGENTS.md` | Workspace instructions, memory policy | All sessions |
| `SOUL.md` | Persona, tone, boundaries | Main agent only |
| `TOOLS.md` | Local environment documentation | All sessions |
| `IDENTITY.md` | Agent identity context | Main agent only |
| `USER.md` | User preferences, context | Main agent only |
| `MEMORY.md` | Long-term curated memory | Main/DM sessions only |
| `HEARTBEAT.md` | Periodic check prompts | Heartbeat runs |
| `BOOTSTRAP.md` | One-time setup guide | First run only |

### Truncation

- Default max: **20,000 chars** per file
- Strategy: 70% head + 20% tail + truncation marker
- Configurable via `agents.defaults.bootstrapMaxChars`

### Subagent Restrictions

Subagents (spawned via `sessions_spawn` tool) only receive:
- `AGENTS.md`
- `TOOLS.md`

No `SOUL.md`, `IDENTITY.md`, `USER.md`, or `MEMORY.md` to prevent persona/memory leakage.

## Memory Files

### MEMORY.md

**Purpose**: Curated long-term memory - decisions, lessons learned, preferences

**Privacy rule**: Only loaded in **direct/main sessions**, never in group chats

**Format**: Plain markdown, user-editable

**Written by**:
- Memory flush operations (automatic compaction)
- Agent during heartbeats (periodic maintenance)

### memory/ Folder

**Purpose**: Raw daily logs and session transcripts

**Files**:
- `YYYY-MM-DD.md` - Daily session summaries
- `heartbeat-state.json` - Tracks last check times

**Synced to**: Vector memory database for semantic search

## Memory Search

### Vector Database

**Location**: `~/.clawdbot/state/memory/{agentId}.sqlite`

**Schema**:
```sql
files    -- Indexed file metadata (path, hash, mtime)
chunks   -- Text chunks with embeddings
chunks_vec   -- Vector search index (sqlite-vec)
chunks_fts   -- Full-text search index
```

### Search Tools

```typescript
memory_search(query, maxResults?, minScore?)  // Semantic search
memory_get(path, from?, lines?)               // Read specific lines
```

### Hybrid Search

- **Vector similarity**: 70% weight (semantic matching)
- **BM25 text match**: 30% weight (keyword matching)
- Configurable weights and thresholds

### Sync Triggers

- Session start (warm-up)
- Before memory queries
- File system changes (debounced 500ms)
- Periodic interval (configurable)
- Session transcript growth

## Sandbox Mode

### Workspace Access Levels

| Mode | Behavior |
|------|----------|
| `rw` (read-write) | Agent uses main workspace directly |
| `ro` (read-only) | Agent sees copy in sandbox, can't write |
| `none` | No workspace access (full Docker isolation) |

### Sandbox Isolation

```typescript
if (workspaceAccess === "rw") {
  workspaceDir = agentWorkspaceDir;    // Main workspace
} else {
  workspaceDir = sandboxWorkspaceDir;  // Isolated copy
}
```

### Memory Flush in Sandbox

Only runs if `workspaceAccess === "rw"` - prevents writing to read-only workspaces.

## Multi-Agent Workspaces

### Agent-Specific Workspaces

```yaml
agents:
  list:
    - id: "main"
      workspace: "~/clawd"        # Shared default
    - id: "coding"
      workspace: "~/clawd-code"   # Separate workspace
```

### Memory Isolation

- Each agent has separate memory database
- Sessions stored per-agent: `~/.clawdbot/agents/<agentId>/sessions/`
- Bootstrap files shared if same workspace directory

## System Prompt Injection

### Prompt Sections Built

```
buildAgentSystemPrompt(params)
  → Core identity ("You are a personal assistant...")
  → Available tools (filtered by policy)
  → Workspace info ("Your working directory is: {path}")
  → Skills section (loaded from SKILL.md)
  → Memory recall instructions
  → User identity (from IDENTITY.md)
  → Time/timezone info
  → Sandbox info (if applicable)
  → Runtime info (agent ID, model, OS, etc.)
  → Injected workspace files
```

### Injected Files Format

```markdown
## Workspace Files (injected)
These user-editable files are loaded by Moltbot and included below.

[AGENTS.md]
{content, truncated if needed}

[SOUL.md]
{content}
...
```

## Bootstrap Hooks

Plugins can dynamically modify bootstrap files via the `agent.bootstrap` hook:

```typescript
api.registerHook("agent.bootstrap", (ctx) => {
  // ctx.bootstrapFiles - array of files
  // ctx.workspaceDir, ctx.sessionKey, ctx.agentId
  // Can add/remove/modify files before injection
});
```

---

# Tools System

Tools are the capabilities available to agents - file operations, web access, messaging, browser automation, etc.

## Tool Architecture

### Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                    TOOL AVAILABILITY                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─ Pi SDK Base Tools ────────────────────────────────────────┐ │
│  │ read, write, edit, exec, process                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              +                                   │
│  ┌─ Moltbot Core Tools ───────────────────────────────────────┐ │
│  │ browser, canvas, message, sessions, gateway, nodes,        │ │
│  │ cron, image, web_fetch, web_search, tts, memory_*          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              +                                   │
│  ┌─ Plugin Tools ─────────────────────────────────────────────┐ │
│  │ Dynamically loaded from extensions/                         │ │
│  │ (matrix, msteams, zalo, voice-call, etc.)                  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Tool Definition

Tools follow the Pi SDK `AnyAgentTool` interface:

```typescript
{
  name: string;              // Canonical lowercase name
  description?: string;      // What the tool does
  parameters?: JSONSchema;   // Input schema
  handler: (params) => Promise<AgentToolResult>;
}
```

## Tool Loading

Tools are **instantiated per session**, not pre-built:

```
createMoltbotCodingTools({
  sessionKey,
  workspaceDir,
  config,
  sandbox,
  abortSignal,
  // ... 20+ context params
})
  → Load Pi SDK base tools
  → Add Moltbot core tools
  → resolvePluginTools() — load plugin tools
  → Apply tool policies (allow/deny)
  → Return filtered tool array
```

### Plugin Tool Registration

```typescript
// In plugin's index.ts
api.registerTool(myTool, { optional: true });

// Or factory function for context-aware tools
api.registerTool((ctx) => {
  return createMyTool(ctx.workspaceDir, ctx.config);
});
```

## Credential Storage

### Model Provider Credentials

| Provider | Storage Location |
|----------|-----------------|
| Anthropic | `ANTHROPIC_API_KEY` env var |
| OpenAI | `OPENAI_API_KEY` env var |
| Custom | `config.models.providers[name].apiKey` |

### OAuth Credentials (Claude Code Integration)

**Anthropic OAuth**:
1. macOS Keychain: `security find-generic-password -s "Claude Code-credentials"`
2. File fallback: `~/.claude/.credentials.json`

```json
{
  "claudeAiOauth": {
    "accessToken": "...",
    "refreshToken": "...",
    "expiresAt": 1706500000000
  }
}
```

**OpenAI/Codex**:
1. macOS Keychain: `security find-generic-password -s "Codex Auth"`
2. File: `$CODEX_HOME/auth.json` or `~/.codex/auth.json`

**Qwen Portal**:
- File: `~/.qwen/oauth_creds.json`

### Auth Profile Store

Moltbot maintains its own auth profile system for model providers:

```
~/.clawdbot/state/auth-profiles/
├── anthropic.json
├── openai.json
└── ...
```

Tracks:
- Multiple profiles per provider
- Usage stats and failure reasons
- Cooldown periods for failed profiles

## Token Rotation and Refresh

### OAuth Token Refresh

```
Token has expires timestamp (ms)
        ↓
Check: expires - now < 5 minutes?
        ↓
Yes → exchangeRefreshToken()
        ↓
Update keychain + file storage
        ↓
Return fresh access token
```

### Auth Profile Rotation

```
Profile 1 fails (rate limit)
        ↓
Enter cooldown (~1 hour)
        ↓
Try Profile 2
        ↓
Track: lastUsed, lastGood, failureReason
        ↓
Rotate back when cooldown expires
```

### Expiry Tracking

- All credentials have explicit `expires: number` (timestamp in ms)
- Checked on every read
- Minimum expiry buffer: 30 seconds
- Default refresh buffer: 5 minutes before expiry

## Tool Policy

### Policy Hierarchy (evaluated in order)

```
1. Tool profiles (minimal/coding/messaging/full)
2. Provider-specific (tools.byProvider[provider])
3. Agent-specific (agents[id].tools)
4. Group/channel policies
5. Sandbox policies
6. Subagent policies (most restrictive)
```

### Policy Types

```typescript
{
  allow?: string[];   // Whitelist (supports * wildcard)
  deny?: string[];    // Blacklist
}
```

### Tool Groups

```typescript
TOOL_GROUPS = {
  "group:fs": ["read", "write", "edit", "apply_patch"],
  "group:runtime": ["exec", "process"],
  "group:sessions": ["sessions_list", "sessions_spawn", ...],
  "group:web": ["web_search", "web_fetch"],
  "group:memory": ["memory_search", "memory_get"],
  "group:moltbot": [all core tools],
  "group:plugins": [all plugin tools],
};
```

### Wildcard Support

- `*` = allow all
- `exec*` = allow tools starting with "exec"
- Aliases: `bash` → `exec`, `apply-patch` → `apply_patch`

### Subagent Tool Restrictions

Subagents are denied these tools by default:

```typescript
DEFAULT_SUBAGENT_TOOL_DENY = [
  "sessions_list", "sessions_history", "sessions_send", "sessions_spawn",
  "gateway", "agents_list", "whatsapp_login",
  "session_status", "cron",
  "memory_search", "memory_get",
];
```

## Tool Execution

### HTTP Endpoint

`POST /tools/invoke`

### Execution Flow

```
1. Authenticate request
2. Parse: tool, action, args, sessionKey
3. Resolve context (config, agent, policies)
4. Build tool list (core + plugins)
5. Apply 9+ policy layers
6. Lookup tool by name
7. Execute handler with args
8. Sanitize results (images, SSRF protection)
9. Return JSON response
```

### Tool Result Format

```typescript
{
  content: [
    { type: "text", text: "..." },
    { type: "image", data: "base64...", mimeType: "image/png" },
  ],
  details: { /* tool-specific metadata */ }
}
```

## Built-in Tools

### Coding Tools (Pi SDK)

| Tool | Purpose |
|------|---------|
| `read` | Read file contents |
| `write` | Create/overwrite files |
| `edit` | Precise file editing |
| `exec` | Bash command execution |
| `process` | Long-running processes |

### Moltbot Core Tools

| Tool | Purpose |
|------|---------|
| `browser` | Playwright web automation |
| `canvas` | HTML rendering/visualization |
| `message` | Send to messaging channels |
| `sessions_spawn` | Create subagent sessions |
| `sessions_list` | List active sessions |
| `sessions_history` | Get session transcript |
| `gateway` | Gateway control operations |
| `nodes` | Manage iOS/Android nodes |
| `cron` | Schedule jobs/reminders |
| `image` | Image analysis/generation |
| `web_fetch` | Fetch web pages |
| `web_search` | Search the web |
| `tts` | Text-to-speech |
| `memory_search` | Semantic memory search |
| `memory_get` | Read memory file lines |

### Plugin Tools

Loaded dynamically from `extensions/`:
- `matrix` - Matrix chat
- `msteams` - Microsoft Teams
- `zalo` - Zalo messaging
- `voice-call` - Twilio voice
- `llm-task` - LLM task execution
- And many more...

## Dynamic Tool Spawning

### Can Tools Be Dynamically Created?

**Yes**, through the plugin system:

```typescript
// Plugin registers a factory function
api.registerTool((ctx) => {
  // ctx has: workspaceDir, config, agentId, agentDir
  return {
    name: "my_dynamic_tool",
    handler: async (params) => {
      // Tool logic using ctx
    }
  };
});
```

The factory is called fresh for each session, allowing context-aware tool creation.

### Subagent Tool Inheritance

When spawning subagents:
- Parent's tool policy applies
- Additional restrictions via `DEFAULT_SUBAGENT_TOOL_DENY`
- Subagents can't spawn further subagents (no `sessions_spawn`)

## Tool Security

### SSRF Protection

```typescript
// src/infra/net/ssrf.js
// Pins hostname resolution for internal URLs
// Blocks requests to internal networks
```

### Image Sanitization

- MIME type validation
- Base64 encoding enforced
- Dimension limits
- Malicious format rejection

### Result Sanitization

- PII scrubbing in some contexts
- HTML → Markdown conversion
- Size truncation

## Caching

### Web Fetch Cache

```typescript
{
  url: string;
  extractMode: string;
  content: string;
  expiresAt: number;  // Default 24 hours
}
```

### Embedding Cache

```sql
embedding_cache:
  provider, model, provider_key, hash → embedding, dims
```

LRU pruning when exceeding max entries.

## Tool Profiles

Pre-defined tool sets for common use cases:

| Profile | Tools Included |
|---------|---------------|
| `minimal` | `session_status` only |
| `coding` | fs, runtime, sessions, memory, image |
| `messaging` | message, sessions, session_status |
| `full` | No restrictions |

Configure via:
```yaml
agents:
  defaults:
    toolProfile: "coding"
```

---

# Hooks System

Hooks provide event-driven automation - trigger actions when things happen in the system.

## Hook Types

| Type | Location | Purpose |
|------|----------|---------|
| **Internal Hooks** | In-memory | Runtime event handlers |
| **Bundled Hooks** | Shipped with core | `session-memory`, `command-logger`, `boot-md`, `soul-evil` |
| **Managed Hooks** | `~/.clawdbot/hooks/` | User-installed via `moltbot hooks install` |
| **Plugin Hooks** | Plugin packages | Registered via plugin API |

## Hook Events

### Event Naming Pattern

`{type}:{action}` or just `{type}` for all actions

### Available Events

| Event | When Fired |
|-------|------------|
| `command:new` | New conversation started |
| `command:reset` | Conversation reset |
| `command:stop` | Conversation stopped |
| `session:start` | Session created |
| `session:end` | Session ended |
| `session:*` | Any session action |
| `agent:bootstrap` | Before agent starts (can modify bootstrap files) |
| `agent:*` | Any agent action |
| `gateway:start` | Gateway started |
| `gateway:stop` | Gateway stopped |
| `gateway:*` | Any gateway action |

## Hook Registration

### Via Plugin API

```typescript
api.registerHook("session:start", async (event) => {
  console.log(`Session started: ${event.sessionKey}`);
});

// Multiple events
api.registerHook(["command:new", "command:reset"], handler);

// Wildcard
api.registerHook("agent:*", handler);
```

### Hook Handler Interface

```typescript
type HookHandler = (event: InternalHookEvent) => Promise<void> | void;

interface InternalHookEvent {
  type: "command" | "session" | "agent" | "gateway";
  action: string;           // "new", "reset", "start", etc.
  sessionKey: string;
  context: Record<string, unknown>;
  timestamp: Date;
  messages: string[];       // Push messages to queue
}
```

## Bootstrap Hook (Special)

The `agent.bootstrap` hook can modify files before injection:

```typescript
api.registerHook("agent.bootstrap", (ctx) => {
  // ctx.bootstrapFiles - array of WorkspaceBootstrapFile
  // ctx.workspaceDir
  // ctx.sessionKey
  // ctx.agentId

  // Add a dynamic file
  ctx.bootstrapFiles.push({
    name: "DYNAMIC.md",
    content: `Generated at ${new Date().toISOString()}`,
  });

  // Modify existing
  const soul = ctx.bootstrapFiles.find(f => f.name === "SOUL.md");
  if (soul) {
    soul.content += "\n\nAdditional instructions...";
  }
});
```

## Bundled Hooks

| Hook | Purpose |
|------|---------|
| `session-memory` | Auto-flush memory on session end |
| `command-logger` | Log all commands for debugging |
| `boot-md` | Generate BOOT.md on startup |
| `soul-evil` | Testing hook (injects chaos) |

## Hook Installation

```bash
# Install from URL or local path
moltbot hooks install ./my-hook.ts
moltbot hooks install https://example.com/hook.ts

# List installed
moltbot hooks list

# Remove
moltbot hooks uninstall my-hook
```

---

# Gateway Protocol

The Gateway exposes a WebSocket API for all client communication.

## Connection

**Default endpoint**: `ws://127.0.0.1:18789`

### Handshake

```typescript
// Client sends ConnectParams
{
  minProtocol: 1,
  maxProtocol: 1,
  client: {
    name: "my-client",
    version: "1.0.0",
    platform: "node"
  },
  auth: {
    token: "gateway-auth-token"
  }
}

// Server responds with HelloOk
{
  protocol: 1,
  features: {
    methods: ["agent", "chat.send", "sessions.list", ...],
    events: ["agent", "presence", "health", ...]
  }
}
```

## Frame Types

All messages are JSON with a `type` discriminator:

### Request Frame

```typescript
{
  type: "req",
  id: "unique-request-id",    // For correlation
  method: "chat.send",
  params: {
    sessionKey: "main",
    message: "Hello"
  }
}
```

### Response Frame

```typescript
// Success
{
  type: "res",
  id: "unique-request-id",
  ok: true,
  payload: { /* method-specific result */ }
}

// Error
{
  type: "res",
  id: "unique-request-id",
  ok: false,
  error: {
    code: "INVALID_PARAMS",
    message: "Missing required field: sessionKey"
  }
}
```

### Event Frame

```typescript
{
  type: "event",
  event: "agent",
  payload: {
    runId: "run-123",
    stream: "tool",
    data: { phase: "start", name: "exec" }
  },
  seq: 42,                    // Monotonic per event type
  stateVersion: 1706500000    // For state sync
}
```

## Authentication

### Token Auth

```typescript
{
  auth: {
    token: "your-gateway-token"
  }
}
```

Token from `moltbot config get gateway.token` or auto-generated.

### Device Pairing

For remote devices (iOS/Android nodes):

```typescript
{
  auth: {
    deviceId: "device-uuid",
    signature: "signed-challenge",
    publicKey: "base64-public-key"
  }
}
```

### Roles

| Role | Permissions |
|------|-------------|
| `operator` | Full access (CLI, macOS app) |
| `node` | Limited access (iOS/Android) |
| `viewer` | Read-only access |

## Gateway Methods (75+)

### Agent Methods

| Method | Purpose |
|--------|---------|
| `agent` | Run agent with message |
| `agent.identity.get` | Get agent identity |
| `agent.wait` | Wait for agent run to complete |

### Chat Methods

| Method | Purpose |
|--------|---------|
| `chat.send` | Send message to session |
| `chat.history` | Get conversation history |
| `chat.abort` | Abort running agent |

### Session Methods

| Method | Purpose |
|--------|---------|
| `sessions.list` | List all sessions |
| `sessions.preview` | Preview session content |
| `sessions.patch` | Update session metadata |
| `sessions.reset` | Clear session history |
| `sessions.delete` | Delete session |
| `sessions.compact` | Trigger compaction |

### Config Methods

| Method | Purpose |
|--------|---------|
| `config.get` | Get config value |
| `config.set` | Set config value |
| `config.apply` | Apply config changes |
| `config.patch` | Patch config object |
| `config.schema` | Get config JSON schema |

### Channel Methods

| Method | Purpose |
|--------|---------|
| `channels.status` | Get channel status |
| `channels.logout` | Logout from channel |

### Model Methods

| Method | Purpose |
|--------|---------|
| `models.list` | List available models |

### Cron Methods

| Method | Purpose |
|--------|---------|
| `cron.list` | List scheduled jobs |
| `cron.add` | Add new job |
| `cron.run` | Run job immediately |
| `cron.status` | Get job status |

### Node Methods

| Method | Purpose |
|--------|---------|
| `node.list` | List connected nodes |
| `node.describe` | Get node capabilities |
| `node.invoke` | Execute on node |
| `node.pair.*` | Pairing flow |

### System Methods

| Method | Purpose |
|--------|---------|
| `health` | Health check |
| `status` | Full system status |
| `usage.status` | Token usage stats |
| `logs.tail` | Stream logs |

## Events

### Agent Events

```typescript
{
  event: "agent",
  payload: {
    runId: string,
    stream: "lifecycle" | "tool" | "assistant" | "error",
    data: { /* stream-specific */ }
  }
}
```

### Presence Events

```typescript
{
  event: "presence",
  payload: {
    sessionKey: string,
    status: "idle" | "typing" | "thinking" | "tool"
  }
}
```

### Health Events

```typescript
{
  event: "health",
  payload: {
    channels: { telegram: "ok", discord: "error" },
    gateway: "running"
  }
}
```

---

# HTTP API

The Gateway also exposes REST endpoints for webhooks and integrations.

## Authentication

All endpoints require the gateway token:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" ...
# or
curl -H "X-Gateway-Token: YOUR_TOKEN" ...
```

## Endpoints

### POST /hooks/wake

Trigger a system event (agent processes on next heartbeat or immediately).

```bash
curl -X POST http://localhost:18789/hooks/wake \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "New email from john@example.com: Meeting tomorrow",
    "mode": "now"
  }'
```

**Parameters:**

| Field | Type | Description |
|-------|------|-------------|
| `text` | string | Event description for agent |
| `mode` | `"now"` \| `"next-heartbeat"` | When to process |

### POST /hooks/agent

Run an isolated agent session with full control.

```bash
curl -X POST http://localhost:18789/hooks/agent \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Summarize this document",
    "name": "DocumentProcessor",
    "sessionKey": "hook:doc-processor",
    "wakeMode": "now",
    "deliver": true,
    "channel": "slack",
    "to": "#general",
    "model": "anthropic/claude-sonnet-4-20250514",
    "thinking": "low",
    "timeoutSeconds": 120
  }'
```

**Parameters:**

| Field | Type | Description |
|-------|------|-------------|
| `message` | string | Message for agent |
| `name` | string | Source identifier |
| `sessionKey` | string | Session to use (creates if needed) |
| `wakeMode` | `"now"` \| `"next-heartbeat"` | When to run |
| `deliver` | boolean | Send result to channel |
| `channel` | string | Target channel (`"last"`, `"whatsapp"`, `"telegram"`, etc.) |
| `to` | string | Recipient ID |
| `model` | string | Model to use |
| `thinking` | string | Thinking level |
| `timeoutSeconds` | number | Max execution time |

### POST /v1/chat/completions

OpenAI-compatible chat completions endpoint.

```bash
curl -X POST http://localhost:18789/v1/chat/completions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "moltbot:main",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "stream": true
  }'
```

**Headers:**

| Header | Purpose |
|--------|---------|
| `X-Moltbot-Agent-Id` | Target agent (alternative to `model: "moltbot:agentId"`) |

**Response:** Standard OpenAI chat completion format (streaming SSE if `stream: true`)

### POST /tools/invoke

Execute a tool directly.

```bash
curl -X POST http://localhost:18789/tools/invoke \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "web_fetch",
    "action": "json",
    "args": {
      "url": "https://api.example.com/data"
    },
    "sessionKey": "main",
    "dryRun": false
  }'
```

**Parameters:**

| Field | Type | Description |
|-------|------|-------------|
| `tool` | string | Tool name |
| `action` | `"json"` | Response format |
| `args` | object | Tool arguments |
| `sessionKey` | string | Session context |
| `dryRun` | boolean | Validate without executing |

**Response:**

```json
{
  "content": [
    {"type": "text", "text": "..."}
  ],
  "details": { /* tool-specific */ }
}
```

### POST /hooks/{mapping-name}

Custom webhook endpoint via hook mappings.

```yaml
# Config
hooks:
  mappings:
    - name: "github"
      match: { source: "github" }
      action: "wake"
      payload:
        text: "GitHub event: {{event.action}}"
```

```bash
curl -X POST http://localhost:18789/hooks/github \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "push", "repository": "my-repo"}'
```

## Webhook Mappings

### Configuration

```yaml
hooks:
  enabled: true
  token: "webhook-secret"
  basePath: "/hooks"

  mappings:
    - name: "github"
      match:
        source: "github"
        headers:
          x-github-event: "push"
      action: "wake"
      payload:
        text: "Push to {{body.repository.name}}"

    - name: "custom"
      match:
        source: "custom"
      action: "agent"
      payload:
        message: "{{body.message}}"
        sessionKey: "hook:custom"

  # Custom transform functions
  transformsDir: "~/transforms"
  transforms:
    - name: "complex"
      match: { source: "complex" }
      transform:
        module: "complex.ts"
        export: "transformPayload"
```

### Built-in Presets

```yaml
hooks:
  presets: ["gmail"]  # Gmail Pub/Sub integration
```

---

# Plugin SDK

Plugins extend Moltbot with new capabilities - tools, channels, providers, hooks, and more.

## Plugin Structure

```
my-plugin/
├── package.json
├── index.ts          # Main entry point
└── src/
    └── ...
```

### package.json

```json
{
  "name": "moltbot-plugin-example",
  "version": "1.0.0",
  "main": "index.ts",
  "moltbot": {
    "id": "example",
    "name": "Example Plugin"
  },
  "peerDependencies": {
    "moltbot": "*"
  }
}
```

### index.ts

```typescript
import { defineMoltbotPlugin } from "moltbot/plugin-sdk";

export default defineMoltbotPlugin((api) => {
  // Register capabilities
  api.registerTool(myTool);
  api.registerHook("session:start", handleSessionStart);

  return {
    // Optional lifecycle
    start: async () => { /* on gateway start */ },
    stop: async () => { /* on gateway stop */ },
  };
});
```

## Plugin API

### Core Properties

```typescript
interface MoltbotPluginApi {
  id: string;                    // Plugin ID
  name: string;                  // Display name
  version?: string;              // Plugin version
  config: MoltbotConfig;         // Full config access
  pluginConfig?: Record<string, unknown>;  // Plugin-specific config
  runtime: PluginRuntime;        // Runtime helpers (70+ methods)
  logger: PluginLogger;          // Structured logging
}
```

### Registration Methods

#### registerTool

```typescript
// Static tool
api.registerTool({
  name: "my_tool",
  description: "Does something useful",
  parameters: {
    type: "object",
    properties: {
      input: { type: "string" }
    }
  },
  handler: async ({ input }) => {
    return { content: [{ type: "text", text: `Processed: ${input}` }] };
  }
}, { optional: true });

// Factory function (context-aware)
api.registerTool((ctx) => ({
  name: "context_tool",
  handler: async (params) => {
    // ctx.workspaceDir, ctx.config, ctx.agentId available
  }
}));
```

#### registerHook

```typescript
api.registerHook("session:start", async (event) => {
  console.log(`Session ${event.sessionKey} started`);
});

// Multiple events
api.registerHook(["command:new", "command:reset"], handler);
```

#### registerHttpRoute

```typescript
api.registerHttpRoute({
  path: "/my-plugin/webhook",
  handler: async (req, res) => {
    const body = await req.json();
    // Process webhook
    res.json({ ok: true });
  }
});
```

#### registerHttpHandler

```typescript
// Full request handler (for complex routing)
api.registerHttpHandler(async (req, res, next) => {
  if (req.url.startsWith("/my-plugin/")) {
    // Handle request
    return;
  }
  next();
});
```

#### registerGatewayMethod

```typescript
api.registerGatewayMethod("myPlugin.doSomething", async (params, ctx) => {
  // params: method parameters
  // ctx: gateway context (config, sessionKey, etc.)
  return { result: "done" };
});
```

#### registerChannel

```typescript
api.registerChannel({
  id: "mychannel",
  name: "My Channel",
  // ... channel plugin implementation
});
```

#### registerProvider

```typescript
api.registerProvider({
  id: "myprovider",
  label: "My Provider",
  auth: [{ type: "api_key", envVar: "MY_API_KEY" }],
  // ... provider implementation
});
```

#### registerCli

```typescript
api.registerCli((program) => {
  program
    .command("my-command")
    .description("Does something")
    .action(async () => {
      // Command logic
    });
});
```

#### registerService

```typescript
api.registerService({
  name: "my-background-service",
  start: async () => {
    // Start background work
    return { stop: () => { /* cleanup */ } };
  }
});
```

### Lifecycle Hooks

```typescript
api.on("before_agent_start", async (ctx) => {
  // Modify system prompt, inject context
  ctx.systemPrompt += "\n\nAdditional instructions...";
});

api.on("agent_end", async (ctx) => {
  // Post-run analysis
  console.log(`Agent used ${ctx.usage.totalTokens} tokens`);
});

api.on("before_tool_call", async (ctx) => {
  // Can block tool execution
  if (ctx.toolName === "dangerous_tool") {
    return { block: true, reason: "Tool disabled" };
  }
});

api.on("after_tool_call", async (ctx) => {
  // Analyze tool results
  console.log(`Tool ${ctx.toolName} returned:`, ctx.result);
});
```

### All Lifecycle Hooks

| Hook | When | Can Modify |
|------|------|------------|
| `before_agent_start` | Before agent run | System prompt |
| `agent_end` | After agent completes | - |
| `before_compaction` | Before session compaction | - |
| `after_compaction` | After compaction | - |
| `message_received` | Inbound message | Can drop |
| `message_sending` | Before outbound | Can cancel |
| `message_sent` | After sent | - |
| `before_tool_call` | Before tool executes | Can block |
| `after_tool_call` | After tool completes | - |
| `tool_result_persist` | Before saving to transcript | Can modify |
| `session_start` | Session created | - |
| `session_end` | Session ended | - |
| `gateway_start` | Gateway started | - |
| `gateway_stop` | Gateway stopping | - |

## Plugin Runtime

The `api.runtime` object provides 70+ helper methods:

### Config Operations

```typescript
runtime.loadConfig()              // Reload config
runtime.writeConfigFile(path, data)
runtime.getConfigPath()
```

### Media Operations

```typescript
runtime.loadWebMedia(url)         // Fetch media
runtime.detectMime(buffer)        // Detect MIME type
runtime.resizeToJpeg(buffer, opts) // Resize image
```

### Channel Helpers

```typescript
runtime.discord.sendMessage(channelId, content)
runtime.slack.postMessage(channel, text)
runtime.telegram.sendMessage(chatId, text)
runtime.whatsapp.sendMessage(jid, content)
// ... and more per channel
```

### System Operations

```typescript
runtime.enqueueSystemEvent(text, opts)
runtime.runCommandWithTimeout(cmd, timeout)
runtime.getAgentDir(agentId)
runtime.getSessionDir(agentId)
```

---

# Event System

Moltbot has three event patterns for different use cases.

## Agent Events

Real-time events during agent execution.

### Event Structure

```typescript
interface AgentEventPayload {
  runId: string;              // Unique run identifier
  seq: number;                // Monotonic sequence (per run)
  stream: AgentEventStream;   // Event category
  ts: number;                 // Timestamp (ms)
  data: Record<string, unknown>;
  sessionKey?: string;
}

type AgentEventStream = "lifecycle" | "tool" | "assistant" | "error";
```

### Lifecycle Events

```typescript
// Run started
{ stream: "lifecycle", data: { phase: "start", sessionKey, model } }

// Run completed
{ stream: "lifecycle", data: { phase: "end", stopReason, usage } }

// Run failed
{ stream: "lifecycle", data: { phase: "error", error: { message, code } } }
```

### Tool Events

```typescript
// Tool starting
{ stream: "tool", data: { phase: "start", name: "exec", args: {...} } }

// Partial output (streaming)
{ stream: "tool", data: { phase: "update", name: "exec", partialResult: "..." } }

// Tool completed
{ stream: "tool", data: { phase: "result", name: "exec", result: {...}, isError: false } }
```

### Assistant Events

```typescript
// Text chunk
{ stream: "assistant", data: { type: "text_delta", text: "Hello" } }

// Block complete
{ stream: "assistant", data: { type: "block", content: "Full paragraph..." } }
```

### Subscribing to Events

```typescript
import { onAgentEvent, offAgentEvent } from "moltbot";

const handler = (event: AgentEventPayload) => {
  if (event.stream === "tool" && event.data.phase === "start") {
    console.log(`Tool ${event.data.name} starting`);
  }
};

onAgentEvent(handler);

// Later
offAgentEvent(handler);
```

### Emitting Events

```typescript
import { emitAgentEvent } from "moltbot";

emitAgentEvent({
  runId: "run-123",
  stream: "tool",
  data: { phase: "start", name: "my_tool", args: {} }
});
```

## Diagnostic Events

System-level events for monitoring and debugging.

### Event Types

| Type | Purpose |
|------|---------|
| `model.usage` | Token usage tracking |
| `webhook.received` | Inbound webhook |
| `webhook.processed` | Webhook handled |
| `webhook.error` | Webhook failed |
| `message.queued` | Message added to queue |
| `message.processed` | Message handled |
| `session.state` | Session state change |
| `session.stuck` | Session appears stuck |
| `queue.lane.busy` | Lane is processing |
| `queue.lane.idle` | Lane is idle |
| `run.attempt` | Agent run attempt |
| `diagnostic.heartbeat` | System heartbeat |

### Subscribing

```typescript
import { onDiagnosticEvent } from "moltbot";

onDiagnosticEvent((event) => {
  if (event.type === "model.usage") {
    console.log(`Used ${event.data.tokens} tokens`);
  }
});
```

## System Events

Ephemeral in-memory event queue for wake/notification patterns.

### Usage

```typescript
import {
  enqueueSystemEvent,
  drainSystemEvents,
  peekSystemEvents,
  hasSystemEvents
} from "moltbot";

// Queue an event
enqueueSystemEvent("New email received", {
  sessionKey: "main",
  contextKey: "email-notifications"
});

// Check if events exist
if (hasSystemEvents("main")) {
  // Peek without clearing
  const events = peekSystemEvents("main");

  // Or drain (read and clear)
  const drained = drainSystemEvents("main");
}
```

### Characteristics

- **Ephemeral**: Not persisted, lost on restart
- **Session-scoped**: Events belong to a session
- **FIFO**: First-in, first-out ordering
- **Used for**: Wake events, notifications, heartbeat triggers

---

# Messaging Channels

Channels are the messaging surfaces that connect to the gateway.

## Channel Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    CHANNEL PLUGIN                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─ Monitor ───────────────────────────────────────────────────┐│
│  │ Polling / Webhook / WebSocket listener                      ││
│  │ Receives raw messages from platform                         ││
│  └─────────────────────────────────────────────────────────────┘│
│                              ↓                                   │
│  ┌─ Inbound Adapter ───────────────────────────────────────────┐│
│  │ Parse platform format → InboundMessage                      ││
│  │ Extract: from, to, body, media, peerId, chatType            ││
│  └─────────────────────────────────────────────────────────────┘│
│                              ↓                                   │
│  ┌─ Security Layer ────────────────────────────────────────────┐│
│  │ Allowlist check, mention gating, DM policy                  ││
│  └─────────────────────────────────────────────────────────────┘│
│                              ↓                                   │
│                      → Gateway Router →                          │
│                              ↓                                   │
│  ┌─ Outbound Adapter ──────────────────────────────────────────┐│
│  │ AgentReply → Platform format (embed, blocks, HTML, etc.)    ││
│  └─────────────────────────────────────────────────────────────┘│
│                              ↓                                   │
│  ┌─ Send ──────────────────────────────────────────────────────┐│
│  │ REST API / SDK call to platform                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Supported Channels

### Core Channels (in `src/`)

| Channel | Transport | Features |
|---------|-----------|----------|
| **Telegram** | Polling/Webhook | Groups, threads, reactions, inline buttons |
| **Discord** | Gateway WS | Servers, threads, embeds, reactions |
| **Slack** | Bolt SDK | Workspaces, threads, blocks, reactions |
| **WhatsApp** | Baileys (Web) | Groups, media, reactions |
| **Signal** | signal-cli | Groups, attachments |
| **iMessage** | imsg daemon | Groups, attachments, reactions |
| **Google Chat** | Webhook | Spaces, threads |
| **WebChat** | Built-in UI | Direct web interface |

### Extension Channels (in `extensions/`)

| Channel | Transport | Features |
|---------|-----------|----------|
| **Microsoft Teams** | Graph API | Teams, channels, threads |
| **Matrix** | Matrix SDK | Rooms, E2E encryption |
| **BlueBubbles** | REST API | iMessage relay |
| **Mattermost** | REST API | Teams, channels |
| **Zalo** | Zalo API | Groups, OA |
| **Line** | Messaging API | Groups, rich messages |
| **Nextcloud Talk** | REST API | Rooms, calls |
| **Twitch** | IRC/API | Chat, commands |
| **Nostr** | Relays | Decentralized messaging |

## Channel Plugin Interface

```typescript
interface ChannelPlugin {
  id: string;                 // e.g., "telegram"
  name: string;               // e.g., "Telegram"

  // Lifecycle
  start?: (config) => Promise<void>;
  stop?: () => Promise<void>;

  // Status
  status: () => Promise<ChannelStatus>;

  // Account management
  accounts?: {
    list: () => Promise<Account[]>;
    add: (config) => Promise<Account>;
    remove: (id) => Promise<void>;
  };

  // Messaging
  send: (message: OutboundMessage) => Promise<SendResult>;

  // Optional features
  react?: (messageId, emoji) => Promise<void>;
  edit?: (messageId, newContent) => Promise<void>;
  delete?: (messageId) => Promise<void>;
  typing?: (chatId, isTyping) => Promise<void>;
}
```

## Channel Configuration

```yaml
channels:
  telegram:
    enabled: true
    token: "BOT_TOKEN"
    allowFrom:
      - "123456789"      # User IDs
      - "@username"      # Usernames
    groups:
      - id: "-100123456"
        activation: "mention"  # or "always"

  discord:
    enabled: true
    token: "BOT_TOKEN"
    guilds:
      - id: "123456789"
        channels:
          - "general"
          - "bot-commands"

  slack:
    enabled: true
    # Uses OAuth, configured via `moltbot channels auth slack`
```

## Message Flow

### Inbound

```
Platform Event
    ↓
Channel Monitor (polling/webhook/WS)
    ↓
Parse to InboundMessage {
  from: { id, name, username },
  to: { id, type: "dm" | "group" },
  body: string,
  media: MediaAttachment[],
  peerId: string,
  messageId: string,
  threadId?: string,
  replyTo?: string
}
    ↓
Security: allowlist, mention-gating, DM policy
    ↓
Dedupe: skip if recently seen
    ↓
Debounce: batch rapid messages
    ↓
Route: channel + peer → sessionKey
    ↓
Queue: add to agent run queue
```

### Outbound

```
Agent Reply
    ↓
Chunk: split to channel limits (e.g., 4000 for Telegram)
    ↓
Format: convert to platform format
  - Discord: Embed
  - Slack: Block Kit
  - Telegram: HTML
  - WhatsApp: Formatted text
    ↓
Media: upload attachments
    ↓
Send: REST API / SDK call
    ↓
Track: message ID for threading
```

## Channel-Specific Features

### Telegram

- **Inline buttons**: `[[button:Label|callback_data]]`
- **Reactions**: Emoji reactions on messages
- **Reply markup**: Custom keyboards
- **HTML formatting**: Bold, italic, code, links

### Discord

- **Embeds**: Rich formatted messages
- **Components**: Buttons, select menus
- **Threads**: Auto-thread creation
- **Reactions**: Emoji reactions

### Slack

- **Block Kit**: Structured message layouts
- **App Home**: Dedicated bot space
- **Shortcuts**: Slash commands, message actions
- **Workflows**: Slack workflow integration

---

# Media Pipeline

Handles media attachments - images, audio, video, documents.

## Pipeline Stages

```
┌─ INBOUND ──────────────────────────────────────────────────────┐
│                                                                 │
│  1. Parse (parse.ts)                                           │
│     └─ Extract media references from message                   │
│        URLs, attachments, base64 data                          │
│                                                                 │
│  2. Fetch (fetch.ts)                                           │
│     └─ Download remote media                                   │
│        HTTP with redirects, auth headers                       │
│        Size validation (~50MB cap)                             │
│                                                                 │
│  3. Process (image-ops.ts)                                     │
│     └─ Transform media                                         │
│        Resize images (Sharp)                                   │
│        Convert formats                                         │
│        Extract metadata                                        │
│                                                                 │
│  4. Store (store.ts)                                           │
│     └─ Temporary file caching                                  │
│        Content-addressable storage                             │
│        TTL-based cleanup                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─ OUTBOUND ─────────────────────────────────────────────────────┐
│                                                                 │
│  1. Generate                                                    │
│     └─ Canvas renders, tool outputs, etc.                     │
│                                                                 │
│  2. Process                                                     │
│     └─ Resize for channel limits                              │
│        Convert to supported format                             │
│                                                                 │
│  3. Upload                                                      │
│     └─ Channel-specific upload API                            │
│        Return media ID for message                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Storage

### Temporary Storage

**Location**: `~/.clawdbot/media/` or system temp

**Structure**:
```
media/
├── {hash}.jpg          # Content-addressable
├── {hash}.png
├── {hash}.mp4
└── ...
```

### Content-Addressable

Files stored by content hash (SHA-256):
- Same content → same path
- Deduplication automatic
- Safe for concurrent access

### TTL and Cleanup

- Default TTL: 24 hours
- Cleanup on gateway start
- Manual cleanup: `moltbot media cleanup`

## MIME Type Detection

```typescript
// src/media/mime.ts
detectMimeType(buffer: Buffer): string
detectMimeTypeFromPath(path: string): string

// Supported types
{
  // Images
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",

  // Audio
  "audio/mpeg", "audio/wav", "audio/ogg", "audio/webm", "audio/mp4",

  // Video
  "video/mp4", "video/webm", "video/quicktime", "video/x-msvideo",

  // Documents
  "application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument.*",

  // Archives
  "application/zip", "application/x-tar", "application/gzip"
}
```

## Image Operations

```typescript
// Resize to fit within bounds
resizeImage(buffer, { maxWidth: 1024, maxHeight: 1024 })

// Convert to JPEG
convertToJpeg(buffer, { quality: 85 })

// Get dimensions
getImageDimensions(buffer)  // { width, height }

// Create thumbnail
createThumbnail(buffer, { width: 200, height: 200 })
```

## Channel Limits

| Channel | Max Image Size | Max File Size | Formats |
|---------|---------------|---------------|---------|
| Telegram | 10MB | 50MB | Most common |
| Discord | 8MB (nitro: 50MB) | 8MB | Most common |
| Slack | 1GB | 1GB | Most common |
| WhatsApp | 16MB | 100MB | jpeg, png, pdf, etc. |
| Signal | ~100MB | ~100MB | Most common |

---

# Cron System

Schedule recurring tasks and reminders.

## Cron Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      CRON SCHEDULER                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─ Job Store ─────────────────────────────────────────────────┐│
│  │ ~/.clawdbot/cron.json                                       ││
│  │ Persisted job definitions                                   ││
│  └─────────────────────────────────────────────────────────────┘│
│                              ↓                                   │
│  ┌─ Scheduler ─────────────────────────────────────────────────┐│
│  │ In-memory cron parser                                       ││
│  │ Calculates next run times                                   ││
│  └─────────────────────────────────────────────────────────────┘│
│                              ↓                                   │
│  ┌─ Executor ──────────────────────────────────────────────────┐│
│  │ Triggers agent run or webhook                               ││
│  │ Handles failures and retries                                ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Job Definition

```typescript
interface CronJob {
  id: string;                 // Unique identifier
  name: string;               // Display name
  schedule: string;           // Cron expression
  enabled: boolean;

  // Action
  action: "agent" | "webhook";

  // For agent action
  message?: string;           // Message to send
  sessionKey?: string;        // Target session

  // For webhook action
  webhook?: {
    url: string;
    method: "GET" | "POST";
    headers?: Record<string, string>;
    body?: unknown;
  };

  // Metadata
  lastRun?: number;           // Last execution timestamp
  nextRun?: number;           // Next scheduled run
  lastResult?: "success" | "failure";
  lastError?: string;
}
```

## Cron Expressions

Standard cron format: `minute hour day month weekday`

```
# Every day at 9am
0 9 * * *

# Every hour
0 * * * *

# Every Monday at 8am
0 8 * * 1

# Every 15 minutes
*/15 * * * *

# First day of month at midnight
0 0 1 * *
```

## CLI Commands

```bash
# List jobs
moltbot cron list

# Add job
moltbot cron add \
  --name "Daily summary" \
  --schedule "0 9 * * *" \
  --message "Give me a summary of yesterday's tasks" \
  --session main

# Run immediately
moltbot cron run <job-id>

# Enable/disable
moltbot cron enable <job-id>
moltbot cron disable <job-id>

# Remove
moltbot cron remove <job-id>
```

## Agent Tool

Agents can manage cron jobs:

```typescript
// Create job
cron.add({
  name: "Reminder",
  schedule: "0 9 * * *",
  message: "Check on project status",
  sessionKey: "main"
})

// List jobs
cron.list()

// Run now
cron.run(jobId)
```

## Heartbeat

Special recurring job for system health:

```yaml
agents:
  defaults:
    heartbeat:
      enabled: true
      schedule: "0 */4 * * *"  # Every 4 hours
      prompt: "Check for any pending tasks or reminders"
```

---

# Queue Management

Handles concurrent message processing and agent runs.

## Lane-Based Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMMAND QUEUE                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─ Lane: session:user1 ───────────────────────────────────────┐│
│  │ [msg1] → [msg2] → [msg3]  (serialized)                      ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─ Lane: session:user2 ───────────────────────────────────────┐│
│  │ [msg1] → [msg2]           (serialized)                      ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─ Lane: session:group1 ──────────────────────────────────────┐│
│  │ [msg1]                    (serialized)                      ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Lanes run in PARALLEL                                          │
│  Messages within lane run in SERIES                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Queue Modes

| Mode | Behavior |
|------|----------|
| `queue` | Standard FIFO - messages processed in order |
| `steer` | Replace pending message, agent sees only latest |
| `followup` | Queue messages, agent replies to each |
| `collect` | Batch all pending, process as group |
| `interrupt` | Immediate priority, bypass queue |

### Mode Examples

**`queue` (default)**
```
User: "Hello"       → Agent processes
User: "How are you" → Queued, waits
User: "What time"   → Queued, waits
→ Each gets separate reply in order
```

**`steer`**
```
User: "Hello"       → Agent starts processing
User: "Actually..."  → Replaces "Hello"
User: "Never mind"   → Replaces "Actually..."
→ Agent only sees "Never mind"
```

**`collect`**
```
User: "Point 1"     → Collected
User: "Point 2"     → Collected
User: "Point 3"     → Collected
[2 second debounce]
→ Agent sees all three as one message
```

## Configuration

```yaml
messages:
  queue:
    mode: "queue"              # Default mode
    modeByChannel:
      whatsapp: "steer"        # Per-channel override
      telegram: "collect"
    collectDebounceMs: 2000    # Collect mode debounce
```

## Lane API

```typescript
import { enqueueCommandInLane, CommandLaneHandle } from "moltbot";

const handle: CommandLaneHandle = enqueueCommandInLane(
  "session:user@example.com",   // Lane name
  async () => {
    // Task to execute
    return result;
  },
  {
    warnAfterMs: 5000,          // Log warning if queued too long
    priority: "normal"          // or "high"
  }
);

// Wait for result
const result = await handle.promise;

// Or cancel
handle.cancel();
```

## Concurrency Control

```typescript
// Default: 1 concurrent per lane (fully serialized)
setCommandLaneConcurrency("session:user@example.com", 1);

// Allow parallel within lane (rare)
setCommandLaneConcurrency("session:batch-processor", 4);
```

## Mid-Stream Message Injection

When agent is already running:

```typescript
import { queueEmbeddedPiMessage } from "moltbot";

// Inject follow-up into active run
const success = queueEmbeddedPiMessage(sessionId, "Additional context...");

if (!success) {
  // No active run, or run not accepting messages
}
```

---

# Custom Providers

Add new model providers for inference.

## Provider Plugin Interface

```typescript
interface ProviderPlugin {
  id: string;                   // e.g., "llamafarm"
  label: string;                // e.g., "LlamaFarm"
  docsPath?: string;            // Link to docs
  aliases?: string[];           // e.g., ["lf", "local"]

  // Environment variables to check
  envVars?: string[];           // e.g., ["LLAMAFARM_API_KEY"]

  // Model configuration
  models?: {
    default?: string;           // Default model ID
    list?: ModelInfo[];         // Available models
  };

  // Authentication methods
  auth: ProviderAuthMethod[];

  // Optional: format API key for requests
  formatApiKey?: (cred: Credential) => string;

  // Optional: OAuth refresh
  refreshOAuth?: (cred: OAuthCredential) => Promise<OAuthCredential>;
}
```

## Authentication Methods

```typescript
type ProviderAuthMethod =
  | { type: "api_key"; envVar: string; }
  | { type: "oauth"; provider: string; scopes: string[]; }
  | { type: "token"; tokenUrl: string; }
  | { type: "none"; }  // No auth required
```

## Registering a Provider

```typescript
// In plugin index.ts
import { defineMoltbotPlugin } from "moltbot/plugin-sdk";

export default defineMoltbotPlugin((api) => {
  api.registerProvider({
    id: "llamafarm",
    label: "LlamaFarm",
    envVars: ["LLAMAFARM_URL"],

    auth: [
      { type: "api_key", envVar: "LLAMAFARM_API_KEY" },
      { type: "none" }  // Also works without auth
    ],

    models: {
      default: "llama3-8b",
      list: [
        { id: "llama3-8b", name: "Llama 3 8B", contextWindow: 8192 },
        { id: "llama3-70b", name: "Llama 3 70B", contextWindow: 8192 },
        { id: "mistral-7b", name: "Mistral 7B", contextWindow: 32768 },
      ]
    }
  });
});
```

## Using Custom Provider

```yaml
# Config
models:
  providers:
    llamafarm:
      baseUrl: "http://localhost:8000"
      apiKey: "${LLAMAFARM_API_KEY}"

agents:
  defaults:
    provider: "llamafarm"
    model: "llama3-8b"
```

```bash
# CLI
moltbot agent --provider llamafarm --model llama3-8b --message "Hello"
```

## Provider with OpenAI-Compatible API

If your provider exposes OpenAI-compatible endpoints:

```typescript
api.registerProvider({
  id: "llamafarm",
  label: "LlamaFarm",

  // Use OpenAI-compatible client
  clientType: "openai-compatible",

  auth: [{ type: "api_key", envVar: "LLAMAFARM_API_KEY" }],

  // Endpoint configuration
  endpoints: {
    chat: "/v1/chat/completions",
    embeddings: "/v1/embeddings",
  }
});
```

---

# Integration Patterns

Common patterns for integrating Moltbot with external systems.

## Pattern 1: Webhook Trigger

External system triggers agent via webhook.

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  External   │  POST   │   Moltbot   │  Agent  │   Channel   │
│   System    │ ──────→ │   Gateway   │ ──────→ │  (Slack,    │
│             │ /hooks/ │             │  Reply  │  Discord)   │
└─────────────┘  agent  └─────────────┘         └─────────────┘
```

```bash
# External system calls
curl -X POST http://moltbot:18789/hooks/agent \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "message": "Process this data: ...",
    "sessionKey": "hook:external-system",
    "deliver": true,
    "channel": "slack",
    "to": "#alerts"
  }'
```

## Pattern 2: Tool Bridge

Agent uses external system via custom tool.

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Agent     │  Tool   │   Plugin    │  HTTP   │  External   │
│   Session   │ ──────→ │   Tool      │ ──────→ │   System    │
│             │  Call   │             │   API   │             │
└─────────────┘         └─────────────┘         └─────────────┘
```

```typescript
// Plugin tool
api.registerTool({
  name: "llamafarm_inference",
  description: "Run inference on LlamaFarm",
  parameters: {
    type: "object",
    properties: {
      prompt: { type: "string" },
      model: { type: "string" }
    }
  },
  handler: async ({ prompt, model }) => {
    const response = await fetch("http://llamafarm:8000/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }] })
    });
    const data = await response.json();
    return { content: [{ type: "text", text: data.choices[0].message.content }] };
  }
});
```

## Pattern 3: Provider Backend

External system serves as model provider.

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Agent     │ Infer-  │   Moltbot   │  HTTP   │  LlamaFarm  │
│   Session   │ ──────→ │  Provider   │ ──────→ │   Runtime   │
│             │  ence   │   Plugin    │   API   │             │
└─────────────┘         └─────────────┘         └─────────────┘
```

```yaml
# Config
models:
  providers:
    llamafarm:
      baseUrl: "http://llamafarm:8000"

agents:
  defaults:
    provider: "llamafarm"
    model: "llama3-8b"
```

## Pattern 4: Embedding Bridge

Use external system for embeddings.

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Memory    │ Embed-  │   Moltbot   │  HTTP   │  LlamaFarm  │
│   Indexer   │ ──────→ │   Memory    │ ──────→ │  Embedding  │
│             │  ding   │   Plugin    │   API   │   Endpoint  │
└─────────────┘         └─────────────┘         └─────────────┘
```

```yaml
# Config
agents:
  defaults:
    memorySearch:
      enabled: true
      provider: "llamafarm"
      model: "nomic-embed-text"
      baseUrl: "http://llamafarm:8000"
```

## Pattern 5: Event Stream

Subscribe to agent events for external processing.

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Agent     │  Event  │   Plugin    │  HTTP   │  External   │
│   Session   │ ──────→ │   Hook      │ ──────→ │   System    │
│             │ Stream  │             │  POST   │             │
└─────────────┘         └─────────────┘         └─────────────┘
```

```typescript
// Plugin hook
api.on("agent_end", async (ctx) => {
  await fetch("http://external-system/events", {
    method: "POST",
    body: JSON.stringify({
      type: "agent_completed",
      sessionKey: ctx.sessionKey,
      usage: ctx.usage,
      result: ctx.result
    })
  });
});
```

## Pattern 6: Bidirectional Sync

Two-way communication between systems.

```
┌─────────────┐  Webhook  ┌─────────────┐  Tool   ┌─────────────┐
│  LlamaFarm  │ ←───────→ │   Moltbot   │ ←─────→ │  LlamaFarm  │
│   Events    │  Trigger  │   Gateway   │  Call   │    API      │
└─────────────┘           └─────────────┘         └─────────────┘
```

Combines:
- LlamaFarm → Moltbot: Webhook triggers
- Moltbot → LlamaFarm: Tool calls + provider inference

## LlamaFarm-Specific Integration

### As Model Provider

```typescript
api.registerProvider({
  id: "llamafarm",
  label: "LlamaFarm Local",
  clientType: "openai-compatible",
  auth: [{ type: "none" }],
  endpoints: {
    chat: "/v1/chat/completions",
    embeddings: "/v1/embeddings"
  },
  models: {
    list: [
      { id: "llama3-8b", contextWindow: 8192 },
      { id: "mistral-7b", contextWindow: 32768 }
    ]
  }
});
```

### As RAG Backend

```typescript
api.registerTool({
  name: "llamafarm_rag",
  description: "Query LlamaFarm RAG system",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string" },
      collection: { type: "string" }
    }
  },
  handler: async ({ query, collection }) => {
    const response = await fetch(`http://llamafarm:8000/rag/query`, {
      method: "POST",
      body: JSON.stringify({ query, collection })
    });
    return { content: [{ type: "text", text: await response.text() }] };
  }
});
```

### As Document Processor

```typescript
api.registerTool({
  name: "llamafarm_extract",
  description: "Extract text from documents via LlamaFarm",
  parameters: {
    type: "object",
    properties: {
      url: { type: "string" },
      extractMode: { type: "string", enum: ["text", "ocr", "structured"] }
    }
  },
  handler: async ({ url, extractMode }) => {
    const response = await fetch(`http://llamafarm:8000/extract`, {
      method: "POST",
      body: JSON.stringify({ url, mode: extractMode })
    });
    return { content: [{ type: "text", text: await response.text() }] };
  }
});
```

---

# Plugin System Deep Dive

Complete guide to building and understanding Moltbot plugins.

## Plugin Discovery

Plugins are discovered from multiple locations (priority order, highest wins):

1. **Bundled plugins** (embedded in dist) - can be overridden
2. **Global extensions** (`~/.config/moltbot/extensions`)
3. **Workspace extensions** (`~/.clawdbot/extensions` or `{workspace}/.clawdbot/extensions`)
4. **Config paths** (`plugins.load.paths` in config)

### Discovery Process

```
discoverMoltbotPlugins()
    ↓
Scan all plugin directories
    ↓
Look for:
  - Single .ts/.js files
  - index.ts/js in directories
  - package.json moltbot.extensions field
    ↓
Return PluginCandidate[] with metadata
```

## Plugin Package Structure

### Minimal Plugin

```
my-plugin/
├── package.json              # npm metadata
├── moltbot.plugin.json       # Plugin manifest (REQUIRED)
└── index.ts                  # Entry point
```

### package.json

```json
{
  "name": "@moltbot/my-plugin",
  "version": "1.0.0",
  "type": "module",
  "moltbot": {
    "extensions": ["./index.ts"]
  },
  "peerDependencies": {
    "moltbot": "*"
  }
}
```

### moltbot.plugin.json (Required)

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "description": "Does something useful",
  "version": "1.0.0",

  "kind": "memory",           // Optional: "memory" for memory providers

  "channels": ["mychannel"],  // Channel IDs registered
  "providers": ["myprovider"], // Provider IDs registered

  "configSchema": {           // JSON Schema for plugin config
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "apiKey": { "type": "string" },
      "timeout": { "type": "number", "default": 5000 }
    },
    "required": ["apiKey"]
  },

  "uiHints": {                // UI metadata for config
    "apiKey": {
      "label": "API Key",
      "sensitive": true,
      "placeholder": "sk-..."
    }
  }
}
```

### index.ts Entry Point

```typescript
import type { MoltbotPluginApi } from "moltbot/plugin-sdk";

// Option 1: Function export
export default function register(api: MoltbotPluginApi) {
  // Register capabilities
  api.registerTool(myTool);
  api.registerHook("session:start", handleStart);

  // Access plugin config
  const config = api.pluginConfig;
  console.log(`API Key: ${config.apiKey}`);
}

// Option 2: Object export with lifecycle
export default {
  id: "my-plugin",

  register(api: MoltbotPluginApi) {
    // Registration logic
  },

  // Optional lifecycle methods
  async start() {
    // Called on gateway start
  },

  async stop() {
    // Called on gateway stop
  }
};
```

## Plugin Configuration

### User Config (moltbot.config.json)

```json
{
  "plugins": {
    "enabled": true,

    "allow": ["plugin-1", "plugin-2"],  // Allowlist (optional)
    "deny": ["disabled-plugin"],        // Denylist

    "load": {
      "paths": ["/custom/plugins"]      // Extra directories
    },

    "slots": {
      "memory": "memory-lancedb"        // Slot assignments
    },

    "entries": {
      "my-plugin": {
        "enabled": true,
        "config": {
          "apiKey": "sk-123...",
          "timeout": 10000
        }
      }
    }
  }
}
```

### Config Flow

```
1. Plugin defines configSchema in manifest
2. User provides config in plugins.entries[id].config
3. Loader validates against schema
4. Validated config passed to plugin via api.pluginConfig
```

## Plugin Loading

### Load Sequence

```
1. discoverMoltbotPlugins()       // Find candidates
2. loadPluginManifestRegistry()   // Validate manifests
3. Apply allow/deny lists
4. For each enabled plugin:
   a. Load module via Jiti (TypeScript transpiler)
   b. Validate config against schema
   c. Call register() with MoltbotPluginApi
   d. Plugin registers tools, hooks, etc.
5. startPluginServices()          // Start background services
```

### Jiti Transpilation

Plugins are loaded via **Jiti** - an on-demand TypeScript transpiler:
- No build step required
- TypeScript files run directly
- `moltbot/plugin-sdk` alias resolved automatically

## Plugin API Reference

### Core Properties

```typescript
interface MoltbotPluginApi {
  id: string;                    // Plugin ID
  name: string;                  // Display name
  version?: string;
  config: MoltbotConfig;         // Full system config
  pluginConfig?: Record<string, unknown>;  // Plugin-specific config
  runtime: PluginRuntime;        // 70+ helper methods
  logger: PluginLogger;          // Structured logging
}
```

### Registration Methods

#### registerTool

```typescript
// Static tool
api.registerTool({
  name: "my_tool",
  description: "Does something",
  parameters: {
    type: "object",
    properties: {
      input: { type: "string" }
    }
  },
  handler: async ({ input }) => {
    return {
      content: [{ type: "text", text: `Result: ${input}` }]
    };
  }
}, { optional: true });  // Optional tools need allowlist

// Factory function (gets fresh context per session)
api.registerTool((ctx) => ({
  name: "context_aware_tool",
  handler: async (params) => {
    // ctx.workspaceDir, ctx.config, ctx.agentId available
  }
}));
```

#### registerHook

```typescript
// Single event
api.registerHook("session:start", async (event) => {
  console.log(`Session ${event.sessionKey} started`);
});

// Multiple events
api.registerHook(["command:new", "command:reset"], handler);

// Wildcard
api.registerHook("agent:*", handler);
```

#### registerHttpRoute

```typescript
api.registerHttpRoute({
  path: "/my-plugin/webhook",
  handler: async (req, res) => {
    const body = await readBody(req);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  }
});
```

Routes mounted at `/plugins/my-plugin/webhook`.

#### registerHttpHandler

```typescript
// Generic handler (checked for all requests)
api.registerHttpHandler(async (req, res, next) => {
  if (req.url?.startsWith("/my-prefix/")) {
    // Handle request
    return;
  }
  next();  // Pass to next handler
});
```

#### registerGatewayMethod

```typescript
api.registerGatewayMethod("myPlugin.doSomething", async (params, ctx) => {
  const result = await processRequest(params);
  return { ok: true, data: result };
});
```

Clients call via: `{ method: "myPlugin.doSomething", params: {...} }`

#### registerChannel

```typescript
api.registerChannel({
  plugin: {
    id: "mychannel",
    adapters: {
      messaging: myMessagingAdapter,
      auth: myAuthAdapter,
      outbound: myOutboundAdapter,
      security: mySecurityAdapter,
    }
  },
  dock: {
    name: "My Channel",
    icon: "message-circle"
  }
});
```

#### registerProvider

```typescript
api.registerProvider({
  id: "myprovider",
  label: "My Provider",
  auth: [
    { type: "api_key", envVar: "MY_API_KEY" }
  ],
  models: {
    default: "model-1",
    list: [
      { id: "model-1", contextWindow: 8192 }
    ]
  }
});
```

#### registerCli

```typescript
api.registerCli((ctx) => {
  ctx.program
    .command("my-command")
    .description("Does something")
    .option("-f, --flag", "A flag")
    .action(async (opts) => {
      console.log("Running my command");
    });
}, { commands: ["my-command"] });
```

#### registerService

```typescript
api.registerService({
  name: "my-background-service",

  start: async (ctx) => {
    const interval = setInterval(() => {
      console.log("Service tick");
    }, 60000);

    return {
      stop: () => clearInterval(interval)
    };
  }
});
```

#### registerCommand

```typescript
// Quick command (bypasses agent)
api.registerCommand({
  name: "status",
  description: "Show plugin status",
  handler: async (ctx) => {
    return { text: "Plugin is running!" };
  }
});
```

### Lifecycle Hooks (api.on)

```typescript
api.on("before_agent_start", async (ctx) => {
  // Modify system prompt
  ctx.systemPrompt += "\n\nCustom instructions...";
});

api.on("agent_end", async (ctx) => {
  // Post-run analytics
  console.log(`Used ${ctx.usage.totalTokens} tokens`);
});

api.on("before_tool_call", async (ctx) => {
  // Can block tool
  if (ctx.toolName === "dangerous") {
    return { block: true, reason: "Disabled by plugin" };
  }
});

api.on("after_tool_call", async (ctx) => {
  // Analyze results
  console.log(`Tool ${ctx.toolName}:`, ctx.result);
});

api.on("message_received", async (ctx) => {
  // Inspect/modify incoming messages
});

api.on("message_sending", async (ctx) => {
  // Can cancel outbound
  if (shouldBlock(ctx.message)) {
    return { cancel: true };
  }
});
```

### All Lifecycle Hooks

| Hook | When | Can Modify |
|------|------|------------|
| `before_agent_start` | Before inference | System prompt |
| `agent_end` | After completion | - |
| `before_compaction` | Before summarizing | - |
| `after_compaction` | After summarizing | - |
| `message_received` | Inbound message | Can drop |
| `message_sending` | Before send | Can cancel |
| `message_sent` | After sent | - |
| `before_tool_call` | Before tool runs | Can block |
| `after_tool_call` | After tool runs | - |
| `tool_result_persist` | Before saving | Can modify |
| `session_start` | Session created | - |
| `session_end` | Session ended | - |
| `gateway_start` | Gateway up | - |
| `gateway_stop` | Gateway down | - |

## Plugin Runtime Helpers

The `api.runtime` object provides 70+ helper methods:

### Config

```typescript
runtime.loadConfig()
runtime.writeConfigFile(path, data)
runtime.getConfigPath()
```

### Media

```typescript
runtime.loadWebMedia(url)
runtime.detectMime(buffer)
runtime.resizeToJpeg(buffer, opts)
```

### Channel Helpers

```typescript
runtime.discord.sendMessage(channelId, content)
runtime.slack.postMessage(channel, text)
runtime.telegram.sendMessage(chatId, text)
runtime.whatsapp.sendMessage(jid, content)
// ... per channel
```

### System

```typescript
runtime.enqueueSystemEvent(text, opts)
runtime.runCommandWithTimeout(cmd, timeout)
runtime.getAgentDir(agentId)
runtime.getSessionDir(agentId)
```

## Plugin Types

### Tool Plugin

Adds capabilities for agents to use.

```typescript
export default function register(api: MoltbotPluginApi) {
  api.registerTool({
    name: "calculate",
    description: "Perform calculations",
    parameters: {
      type: "object",
      properties: {
        expression: { type: "string" }
      }
    },
    handler: async ({ expression }) => {
      const result = eval(expression);  // Don't do this in production!
      return { content: [{ type: "text", text: String(result) }] };
    }
  });
}
```

### Memory Plugin

Provides long-term memory storage.

```json
// moltbot.plugin.json
{
  "id": "memory-custom",
  "kind": "memory",
  "configSchema": { ... }
}
```

Only one memory plugin active at a time (slot-based).

### Channel Plugin

Adds new messaging platform.

```typescript
export default function register(api: MoltbotPluginApi) {
  api.registerChannel({
    plugin: {
      id: "mychannel",
      adapters: {
        messaging: {
          send: async (msg) => { /* send message */ },
          receive: async () => { /* poll for messages */ }
        },
        auth: {
          login: async (config) => { /* authenticate */ },
          logout: async () => { /* disconnect */ }
        }
      }
    }
  });
}
```

### Provider Plugin

Adds new model provider.

```typescript
export default function register(api: MoltbotPluginApi) {
  api.registerProvider({
    id: "local-llm",
    label: "Local LLM",
    clientType: "openai-compatible",
    auth: [{ type: "none" }],
    endpoints: {
      chat: "/v1/chat/completions"
    }
  });
}
```

### Service Plugin

Runs background tasks.

```typescript
export default function register(api: MoltbotPluginApi) {
  api.registerService({
    name: "sync-service",
    start: async () => {
      const handle = setInterval(syncData, 60000);
      return { stop: () => clearInterval(handle) };
    }
  });
}
```

## Plugin Isolation

### Process Model

- Plugins run in **same process** as gateway
- Share memory/resources with core
- Full Node.js API access
- **Trust-based model** (no sandbox)

### State Isolation

- Each plugin has own registry entry
- Hooks called in priority order
- HTTP routes namespaced by plugin ID
- Services get `stateDir` for persistence

## Plugin Debugging

### Status Check

```bash
moltbot plugins status          # List loaded plugins
moltbot plugins status --all    # Include disabled
moltbot plugins status --deep   # Probe health
```

### Logging

```typescript
api.logger.debug("Detailed info");
api.logger.info("User-facing info");
api.logger.warn("Warning");
api.logger.error("Error");
```

### Diagnostics

```typescript
// Registry tracks warnings/errors
registry.diagnostics[]
// Includes: config errors, load failures, hook errors
```

## Example Plugins

### extensions/llm-task

Simple LLM-based task processor (254 bytes):

```typescript
export default (api) => {
  api.registerTool({
    name: "llm_task",
    handler: async ({ prompt }) => {
      // Process with LLM
    }
  });
};
```

### extensions/memory-lancedb

Vector memory with LanceDB:
- `kind: "memory"` in manifest
- Hooks into `before_agent_start`
- Provides `memory_search` tool

### extensions/discord

Full Discord channel:
- Complex config schema
- Implements all adapters
- Auth, outbound, security

### extensions/voice-call

Voice calls via Twilio:
- HTTP webhook endpoints
- Background listener service
- TTS integration
- CLI for call management

## Building a Plugin Checklist

1. **Create structure**
   ```bash
   mkdir my-plugin && cd my-plugin
   npm init -y
   ```

2. **Add manifest** (`moltbot.plugin.json`)
   - Set id, name, configSchema

3. **Create entry** (`index.ts`)
   - Export register function
   - Import from `moltbot/plugin-sdk`

4. **Register capabilities**
   - Tools, hooks, routes, etc.

5. **Test locally**
   ```bash
   # Place in extensions directory
   cp -r my-plugin ~/.config/moltbot/extensions/

   # Check status
   moltbot plugins status
   ```

6. **Publish**
   ```bash
   npm publish
   # Users install via:
   moltbot plugins install @scope/my-plugin
   ```

---

# Porting to LlamaFarm

Key components to extract for adding agentic workflows to LlamaFarm.

## Core Components to Port

### 1. Session Management

```
src/config/sessions/     → Session storage, metadata
src/sessions/            → Session model, transcripts
```

**What it provides:**
- JSONL transcript storage
- Session metadata (tokens, model overrides, state)
- Multi-session isolation
- Compaction (context overflow handling)

### 2. Tool System

```
src/agents/pi-tools.ts   → Tool loading, execution
src/agents/tool-policy.ts → Allow/deny filtering
src/plugins/tools.ts     → Plugin tool registration
```

**What it provides:**
- Tool definition interface
- Policy-based filtering (9 layers)
- Dynamic tool loading via plugins
- Tool result sanitization

### 3. Agent Loop

```
src/agents/pi-embedded-runner/  → Main agent execution
src/agents/pi-embedded-subscribe.handlers.* → Event handling
```

**What it provides:**
- Streaming inference with tool calls
- Block chunking for partial responses
- Retry with failover (auth, rate limit, context)
- Thinking level management

### 4. Hooks System

```
src/hooks/               → Event-driven automation
src/plugins/hooks.ts     → Plugin hook registration
```

**What it provides:**
- Event subscription pattern
- Lifecycle hooks (before/after agent, tool, session)
- Dynamic modification of prompts/context

### 5. Queue Management

```
src/process/command-queue.ts  → Lane-based serialization
```

**What it provides:**
- Session-scoped serialization
- Multiple queue modes (steer, collect, etc.)
- Mid-stream message injection

### 6. Memory/Workspace

```
src/agents/workspace.ts      → Workspace bootstrap
src/memory/                  → Vector memory search
```

**What it provides:**
- Bootstrap file injection
- Hybrid vector + FTS search
- Embedding sync triggers

## Minimal Agent Runtime

For LlamaFarm, the minimal viable agent runtime needs:

```typescript
interface MinimalAgentRuntime {
  // Session management
  sessions: {
    create(id: string): Session;
    get(id: string): Session | null;
    appendMessage(id: string, message: Message): void;
    getHistory(id: string): Message[];
  };

  // Tool execution
  tools: {
    register(tool: Tool): void;
    list(): Tool[];
    execute(name: string, args: unknown): Promise<ToolResult>;
  };

  // Inference loop
  agent: {
    run(sessionId: string, message: string): AsyncIterable<AgentEvent>;
  };

  // Hooks
  hooks: {
    on(event: string, handler: HookHandler): void;
    emit(event: string, data: unknown): void;
  };
}
```

## Implementation Priority

1. **Sessions** - Foundation for stateful conversations
2. **Tools** - Extensibility and capabilities
3. **Agent Loop** - Core inference with tool calling
4. **Hooks** - Customization and automation
5. **Queue** - Concurrency control (optional for single-user)
6. **Memory** - Long-term context (optional)
