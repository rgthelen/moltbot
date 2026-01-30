# Plan: LlamaFarm-Powered Agent System

## Overview

Create a LlamaFarm extension for Moltbot that:
1. Uses LlamaFarm as the LLM backend instead of cloud providers (Anthropic, OpenAI)
2. Bootstraps to `~/.llamafarm/clawdbot/` (not `.clawdbot/` which is in use)
3. Runs a headless gateway on port 3332
4. Exposes an OpenAI-compatible chat API
5. Uses Qwen3-8B (via LlamaFarm's universal provider) for inference
6. Supports dynamic system prompts and tools via LlamaFarm variables
7. Preserves Moltbot's built-in memory system (not LlamaFarm RAG)

## Agents to Use

- **llamafarm** - For LlamaFarm project setup, API configuration
- **backend-architect** - For extension architecture and API design
- **test-runner** - After each phase to run and verify tests
- **debugger** - If any tests fail
- **demo-builder** - To create phase demos
- **code-reviewer** - After significant implementations

## LlamaFarm API Usage

**⚠️ CRITICAL: Bootstrap LlamaFarm config via API, NOT by writing files directly!**

Reference: `.claude/docs/llamafarm-api.md`

### Bootstrap APIs (for creating/managing projects):
- `GET /v1/projects/{namespace}` - List projects (check if exists first!)
- `POST /v1/projects/{namespace}` - Create project with `config_template`
- `GET /v1/projects/{namespace}/{project}` - Get project details
- `PUT /v1/projects/{namespace}/{project}` - Update project configuration
- `GET /health` - Health check for LlamaFarm server

### Chat APIs (for inference):
- `POST /v1/projects/{namespace}/{project}/chat/completions` - Main chat endpoint (OpenAI-compatible)
- `GET /v1/projects/{namespace}/{project}/models` - List available models

### Chat Completion Request Format:
```json
{
  "messages": [{"role": "user", "content": "Hello!"}],
  "stream": true,           // ALWAYS use streaming when possible
  "rag_enabled": false,     // ALWAYS disable RAG (using Moltbot memory)
  "temperature": 0.7,
  "max_tokens": 1000,
  "variables": {            // For dynamic prompt injection
    "system_prompt": "...",
    "tools": "..."
  }
}
```

### Testing Requirements:
- **LlamaFarm is LIVE on port 8000** - do REAL server/model testing!
- Use `lf services status` to check if services are running
- Use `lf services start/stop` to manage services
- All demos and tests should hit the real LlamaFarm server

**NOT Using:**
- RAG APIs (using Moltbot's built-in memory system instead)
- Classifier/Anomaly APIs (not needed for agents)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Moltbot Gateway (port 3332)                  │
│   • Uses ~/.llamafarm/clawdbot/ as state directory              │
│   • Bootstrap files: SOUL.md, AGENTS.md, TOOLS.md, etc.         │
│   • Built-in memory system preserved                             │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                  LlamaFarm Extension                             │
│   • Service: Bootstrap LlamaFarm project on startup             │
│   • Provider: llamafarm (OpenAI-compatible)                     │
│   • Tools: Mock skills (notify, control, move)                  │
│   • Config: llamafarm.yaml with Qwen3-8B                        │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              LlamaFarm Server (port 8000 default)               │
│   • Universal runtime with Qwen3-8B-GGUF:Q4_K_M                 │
│   • Dynamic variables: {{system_prompt}}, {{tools}}             │
│   • OpenAI-compatible chat/completions endpoint                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Extension Skeleton & Configuration

### Phase 1 Tests (Define FIRST)
- [x] Test: Extension loads without errors
- [x] Test: Extension registers as plugin with correct ID
- [x] Test: Config schema validates correctly
- [x] Test: Plugin config can specify LlamaFarm server URL, project namespace/name
- [x] Test file: `extensions/llamafarm/tests/extension.test.ts`

### Phase 1 Demo (Define FIRST)
- [x] Demo script: `extensions/llamafarm/demos/demo-extension-load.sh`
- [x] Demo shows: Extension loads in Moltbot and logs registration
- [x] Expected output: "LlamaFarm extension registered" in logs

### Phase 1 Implementation
- [x] Create `extensions/llamafarm/` directory structure
- [x] Create `package.json` with moltbot peer dependency
- [x] Create `index.ts` with basic plugin registration
- [x] Define config schema (serverUrl, namespace, project, modelName)
- [x] Create type definitions for plugin config
- [x] Add placeholder for service and tools

### Phase 1 Verification
- [x] Run tests: `pnpm test extensions/llamafarm/tests/extension.test.ts`
- [x] All tests pass
- [x] Run demo: `bash extensions/llamafarm/demos/demo-extension-load.sh`
- [x] Demo runs successfully

### Phase 1 Checkpoint
- [x] Tests verified passing
- [x] Demo verified working
- [x] Ready for Phase 2

---

## Phase 2: LlamaFarm Project Bootstrap Service

### Phase 2 Tests (Define FIRST)
- [x] Test: Service creates LlamaFarm project directory if missing
- [x] Test: Service generates valid llamafarm.yaml with Qwen3-8B
- [x] Test: Service detects existing project and doesn't overwrite
- [x] Test: Service validates LlamaFarm server is reachable
- [x] Test: Service logs project creation status
- [x] Test file: `extensions/llamafarm/tests/bootstrap.test.ts`

### Phase 2 Demo (Define FIRST)
- [x] Demo script: `extensions/llamafarm/demos/demo-bootstrap.sh`
- [x] Demo shows: Fresh project creation at `~/.llamafarm/demo-bootstrap/`
- [x] Expected output: llamafarm.yaml created, server health check passes

### Phase 2 Implementation
- [x] Create `src/bootstrap.ts` - LlamaFarm project initialization
- [x] Create `src/client.ts` - HTTP client for LlamaFarm API
- [x] **USE LLAMAFARM API to bootstrap project** (NOT file writes!):
  - `GET /v1/projects/{namespace}` to check if project exists
  - `POST /v1/projects/{namespace}` to create project with config
  - `PUT /v1/projects/{namespace}/{project}` to update config
- [x] Configure project with:
  - Model: `qwen3-8b` pointing to `Qwen/Qwen3-8B-GGUF:Q4_K_M`
  - Prompts with `{{system_prompt}}` variable for dynamic injection
  - Tools with `{{tools_context}}` variable for dynamic injection
  - RAG disabled (`rag_enabled: false` in requests)
- [x] Implement health check for LlamaFarm server
- [x] Register service in index.ts
- [x] Handle idempotent restarts (don't recreate if exists)

### Phase 2 Verification
- [x] Run tests: `pnpm test extensions/llamafarm/tests/bootstrap.test.ts`
- [x] All tests pass
- [x] Run demo: `bash extensions/llamafarm/demos/demo-bootstrap.sh`
- [x] Demo runs successfully

### Phase 2 Checkpoint
- [x] Tests verified passing
- [x] Demo verified working
- [x] Ready for Phase 3

---

## Phase 3: Model Provider Integration

### Phase 3 Tests (Define FIRST)
- [x] Test: Provider resolves to LlamaFarm endpoint
- [x] Test: Chat completion request sends correct format
- [x] Test: System prompt passed via variables field
- [x] Test: Tools passed via variables field
- [x] Test: Streaming responses handled correctly (verified via curl with stream=true)
- [x] Test: Non-streaming responses handled correctly
- [x] Test file: `extensions/llamafarm/tests/provider.test.ts`

### Phase 3 Demo (Define FIRST)
- [x] Demo script: `extensions/llamafarm/demos/demo-chat.sh`
- [x] Demo shows: Send chat message through LlamaFarm API → response
- [x] Expected output: Agent responds with Qwen model generated text

### Phase 3 Implementation
- [x] Create provider with auth flow that configures llamafarm provider:
  - Provider ID: `llamafarm`
  - Base URL: `http://localhost:8000/v1/projects/{namespace}/{project}`
  - API: `openai-completions`
  - Model definitions with context window and max tokens
- [x] Configure llamafarm.yaml to accept `{{system_prompt}}` variable
- [x] Configure llamafarm.yaml to accept `{{tools_context}}` variable
- [x] Test message flow: Client → LlamaFarm → Qwen → Response
- [x] Provider returns configPatch with model selection

### Phase 3 Verification
- [x] Run tests: `pnpm test extensions/llamafarm/tests/provider.test.ts`
- [x] All tests pass (11/11)
- [x] Run demo: `bash extensions/llamafarm/demos/demo-chat.sh`
- [x] Demo runs successfully

### Phase 3 Checkpoint
- [x] Tests verified passing
- [x] Demo verified working
- [x] Ready for Phase 4

---

## Phase 4: Workspace Bootstrap & State Directory

### Phase 4 Tests (Define FIRST)
- [x] Test: State directory created at `~/.llamafarm/moltbot-workspace/` not `.clawdbot/`
- [x] Test: SOUL.md, AGENTS.md, TOOLS.md created from templates
- [x] Test: USER.md, IDENTITY.md, MEMORY.md created
- [x] Test: memory/ directory created
- [x] Test: Config file moltbot.json created in state dir
- [x] Test: Existing `.clawdbot/` NOT modified
- [x] Test file: `extensions/llamafarm/tests/workspace.test.ts`

### Phase 4 Demo (Define FIRST)
- [x] Demo script: `extensions/llamafarm/demos/demo-workspace.sh`
- [x] Demo shows: Full workspace with all files and moltbot.json config
- [x] Expected output: ls showing all bootstrap files, memory dir

### Phase 4 Implementation
- [x] Create template functions in `src/workspace.ts`:
  - getSoulTemplate() - LlamaFarm agent soul
  - getAgentsTemplate() - LlamaFarm agents config
  - getToolsTemplate() - LlamaFarm-specific tools
  - getUserTemplate(), getIdentityTemplate(), getMemoryTemplate()
- [x] Implement workspace bootstrap in bootstrapWorkspace():
  - Respects `MOLTBOT_STATE_DIR` env var
  - Creates workspace directory structure
  - Writes templates on first run
- [x] Ensure memory system uses new state directory
- [x] Generate moltbot.json config with:
  - gateway.port: 3332
  - agents.defaults.workspace: ~/.llamafarm/moltbot-workspace/workspace
  - models.providers.llamafarm (from Phase 3)

### Phase 4 Verification
- [x] Run tests: `pnpm test extensions/llamafarm/tests/workspace.test.ts`
- [x] All tests pass (25/25)
- [x] Run demo: `bash extensions/llamafarm/demos/demo-workspace.sh`
- [x] Demo runs successfully

### Phase 4 Checkpoint
- [x] Tests verified passing
- [x] Demo verified working
- [x] Ready for Phase 5

---

## Phase 5: Mock Skills Plugin (notify, control, move)

### Phase 5 Tests (Define FIRST)
- [x] Test: `llamafarm-notify` tool registered and callable
- [x] Test: `llamafarm-control` tool registered and callable
- [x] Test: `llamafarm-move` tool registered and callable
- [x] Test: Tools appear in agent's available tools
- [x] Test: Tool execution returns expected format
- [x] Test: Tools passed to LlamaFarm via variables
- [x] Test file: `extensions/llamafarm/tests/mock-skills.test.ts`

### Phase 5 Demo (Define FIRST)
- [x] Demo script: Tools tested via real LlamaFarm API
- [x] Demo shows: Agent calls mock tools, tools execute and return results
- [x] Expected output: Tool calls logged, mock results returned

### Phase 5 Implementation
- [x] Create `src/tools/notify.ts` - Mock notification tool
- [x] Create `src/tools/control.ts` - Mock control tool
- [x] Create `src/tools/move.ts` - Mock move tool
- [x] Register tools in index.ts
- [x] Ensure tool schemas are JSON-serializable for LlamaFarm
- [x] Test tool invocation flow:
  - Moltbot builds tool list
  - Tools serialized to LlamaFarm format
  - LlamaFarm model calls tools
  - Results returned to agent

### Phase 5 Verification
- [x] Run tests: `pnpm test extensions/llamafarm/tests/mock-skills.test.ts`
- [x] All tests pass (12/12)
- [x] Tools tested via real LlamaFarm API integration
- [x] Tests run successfully

### Phase 5 Checkpoint
- [x] Tests verified passing
- [x] Integration with LlamaFarm verified
- [x] Ready for Phase 6

---

## Phase 6: Gateway & Chat API on Port 3332

### Phase 6 Tests (Define FIRST)
- [ ] Test: Gateway starts on port 3332
- [ ] Test: WebSocket endpoint available at ws://127.0.0.1:3332
- [ ] Test: HTTP endpoint `/v1/chat/completions` available
- [ ] Test: Chat API accepts OpenAI-compatible requests
- [ ] Test: Chat API returns OpenAI-compatible responses
- [ ] Test: Streaming works via SSE
- [ ] Test file: `extensions/llamafarm/tests/gateway.test.ts`

### Phase 6 Demo (Define FIRST)
- [ ] Demo script: `extensions/llamafarm/demos/demo-gateway.sh`
- [ ] Demo shows: Start gateway, send curl request to chat API, get response
- [ ] Expected output: HTTP 200 with chat completion response

### Phase 6 Implementation
- [ ] Configure moltbot.json with:
  ```json
  {
    "gateway": {
      "port": 3332,
      "mode": "local",
      "bind": "loopback"
    }
  }
  ```
- [ ] Create startup script that:
  - Sets MOLTBOT_STATE_DIR
  - Ensures LlamaFarm is running
  - Starts gateway with correct config
- [ ] Verify `/v1/chat/completions` endpoint works
- [ ] Test full round-trip: curl → gateway → LlamaFarm → Qwen → response

### Phase 6 Verification
- [ ] Run tests: `pnpm test extensions/llamafarm/tests/gateway.test.ts`
- [ ] All tests pass
- [ ] Run demo: `bash extensions/llamafarm/demos/demo-gateway.sh`
- [ ] Demo runs successfully

### Phase 6 Checkpoint
- [ ] Tests verified passing
- [ ] Demo verified working
- [ ] Ready for Phase 7

---

## Phase 7: Integration Testing & Documentation

### Phase 7 Tests (Define FIRST)
- [ ] Test: Full integration - send message, agent responds using LlamaFarm
- [ ] Test: Agent uses SOUL.md personality
- [ ] Test: Agent can call mock tools
- [ ] Test: Memory persists to correct directory
- [ ] Test: Multiple messages in session maintain context
- [ ] Test: System handles LlamaFarm server down gracefully
- [ ] Test file: `extensions/llamafarm/tests/integration.test.ts`

### Phase 7 Demo (Define FIRST)
- [ ] Demo script: `extensions/llamafarm/demos/demo-full-integration.sh`
- [ ] Demo shows: Complete flow from startup to conversation with tools
- [ ] Expected output: Full conversation with tool calls and memory

### Phase 7 Implementation
- [ ] Run full integration tests
- [ ] Create README.md for extension
- [ ] Document configuration options
- [ ] Document startup procedure
- [ ] Add troubleshooting guide
- [ ] Copy final templates to `templates/llamafarm/` for auditability

### Phase 7 Verification
- [ ] Run all tests: `pnpm test extensions/llamafarm/tests/`
- [ ] All tests pass
- [ ] Run demo: `bash extensions/llamafarm/demos/demo-full-integration.sh`
- [ ] Demo runs successfully

### Phase 7 Checkpoint
- [ ] Tests verified passing
- [ ] Demo verified working
- [ ] Documentation complete
- [ ] Ready for final review

---

## File Structure

```
extensions/llamafarm/
├── package.json
├── index.ts                    # Plugin entry point
├── README.md                   # Documentation
├── src/
│   ├── config-schema.ts        # Config validation schema
│   ├── service.ts              # Bootstrap service
│   ├── bootstrap.ts            # LlamaFarm project initialization
│   ├── llamafarm-client.ts     # HTTP client for LlamaFarm API
│   ├── provider-config.ts      # Model provider configuration
│   └── tools/
│       ├── notify.ts           # Mock notify tool
│       ├── control.ts          # Mock control tool
│       └── move.ts             # Mock move tool
├── templates/
│   ├── llamafarm.yaml          # LlamaFarm project config
│   ├── moltbot.json            # Moltbot config for LlamaFarm mode
│   ├── SOUL.md                 # Agent soul template
│   ├── AGENTS.md               # Workspace instructions
│   ├── TOOLS.md                # Tools reference
│   ├── USER.md                 # User context
│   ├── IDENTITY.md             # Identity template
│   └── HEARTBEAT.md            # Heartbeat template
├── tests/
│   ├── extension.test.ts
│   ├── bootstrap.test.ts
│   ├── provider.test.ts
│   ├── workspace.test.ts
│   ├── mock-skills.test.ts
│   ├── gateway.test.ts
│   └── integration.test.ts
└── demos/
    ├── demo-extension-load.sh
    ├── demo-bootstrap.sh
    ├── demo-chat.sh
    ├── demo-workspace.sh
    ├── demo-tools.sh
    ├── demo-gateway.sh
    └── demo-full-integration.sh

templates/llamafarm/             # Copied for auditability
├── llamafarm.yaml
├── moltbot.json
├── SOUL.md
├── AGENTS.md
├── TOOLS.md
├── USER.md
├── IDENTITY.md
└── HEARTBEAT.md
```

---

## Key Configuration Files

### llamafarm.yaml (for LlamaFarm project)
```yaml
version: v1
name: clawdbot-agent
namespace: clawdbot

runtime:
  models:
    - name: agent
      description: "Moltbot agent model"
      provider: universal
      model: Qwen/Qwen3-8B-GGUF:Q4_K_M
      default: true
      prompts: [system]

prompts:
  - name: system
    messages:
      - role: system
        content: "{{system_prompt | You are a helpful assistant.}}"

# RAG disabled - using Moltbot's built-in memory system
rag:
  enabled: false
```

### moltbot.json (for Moltbot state)
```json
{
  "gateway": {
    "port": 3332,
    "mode": "local",
    "bind": "loopback"
  },
  "agents": {
    "defaults": {
      "workspace": "~/.llamafarm/clawdbot/workspace",
      "model": {
        "primary": "llamafarm/agent"
      }
    }
  },
  "models": {
    "providers": {
      "llamafarm": {
        "baseUrl": "http://localhost:8000/v1/projects/clawdbot/clawdbot-agent",
        "api": "openai-completions",
        "apiKey": "dummy",
        "models": [
          {
            "id": "agent",
            "name": "Qwen3-8B Agent",
            "reasoning": false,
            "input": ["text"],
            "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
            "contextWindow": 8192,
            "maxTokens": 4096
          }
        ]
      }
    }
  },
  "plugins": {
    "enabled": ["llamafarm"]
  }
}
```

---

## Final Success Criteria

- [ ] Extension loads and bootstraps LlamaFarm project automatically
- [ ] Gateway runs on port 3332 (not 18789)
- [ ] State directory is `~/.llamafarm/clawdbot/` (not `.clawdbot/`)
- [ ] Existing `.clawdbot/` directory is untouched
- [ ] SOUL.md, AGENTS.md, TOOLS.md bootstrapped correctly
- [ ] Memory system uses new state directory
- [ ] Agent uses Qwen3-8B via LlamaFarm for inference
- [ ] Mock tools (notify, control, move) work correctly
- [ ] Chat API accessible at http://127.0.0.1:3332/v1/chat/completions
- [ ] All tests pass
- [ ] All demos run successfully
- [ ] Templates copied to `templates/llamafarm/` for auditability
