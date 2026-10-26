# ShellMind Architecture Document

## 1. System Overview

ShellMind is a modular AI copilot engineered specifically for native shell environments. It avoids emulating or wrapping pseudo-terminals (`pty`), instead acting as an inline command generator and execution supervisor.

```
                          +-------------------+
                          |    User Shell     |  (Bash, Zsh, Fish, PS, CMD)
                          |  alias ai="shell" |
                          +---------+---------+
                                    |
                                    v
                          +-------------------+
                          |  @shellmind/cli   |  (Commander.js, UX, Spinners)
                          +---------+---------+
                                    |
                                    v
                          +-------------------+
                          |   @shellmind/core |  (Orchestrator, Config, Events)
                          +---+-----+-----+---+
                              |     |     |
              +---------------+     |     +---------------+
              |                     |                     |
              v                     v                     v
     +-----------------+   +-----------------+   +-----------------+
     | @shellmind/     |   | @shellmind/     |   | @shellmind/     |
     |   context       |   |   memory        |   |   plugins       |
     | (OS,Git,Files)  |   | (History,Alias) |   | (Docker,k8s,TF) |
     +--------+--------+   +--------+--------+   +--------+--------+
              |                     |                     |
              +---------------+     |     +---------------+
                              |     |     |
                              v     v     v
                          +-------------------+
                          |   @shellmind/ai   |  (Gemini, OpenAI, Ollama)
                          +---------+---------+
                                    |
                                    v
                          +-------------------+
                          |@shellmind/security|  (SAFE, MEDIUM, HIGH, CRITICAL)
                          +---------+---------+
                                    |
                      [User Confirmation Required]
                                    |
                                    v
                          +-------------------+
                          |@shellmind/executor|  (Subprocess runner, streams)
                          +-------------------+
```

---

## 2. Package Decomposition & Responsibilities

| Package | Responsibility | Inbound Dependencies | Outbound Dependencies |
| :--- | :--- | :--- | :--- |
| `@shellmind/core` | System contracts, orchestrator lifecycle, configuration schema, event bus | `cli` | `context`, `memory`, `ai`, `security`, `executor` |
| `@shellmind/cli` | Commander CLI entrypoint, terminal UX, color palettes, interactive prompts | Top-level | `core`, `shell` |
| `@shellmind/ai` | LLM provider abstraction, structured JSON prompt pipelines, retry & fallback | `core` | external SDKs |
| `@shellmind/executor`| Safe process spawning, stream buffering, stdout/stderr isolation, exit traps | `core` | Node child_process/execa |
| `@shellmind/security`| Deterministic pattern matching, AST command tokenization, risk scoring | `core` | None (pure domain) |
| `@shellmind/shell` | Shell detection ($SHELL, ComSpec), profile installer (.bashrc, etc.), tab completions | `cli` | Node fs/os |
| `@shellmind/context` | Environmental discovery: Git branch, Docker manifests, package files, installed tools | `core` | Node fs/os |
| `@shellmind/memory` | SQLite/JSON persistent command store, pattern learning, project workflow memory | `core` | Node fs/crypto |
| `@shellmind/plugins` | Extensible capability injection for Git, Docker, Node, Python, AWS, k8s, TF | `core` | `context` |

---

## 3. Strict Security Model

ShellMind enforces the principle of **Zero Unconfirmed Executions**.

### 3.1 Risk Scoring Algorithm
1. **Critical Regex Evaluation**: Immediate escalation to `CRITICAL` for irreversible destructive operations (e.g. `rm -rf /`, formatting disks, writing raw sectors).
2. **Privilege Escalation**: `sudo`, `doas`, or `runas` elevates baseline risk by one tier.
3. **Piping & Network Ingestion**: Piping remote code execution (`curl ... | sh` or `wget -O- ... | bash`) is marked `CRITICAL` or `HIGH`.
4. **Interactive Confirmation Protocol**:
   - `SAFE`: User presses Enter or `Y`.
   - `MEDIUM`: User presses Enter or `Y` after explicit caution notice.
   - `HIGH`: User must confirm prompt with `Y`.
   - `CRITICAL`: User is required to type the exact word `CONFIRM` or `YES_I_AM_SURE` before execution is unlocked.

---

## 4. Multi-Provider Fallback Architecture

Providers implement the unified `IAIProvider` interface:
```typescript
export interface IAIProvider {
  readonly id: 'gemini' | 'openai' | 'ollama';
  generateCommand(request: CommandRequest): Promise<CommandPlan>;
  explainCommand(command: string, context?: SystemContext): Promise<CommandExplanation>;
  diagnoseError(stderr: string, command: string): Promise<ErrorDiagnosis>;
}
```
- **Gemini**: Primary cloud provider using `@google/genai` with `gemini-3.8-flash`.
- **OpenAI**: Compatible with `gpt-4o`, `gpt-4o-mini`, and local OpenAI-compatible endpoints (vLLM, LocalAI).
- **Ollama**: 100% private offline local execution (`llama3`, `codellama`, `deepseek-coder`).
