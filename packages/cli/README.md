# ShellMind — AI Terminal Copilot

> **An AI-powered terminal copilot that integrates seamlessly with your existing terminal instead of replacing it.**

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict%205.x-3178C6.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A522.0.0-339933.svg)](https://nodejs.org/)
[![Architecture](https://img.shields.io/badge/Architecture-Monorepo%20(9%20Pkgs)-blueviolet.svg)](./docs/architecture.md)
[![Zero Auto-Exec](https://img.shields.io/badge/Security-Zero%20Auto--Execution-critical.svg)](./docs/security.md)

---

## ⚡ Why ShellMind?

Traditional terminal wrappers try to replace your shell with heavy Electron or custom emulator windows, losing your dotfiles, tmux sessions, custom keybindings, and plugins.

**ShellMind takes a fundamentally different path**:
- **Zero Replacement**: Installs as an alias and completion script directly into your native shell (Bash, Zsh, Fish, PowerShell, CMD).
- **Zero Blind Execution**: Every single generated command is halted with full explanation, risk grading (`SAFE`, `MEDIUM`, `HIGH`, `CRITICAL`), and human confirmation before touching your system.
- **Context-Aware**: Automatically inspects current git repository, branch, Dockerfiles, package manifests (`package.json`, `Cargo.toml`, `go.mod`), OS version, and installed toolchains to craft exact syntax.
- **Provider Agnostic**: Seamlessly switch between Google Gemini, OpenAI, or local private offline Ollama models.
- **Error Doctor**: When a shell command fails, ShellMind inspects `stderr`, diagnoses root cause permissions/flags/missing tools, and proposes surgical fixes.

---

## 🚀 Quick Tour

```bash
# Natural Language to Command
ai "find every pdf larger than 20MB"

# Output:
# Command:     find . -type f -name "*.pdf" -size +20M
# Explanation: Searches current directory recursively for files ending with .pdf larger than 20 megabytes
# Risk:        SAFE (Read-only query)
# [Y] Execute   [N] Cancel   [E] Edit command

# Command Explainer
ai explain "chmod -R 755 /var/www"

# Safe Execution with Context
ai run "docker compose logs -f api"

# Doctor & Health Check
ai doctor

# Provider Configuration
ai provider set gemini
```

---

## 🏗️ Monorepo Architecture

ShellMind is engineered as a clean, decoupled monorepo following strict SOLID principles:

```
shellmind/
├── packages/
│   ├── core/         # Orchestrator, domain models, config manager, lifecycle events
│   ├── cli/          # Commander.js CLI binary, terminal UX, prompts, spinners
│   ├── ai/           # Multi-provider LLM abstraction (Gemini, OpenAI, Ollama)
│   ├── executor/     # Safe subprocess execution, stream handling, timeout control
│   ├── security/     # Risk classification (SAFE/MEDIUM/HIGH/CRITICAL), guardrails
│   ├── shell/        # Shell detection, rc installer, alias & completion hooks
│   ├── context/      # Context engine: Git, Docker, project indicators, tools, OS
│   ├── memory/       # Command history, workflow learning, project alias cache
│   └── plugins/      # Extensible plugins: Git, Docker, Node, Python, AWS, k8s, TF
├── docs/             # Comprehensive architectural & developer documentation
├── examples/         # Workflow examples and configuration recipes
├── scripts/          # Build, release, and packaging scripts
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

---

## 🛡️ Security Risk Matrix

| Risk Level | Description | Confirmation Required | Example |
| :--- | :--- | :--- | :--- |
| **SAFE** | Non-destructive queries, read-only listings | Single key `[Y/n]` | `ls -la`, `pwd`, `git status` |
| **MEDIUM** | Resource modifications, container shutdowns | Single key `[Y/n]` with warning | `docker compose down`, `git stash` |
| **HIGH** | Recursive permissions, bulk deletions, file overwrites | Explicit prompt `[Y/n]` with impact summary | `chmod -R 777`, `rm -rf node_modules` |
| **CRITICAL** | Irreversible disk changes, root filesystem deletions, kernel writes | **Mandatory typed string confirmation** (`CONFIRM`) | `sudo rm -rf /`, `mkfs.ext4`, `dd of=/dev/sda` |

---

## 📦 Phase Implementation Status

- **Phase 1: Project Initialization & Clean Architecture Foundations** (Completed)
  - Monorepo workspace setup (`pnpm-workspace.yaml`, `turbo.json`, root configs)
  - 9 domain packages with typed public interfaces and core implementations
  - Deterministic Security Analyzer with 4-tier risk classification and typed confirmation rules
  - Context engine specification for OS, Shell, Git, and Project file detection
  - Multi-provider AI interface contract supporting Gemini, OpenAI, and Ollama
  - Interactive Web Playground & Architecture Center for browser verification
- **Phase 2: Context Engine & Deep Shell Telemetry** (Upcoming)
- **Phase 3: Multi-Provider AI Implementation & Prompt Engineering** (Upcoming)
- **Phase 4: Security Layer & Interactive Execution Engine** (Upcoming)
- **Phase 5: Shell Integrations, Completions & Plugins** (Upcoming)
- **Phase 6: Distribution, Native Binaries & Packaging** (Upcoming)

---

## 📄 License

Apache-2.0 License. Built for developers who care about speed, power, and safety in the terminal.
