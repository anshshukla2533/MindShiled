// server.ts
import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

// packages/core/src/config/schema.ts
var DEFAULT_SHELLMIND_CONFIG = {
  version: "1.0.0",
  provider: {
    active: "gemini",
    gemini: {
      model: "gemini-3.1-flash-lite",
      temperature: 0.2
    },
    openai: {
      model: "gpt-4o",
      baseUrl: "https://api.openai.com/v1"
    },
    ollama: {
      endpoint: "http://localhost:11434",
      model: "llama3:latest"
    }
  },
  security: {
    enforceZeroAutoExecution: true,
    requireTypedConfirmationForCritical: true,
    blockedCommands: [
      ":(){ :|:& };:"
      // fork bomb
    ]
  },
  ui: {
    theme: "dark",
    showExplanationByDefault: true,
    colorizedOutput: true
  },
  telemetry: {
    enabled: false
  }
};

// packages/core/src/config/manager.ts
var ConfigManager = class {
  config;
  configPath;
  constructor(initialConfig, customPath) {
    this.configPath = customPath || this.resolveDefaultConfigPath();
    this.config = this.mergeWithDefaults(initialConfig);
  }
  resolveDefaultConfigPath() {
    const isWindows = process.platform === "win32";
    if (isWindows) {
      const appData = process.env.APPDATA || process.env.USERPROFILE || "C:\\";
      return `${appData}\\ShellMind\\config.json`;
    }
    const home = process.env.HOME || "/root";
    return `${home}/.shellmind/config.json`;
  }
  getConfig() {
    return JSON.parse(JSON.stringify(this.config));
  }
  getConfigPath() {
    return this.configPath;
  }
  setActiveProvider(providerId) {
    this.config.provider.active = providerId;
  }
  updateConfig(partial) {
    this.config = this.mergeWithDefaults(partial);
    return this.getConfig();
  }
  resetToDefaults() {
    this.config = JSON.parse(JSON.stringify(DEFAULT_SHELLMIND_CONFIG));
    return this.getConfig();
  }
  mergeWithDefaults(partial) {
    if (!partial) {
      return JSON.parse(JSON.stringify(DEFAULT_SHELLMIND_CONFIG));
    }
    return {
      ...DEFAULT_SHELLMIND_CONFIG,
      ...partial,
      provider: {
        ...DEFAULT_SHELLMIND_CONFIG.provider,
        ...partial.provider || {}
      },
      security: {
        ...DEFAULT_SHELLMIND_CONFIG.security,
        ...partial.security || {}
      },
      ui: {
        ...DEFAULT_SHELLMIND_CONFIG.ui,
        ...partial.ui || {}
      },
      telemetry: {
        ...DEFAULT_SHELLMIND_CONFIG.telemetry,
        ...partial.telemetry || {}
      }
    };
  }
};

// packages/core/src/events.ts
var EventEmitter = class {
  listeners = /* @__PURE__ */ new Map();
  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, /* @__PURE__ */ new Set());
    }
    const set = this.listeners.get(event);
    set.add(handler);
    return () => set.delete(handler);
  }
  async emit(event, data) {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    for (const handler of Array.from(handlers)) {
      try {
        await handler(data);
      } catch (err) {
        console.error(`[ShellMind Event Error: ${event}]`, err);
      }
    }
  }
};

// packages/core/src/orchestrator.ts
var ShellMindOrchestrator = class {
  events;
  configManager;
  securityEngine;
  aiGenerator;
  executionEngine;
  constructor(configManager, services) {
    this.events = new EventEmitter();
    this.configManager = configManager || new ConfigManager();
    if (services) {
      this.securityEngine = services.securityEngine;
      this.aiGenerator = services.aiGenerator;
      this.executionEngine = services.executionEngine;
    }
  }
  setSecurityEngine(engine) {
    this.securityEngine = engine;
  }
  setAIGenerator(generator) {
    this.aiGenerator = generator;
  }
  setExecutionEngine(engine) {
    this.executionEngine = engine;
  }
  getConfig() {
    return this.configManager.getConfig();
  }
  /**
   * Plans a natural language command into a shell command with security validation
   */
  async plan(request) {
    await this.events.emit("beforeGenerate", { request });
    if (!this.aiGenerator) {
      throw new Error("AI Generator service not configured on ShellMind Orchestrator");
    }
    const rawPlan = await this.aiGenerator.generate(request);
    let finalRisk = rawPlan.risk;
    if (this.securityEngine) {
      const independentRisk = this.securityEngine.analyze(rawPlan.command);
      finalRisk = this.pickHighestRisk(rawPlan.risk, independentRisk);
    }
    const validatedPlan = {
      ...rawPlan,
      risk: finalRisk
    };
    await this.events.emit("afterGenerate", { plan: validatedPlan });
    await this.events.emit("securityCheck", {
      command: validatedPlan.command,
      risk: validatedPlan.risk
    });
    return validatedPlan;
  }
  /**
   * Safe execution entry point - verifies execution confirmation policy
   */
  async executeWithGuardrails(command, confirmed, typedConfirmationToken) {
    const config = this.getConfig();
    if (config.security.enforceZeroAutoExecution && !confirmed) {
      throw new Error("Execution halted: ShellMind zero auto-execution policy requires user confirmation.");
    }
    if (this.securityEngine) {
      const risk = this.securityEngine.analyze(command);
      if (risk.level === "CRITICAL" && config.security.requireTypedConfirmationForCritical && typedConfirmationToken !== "CONFIRM") {
        throw new Error(
          'CRITICAL risk command requires typed confirmation: please type "CONFIRM" to proceed.'
        );
      }
    }
    if (!this.executionEngine) {
      throw new Error("Execution Engine service not configured on ShellMind Orchestrator");
    }
    await this.events.emit("beforeExecute", { command });
    const result = await this.executionEngine.execute(command);
    await this.events.emit("afterExecute", { result });
    return result;
  }
  pickHighestRisk(a, b) {
    const severityMap = {
      SAFE: 0,
      MEDIUM: 1,
      HIGH: 2,
      CRITICAL: 3
    };
    const severityA = severityMap[a.level] ?? 0;
    const severityB = severityMap[b.level] ?? 0;
    if (severityB > severityA) {
      return {
        ...b,
        reasons: Array.from(/* @__PURE__ */ new Set([...a.reasons || [], ...b.reasons || []]))
      };
    }
    return {
      ...a,
      reasons: Array.from(/* @__PURE__ */ new Set([...a.reasons || [], ...b.reasons || []]))
    };
  }
};

// packages/security/src/rules.ts
var BUILTIN_SECURITY_RULES = [
  // --- CRITICAL RULES (Mandatory typed confirmation) ---
  {
    id: "SEC-CRIT-ROOT-RM",
    name: "Root/System Directory Recursive Deletion",
    pattern: /\b(sudo\s+)?rm\s+.*(-[a-zA-Z]*r[a-zA-Z]*f?|-[a-zA-Z]*f[a-zA-Z]*r?|--recursive)\s+(\/|\/\*|~|\$HOME|\/etc|\/boot|\/var|\/usr|\/bin)(\s|$)/i,
    level: "CRITICAL",
    reason: "Attempts recursive deletion of root or vital operating system directories.",
    requiresTypedConfirmation: true
  },
  {
    id: "SEC-CRIT-MKFS",
    name: "Filesystem Format (mkfs)",
    pattern: /\b(mkfs(\.[a-z0-9]+)?|format\s+[a-z]:)\b/i,
    level: "CRITICAL",
    reason: "Formats a storage device or filesystem, completely wiping existing partitions.",
    requiresTypedConfirmation: true
  },
  {
    id: "SEC-CRIT-DD-RAW",
    name: "Raw Disk Write (dd of=/dev)",
    pattern: /\bdd\s+.*of=\/dev\/(sd[a-z]|nvme[0-9]n[0-9]|hd[a-z]|disk[0-9])/i,
    level: "CRITICAL",
    reason: "Direct low-level block write directly to physical disk device.",
    requiresTypedConfirmation: true
  },
  {
    id: "SEC-CRIT-FORKBOMB",
    name: "Shell Fork Bomb",
    pattern: /:\(\)\s*\{\s*:\|:&\s*\}\s*;\s*:/,
    level: "CRITICAL",
    reason: "Classic recursive fork bomb causing kernel starvation and system freeze.",
    requiresTypedConfirmation: true
  },
  {
    id: "SEC-CRIT-REMOTE-PIPE-EXEC",
    name: "Remote Code Pipeline Ingestion (curl | sh)",
    pattern: /\b(curl|wget)\b.*\|\s*(sudo\s+)?(ba|z|fi)?sh\b/i,
    level: "CRITICAL",
    reason: "Directly executes unverified remote script directly into root or user shell.",
    requiresTypedConfirmation: true
  },
  {
    id: "SEC-CRIT-RAW-DEV-REDIRECT",
    name: "Redirection to Raw Device",
    pattern: />\s*\/dev\/(sda|sdb|nvme|kmem|mem|port)/i,
    level: "CRITICAL",
    reason: "Overwrites raw hardware memory or storage block devices.",
    requiresTypedConfirmation: true
  },
  // --- HIGH RULES (Explicit prompt & caution) ---
  {
    id: "SEC-HIGH-CHMOD-777",
    name: "Insecure Permissive Permissions (chmod 777)",
    pattern: /\bchmod\s+(-[a-zA-Z]*R[a-zA-Z]*\s+)?(777|a\+[rwx]{3})\b/i,
    level: "HIGH",
    reason: "Grants universal read, write, and execute permissions to all users on the host."
  },
  {
    id: "SEC-HIGH-GIT-RESET-HARD",
    name: "Destructive Git Hard Reset",
    pattern: /\bgit\s+reset\s+--hard\b/i,
    level: "HIGH",
    reason: "Discards uncommitted working tree and staging area changes permanently."
  },
  {
    id: "SEC-HIGH-GIT-PUSH-FORCE",
    name: "Force Git Push",
    pattern: /\bgit\s+push\s+.*(--force|-f)\b/i,
    level: "HIGH",
    reason: "Overwrites remote Git history, potentially erasing teammates commits."
  },
  {
    id: "SEC-HIGH-RM-RECURSIVE",
    name: "Recursive File Removal",
    pattern: /\brm\s+-[a-zA-Z]*r/i,
    level: "HIGH",
    reason: "Recursively deletes directory contents from the filesystem."
  },
  {
    id: "SEC-HIGH-DOCKER-PRUNE-ALL",
    name: "Docker System Prune Volumes",
    pattern: /\bdocker\s+system\s+prune\s+.*--volumes/i,
    level: "HIGH",
    reason: "Removes all unused Docker containers, networks, images, and data volumes."
  },
  {
    id: "SEC-HIGH-KILL-ALL",
    name: "Mass Process Termination",
    pattern: /\b(killall|pkill)\s+(-9\s+)?/i,
    level: "HIGH",
    reason: "Terminates active running system processes matching target pattern."
  },
  // --- MEDIUM RULES (Modification of state) ---
  {
    id: "SEC-MED-DOCKER-DOWN",
    name: "Docker Compose Down",
    pattern: /\bdocker\s+compose\s+down\b/i,
    level: "MEDIUM",
    reason: "Stops and removes running containers, networks, and configured services."
  },
  {
    id: "SEC-MED-PKG-GLOBAL-INSTALL",
    name: "Global Package Installation",
    pattern: /\b(npm|yarn|pnpm)\s+(install|add|i)\s+(-g|--global)\b/i,
    level: "MEDIUM",
    reason: "Installs global executable packages affecting the global system environment."
  },
  {
    id: "SEC-MED-GIT-CHECKOUT-DISCARD",
    name: "Git Checkout File Discard",
    pattern: /\bgit\s+checkout\s+--\s+/i,
    level: "MEDIUM",
    reason: "Discards uncommitted modifications to selected local working files."
  },
  {
    id: "SEC-MED-FILE-OVERWRITE",
    name: "Output File Overwrite Redirection",
    pattern: /(?<!>|&)>\s*[^\s&|]+/i,
    level: "MEDIUM",
    reason: "Overwrites target destination file contents."
  },
  // --- SAFE RULES (Read-only / inspection) ---
  {
    id: "SEC-SAFE-QUERY",
    name: "Read-only System Inspection",
    pattern: /^\s*(ls|pwd|cat|head|tail|find|grep|stat|which|whoami|date|df|du|uname|git\s+(status|diff|log|branch|show)|docker\s+ps)\b/i,
    level: "SAFE",
    reason: "Read-only query that inspects files or system status without modifying state."
  }
];

// packages/security/src/analyzer.ts
var SecurityAnalyzer = class {
  rules;
  constructor(customRules = []) {
    this.rules = [...BUILTIN_SECURITY_RULES, ...customRules];
  }
  analyze(command) {
    const trimmed = (command || "").trim();
    if (!trimmed) {
      return {
        level: "SAFE",
        reasons: ["Empty command string"],
        requiresTypedConfirmation: false,
        matchedRuleIds: []
      };
    }
    const matchedRules = [];
    const reasons = [];
    let highestLevel = "SAFE";
    let requiresTypedConfirmation = false;
    for (const rule of this.rules) {
      let isMatch = false;
      if (typeof rule.pattern === "function") {
        isMatch = rule.pattern(trimmed);
      } else {
        isMatch = rule.pattern.test(trimmed);
      }
      if (isMatch) {
        matchedRules.push(rule);
        reasons.push(rule.reason);
        if (rule.requiresTypedConfirmation) {
          requiresTypedConfirmation = true;
        }
        if (this.compareRisk(rule.level, highestLevel) > 0) {
          highestLevel = rule.level;
        }
      }
    }
    if (this.hasSudoEscalation(trimmed)) {
      reasons.push("Elevated privileges: command invokes sudo / superuser rights.");
      if (highestLevel === "SAFE") {
        highestLevel = "MEDIUM";
      } else if (highestLevel === "MEDIUM") {
        highestLevel = "HIGH";
      }
    }
    if (matchedRules.length === 0) {
      if (/(\binstall\b|\bmkdir\b|\btouch\b|\bcp\b|\bmv\b|\bset\b|\bexport\b)/i.test(trimmed)) {
        highestLevel = "MEDIUM";
        reasons.push("Modifies local files or environment variables.");
      } else {
        highestLevel = "SAFE";
        reasons.push("Standard shell execution with no high-risk markers detected.");
      }
    }
    if (highestLevel === "CRITICAL") {
      requiresTypedConfirmation = true;
    }
    return {
      level: highestLevel,
      reasons: Array.from(new Set(reasons)),
      requiresTypedConfirmation,
      matchedRuleIds: matchedRules.map((r) => r.id),
      destructiveFlags: this.extractDestructiveFlags(trimmed)
    };
  }
  hasSudoEscalation(command) {
    return /\b(sudo|doas|runas)\b/i.test(command);
  }
  extractDestructiveFlags(command) {
    const flags = [];
    const matches = command.match(/--[a-z0-9-]+|-[a-zA-Z]+/g);
    if (matches) {
      for (const m of matches) {
        if (/(-f|--force|-r|-R|--all|--prune|--hard)/i.test(m)) {
          flags.push(m);
        }
      }
    }
    return flags;
  }
  compareRisk(a, b) {
    const weights = {
      SAFE: 0,
      MEDIUM: 1,
      HIGH: 2,
      CRITICAL: 3
    };
    return (weights[a] ?? 0) - (weights[b] ?? 0);
  }
};

// packages/context/src/collector.ts
var ContextCollector = class _ContextCollector {
  options;
  static cachedContext = null;
  static lastCollectTime = 0;
  constructor(options = {}) {
    this.options = {
      cwd: options.cwd || (typeof process !== "undefined" ? process.cwd() : "/workspace"),
      maxFilesScanned: options.maxFilesScanned || 50,
      skipGit: options.skipGit || false
    };
  }
  async collect() {
    const now = Date.now();
    if (_ContextCollector.cachedContext && now - _ContextCollector.lastCollectTime < 1e4) {
      return _ContextCollector.cachedContext;
    }
    const isNode = typeof process !== "undefined" && process.versions != null && process.versions.node != null;
    if (!isNode) {
      return this.collectBrowserFallback();
    }
    try {
      const os = await import("node:os");
      const fs = await import("node:fs");
      const path2 = await import("node:path");
      const cp = await import("node:child_process");
      const cwd = this.options.cwd || process.cwd();
      const shell = this.detectActiveShell();
      const candidateFiles = [
        "package.json",
        "Dockerfile",
        "docker-compose.yml",
        "docker-compose.yaml",
        "requirements.txt",
        "Cargo.toml",
        "go.mod",
        "pom.xml",
        "Makefile",
        ".gitignore"
      ];
      const foundManifests = [];
      let packageJsonContent = void 0;
      for (const file of candidateFiles) {
        try {
          const filePath = path2.join(cwd, file);
          if (fs.existsSync(filePath)) {
            foundManifests.push(file);
            if (file === "package.json") {
              try {
                packageJsonContent = JSON.parse(fs.readFileSync(filePath, "utf-8"));
              } catch {
              }
            }
          }
        } catch {
        }
      }
      let gitInfo = { isRepo: false };
      if (!this.options.skipGit) {
        try {
          const gitDir = path2.join(cwd, ".git");
          if (fs.existsSync(gitDir)) {
            const branch = cp.execSync("git rev-parse --abbrev-ref HEAD 2>/dev/null", {
              cwd,
              encoding: "utf-8",
              timeout: 1e3
            }).trim();
            const status = cp.execSync("git status --porcelain 2>/dev/null", {
              cwd,
              encoding: "utf-8",
              timeout: 1e3
            }).trim();
            gitInfo = {
              isRepo: true,
              branch: branch || "main",
              statusSummary: status ? `${status.split("\n").length} modified files` : "clean"
            };
          }
        } catch {
        }
      }
      const tools = {
        node: process.version
      };
      const toolBinaries = ["git", "docker", "python3", "pnpm", "aws", "kubectl", "terraform"];
      for (const tool of toolBinaries) {
        try {
          const out = cp.execSync(`${tool} --version 2>/dev/null`, {
            encoding: "utf-8",
            timeout: 500
          }).trim();
          if (out) {
            tools[tool] = out.split("\n")[0]?.substring(0, 40);
          }
        } catch {
        }
      }
      const collected = {
        os: {
          platform: os.platform(),
          release: os.release(),
          arch: os.arch(),
          type: os.type()
        },
        shell,
        currentDirectory: cwd,
        user: os.userInfo?.()?.username || process.env.USER || "developer",
        git: gitInfo,
        project: {
          type: foundManifests.length > 0 ? foundManifests[0].split(".")[0] : "general",
          manifestFiles: foundManifests,
          hasDockerfile: foundManifests.includes("Dockerfile"),
          hasDockerCompose: foundManifests.some((f) => f.startsWith("docker-compose")),
          packageJson: packageJsonContent ? {
            name: packageJsonContent.name,
            scripts: packageJsonContent.scripts,
            dependencies: packageJsonContent.dependencies
          } : void 0
        },
        tools
      };
      _ContextCollector.cachedContext = collected;
      _ContextCollector.lastCollectTime = Date.now();
      return collected;
    } catch (err) {
      console.warn("[ShellMind ContextCollector error, falling back]:", err);
      return this.collectBrowserFallback();
    }
  }
  detectActiveShell() {
    if (typeof process === "undefined") return "unknown";
    if (process.platform === "win32") {
      if (process.env.PSModulePath) return "powershell";
      return "cmd";
    }
    const shellEnv = process.env.SHELL || "";
    if (shellEnv.includes("zsh")) return "zsh";
    if (shellEnv.includes("fish")) return "fish";
    if (shellEnv.includes("bash")) return "bash";
    return "bash";
  }
  collectBrowserFallback() {
    return {
      os: {
        platform: "linux",
        release: "6.6.0-x86_64",
        arch: "x64",
        type: "Linux"
      },
      shell: "zsh",
      currentDirectory: "/workspace/shellmind",
      user: "developer",
      git: {
        isRepo: true,
        branch: "main",
        statusSummary: "clean",
        remoteOrigin: "github.com/shellmind/shellmind"
      },
      project: {
        type: "node",
        manifestFiles: ["package.json", "Dockerfile", "docker-compose.yml"],
        hasDockerfile: true,
        hasDockerCompose: true,
        packageJson: {
          name: "shellmind",
          scripts: {
            build: "turbo run build",
            test: "turbo run test"
          }
        }
      },
      tools: {
        node: "v22.14.0",
        git: "git version 2.44.0",
        docker: "Docker version 26.1.1",
        pnpm: "9.1.0",
        python: "Python 3.12.3",
        kubectl: "v1.30.0",
        aws: "aws-cli/2.15.30",
        terraform: "Terraform v1.8.2"
      }
    };
  }
};

// packages/ai/src/providers/gemini.ts
import { GoogleGenAI } from "@google/genai";

// packages/ai/src/prompts.ts
var SHELLMIND_SYSTEM_INSTRUCTION = `
You are ShellMind, an expert AI Terminal Copilot.
Your job is to translate natural language user intent into precise, production-ready, safe shell commands.

GUIDELINES:
1. Always generate commands tailored to the user's specific operating system and shell environment.
2. Favor modern, standard POSIX or platform-standard utilities (e.g. rg, find, awk, curl).
3. Do not assume destructive behavior unless explicitly requested by the user.
4. Output MUST be valid JSON adhering strictly to the required schema.
5. Provide a clear, concise 1-sentence explanation of what the command does.
6. Provide accurate risk evaluation (SAFE, MEDIUM, HIGH, CRITICAL).
7. If the request requires multiple steps, provide a multiStepPlan array.
`;
function formatContextSummary(ctx) {
  const parts = [
    `OS: ${ctx.os.platform} (${ctx.os.type} ${ctx.os.release}, ${ctx.os.arch})`,
    `Shell: ${ctx.shell}`,
    `CWD: ${ctx.currentDirectory}`,
    `User: ${ctx.user}`
  ];
  if (ctx.git?.isRepo) {
    parts.push(`Git: branch=${ctx.git.branch || "main"}, dirty=${ctx.git.statusSummary ? "yes" : "no"}`);
  }
  if (ctx.project?.manifestFiles?.length) {
    parts.push(`Project Files: ${ctx.project.manifestFiles.join(", ")}`);
  }
  if (ctx.tools) {
    const installed = Object.entries(ctx.tools).filter(([_, v]) => Boolean(v)).map(([k, v]) => `${k}:${v}`).join(", ");
    if (installed) {
      parts.push(`Installed Tools: ${installed}`);
    }
  }
  return parts.join("\n");
}
function buildGenerationPrompt(request) {
  return `
User Request: "${request.naturalLanguagePrompt}"

System Context:
${formatContextSummary(request.context)}

Generate a JSON object with:
{
  "command": "the exact shell command to execute",
  "explanation": "clear explanation of what it does",
  "risk": {
    "level": "SAFE" | "MEDIUM" | "HIGH" | "CRITICAL",
    "reasons": ["reason 1"],
    "requiresTypedConfirmation": boolean
  },
  "alternatives": [
    { "command": "alternative command", "description": "why use this" }
  ],
  "multiStepPlan": ["step 1", "step 2"] (optional),
  "safetyNotes": ["note 1"] (optional)
}
`;
}
function buildExplanationPrompt(command, context) {
  return `
Command to Explain: "${command}"

${context ? `Context:
${formatContextSummary(context)}` : ""}

Generate a JSON object with:
{
  "command": "${command}",
  "summary": "1-2 sentence high-level summary",
  "syntaxBreakdown": [
    { "token": "flag or argument", "description": "what this token specifies" }
  ],
  "risk": {
    "level": "SAFE" | "MEDIUM" | "HIGH" | "CRITICAL",
    "reasons": ["reason 1"],
    "requiresTypedConfirmation": boolean
  },
  "caveats": ["caveat or edge case"]
}
`;
}
function buildDiagnosisPrompt(failedCommand, stderr, context) {
  return `
Failed Command: "${failedCommand}"
Captured Stderr:
${stderr}

${context ? `Context:
${formatContextSummary(context)}` : ""}

Diagnose why this command failed and propose fixes.
Generate a JSON object with:
{
  "failedCommand": "${failedCommand}",
  "stderr": "${stderr.replace(/"/g, '\\"')}",
  "rootCause": "precise root cause explanation",
  "category": "permission" | "missing_dependency" | "syntax_error" | "network" | "resource_limit" | "other",
  "suggestedFixes": ["step 1 to fix", "step 2 to fix"],
  "repairedCommand": "the corrected command that will succeed"
}
`;
}

// packages/ai/src/providers/gemini.ts
var GeminiProvider = class {
  id = "gemini";
  name = "Google Gemini (gemini-3.1-flash-lite)";
  ai;
  modelName;
  constructor(options) {
    this.modelName = options?.model || "gemini-3.1-flash-lite";
    const apiKey = options?.apiKey || process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== "MY_GEMINI_API_KEY" && !apiKey.startsWith("MY_") && apiKey.length > 15) {
      this.ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });
    }
  }
  async generateCommand(request) {
    if (!this.ai) {
      return this.fallbackGenerate(request);
    }
    try {
      const prompt = buildGenerationPrompt(request);
      const executeCall = async (model) => {
        return this.ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction: SHELLMIND_SYSTEM_INSTRUCTION,
            responseMimeType: "application/json",
            temperature: 0.2
          }
        });
      };
      const timeoutPromise = new Promise(
        (_, reject) => setTimeout(() => reject(new Error("Gemini API call timed out after 5s")), 5e3)
      );
      let response;
      try {
        response = await Promise.race([executeCall(this.modelName), timeoutPromise]);
      } catch (err) {
        if (err?.message?.includes("503") || err?.status === 503) {
          console.warn("[Gemini 503 spike, falling back to gemini-3.1-flash-lite]");
          response = await Promise.race([executeCall("gemini-3.1-flash-lite"), timeoutPromise]);
        } else {
          throw err;
        }
      }
      const text = response.text?.trim() || "{}";
      const parsed = JSON.parse(text);
      return {
        command: parsed.command || this.fallbackGenerate(request).command,
        explanation: parsed.explanation || "Generated shell command",
        risk: {
          level: parsed.risk?.level || "SAFE",
          reasons: parsed.risk?.reasons || ["Evaluated by Gemini"],
          requiresTypedConfirmation: parsed.risk?.requiresTypedConfirmation || false
        },
        alternatives: parsed.alternatives || [],
        multiStepPlan: parsed.multiStepPlan,
        safetyNotes: parsed.safetyNotes
      };
    } catch (err) {
      console.warn("[ShellMind GeminiProvider Error, using heuristic fallback]:", err);
      return this.fallbackGenerate(request);
    }
  }
  async explainCommand(command, context) {
    if (!this.ai) {
      return this.fallbackExplain(command);
    }
    try {
      const prompt = buildExplanationPrompt(command, context);
      const apiCall = this.ai.models.generateContent({
        model: this.modelName,
        contents: prompt,
        config: {
          systemInstruction: SHELLMIND_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          temperature: 0.2
        }
      });
      const timeoutPromise = new Promise(
        (_, reject) => setTimeout(() => reject(new Error("Gemini API explain timed out after 3.5s")), 3500)
      );
      const response = await Promise.race([apiCall, timeoutPromise]);
      const text = response.text?.trim() || "{}";
      const parsed = JSON.parse(text);
      return {
        command,
        summary: parsed.summary || `Explains: ${command}`,
        syntaxBreakdown: parsed.syntaxBreakdown || [],
        risk: parsed.risk || {
          level: "SAFE",
          reasons: ["Command inspection"],
          requiresTypedConfirmation: false
        },
        caveats: parsed.caveats
      };
    } catch (err) {
      console.warn("[ShellMind GeminiProvider Explain Error]:", err);
      return this.fallbackExplain(command);
    }
  }
  async diagnoseError(failedCommand, stderr, context) {
    if (!this.ai) {
      return this.fallbackDiagnose(failedCommand, stderr);
    }
    try {
      const prompt = buildDiagnosisPrompt(failedCommand, stderr, context);
      const apiCall = this.ai.models.generateContent({
        model: this.modelName,
        contents: prompt,
        config: {
          systemInstruction: SHELLMIND_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          temperature: 0.2
        }
      });
      const timeoutPromise = new Promise(
        (_, reject) => setTimeout(() => reject(new Error("Gemini API diagnose timed out after 3.5s")), 3500)
      );
      const response = await Promise.race([apiCall, timeoutPromise]);
      const text = response.text?.trim() || "{}";
      return JSON.parse(text);
    } catch (err) {
      console.warn("[ShellMind GeminiProvider Diagnosis Error]:", err);
      return this.fallbackDiagnose(failedCommand, stderr);
    }
  }
  // Robust heuristic fallback when offline or when no API key is provided
  fallbackGenerate(request) {
    const prompt = request.naturalLanguagePrompt.toLowerCase();
    if (prompt.includes("pdf") && prompt.includes("20mb")) {
      return {
        command: 'find . -type f -name "*.pdf" -size +20M',
        explanation: "Finds all PDF files in the current directory and subdirectories larger than 20 megabytes.",
        risk: {
          level: "SAFE",
          reasons: ["Read-only search operation that does not alter disk state."],
          requiresTypedConfirmation: false
        },
        alternatives: [
          {
            command: "fd -e pdf --size +20m",
            description: "Faster alternative using modern fd-find utility."
          }
        ]
      };
    }
    if (prompt.includes("delete node_modules") || prompt.includes("remove node_modules")) {
      return {
        command: 'find . -name "node_modules" -type d -prune -exec rm -rf {} +',
        explanation: "Recursively finds and deletes all node_modules dependency directories.",
        risk: {
          level: "MEDIUM",
          reasons: ["Deletes directory trees and cache artifacts."],
          requiresTypedConfirmation: false
        },
        alternatives: [
          {
            command: "rm -rf node_modules",
            description: "Deletes only top-level node_modules."
          }
        ]
      };
    }
    if (prompt.includes("compress") && prompt.includes("png")) {
      return {
        command: 'find . -name "*.png" -exec pngquant --ext .png --force 256 {} \\;',
        explanation: "Finds and losslessly compresses every PNG file in place using pngquant.",
        risk: {
          level: "MEDIUM",
          reasons: ["Overwrites existing image files with compressed versions."],
          requiresTypedConfirmation: false
        },
        alternatives: [
          {
            command: "oxipng -o 4 --strip all **/*.png",
            description: "Uses multithreaded oxipng optimizer."
          }
        ]
      };
    }
    const folderAndFileMatch = request.naturalLanguagePrompt.match(
      /(?:create|make)\s+(?:a\s+)?(?:folder|dir|directory)\s+([a-zA-Z0-9_.-]+)\s+(?:and\s+)?(?:inside\s+(?:it\s+)?)?(?:create|make|touch|add)\s+(?:a\s+)?(?:file\s+)?([a-zA-Z0-9_.-]+)/i
    );
    if (folderAndFileMatch) {
      const folder = folderAndFileMatch[1];
      const file = folderAndFileMatch[2];
      return {
        command: `mkdir -p ${folder} && touch ${folder}/${file}`,
        explanation: `Creates folder '${folder}' and creates file '${file}' inside it.`,
        risk: {
          level: "SAFE",
          reasons: ["Creates local directory and empty file."],
          requiresTypedConfirmation: false
        },
        alternatives: [
          {
            command: `mkdir -p ${folder}/${file}`,
            description: "Direct path creation (if supported)"
          }
        ]
      };
    }
    const folderMatch = request.naturalLanguagePrompt.match(
      /(?:create|make)\s+(?:a\s+)?(?:folder|dir|directory)\s+([a-zA-Z0-9_.-]+)/i
    );
    if (folderMatch) {
      const folder = folderMatch[1];
      return {
        command: `mkdir -p ${folder}`,
        explanation: `Creates directory '${folder}' (including parent directories if missing).`,
        risk: {
          level: "SAFE",
          reasons: ["Creates directory."],
          requiresTypedConfirmation: false
        }
      };
    }
    const fileMatch = request.naturalLanguagePrompt.match(
      /(?:create|touch|make)\s+(?:a\s+)?(?:file\s+)?([a-zA-Z0-9_.-]+\.[a-zA-Z0-9]+)/i
    );
    if (fileMatch) {
      const file = fileMatch[1];
      return {
        command: `touch ${file}`,
        explanation: `Creates new empty file '${file}'.`,
        risk: {
          level: "SAFE",
          reasons: ["Creates empty file in working directory."],
          requiresTypedConfirmation: false
        }
      };
    }
    const portMatch = request.naturalLanguagePrompt.match(/kill\s+(?:process\s+on\s+)?(?:port\s+)?(\d{2,5})/i);
    if (portMatch) {
      const port = portMatch[1];
      return {
        command: `lsof -ti:${port} | xargs kill -9`,
        explanation: `Finds the process PID bound to TCP port ${port} and terminates it.`,
        risk: {
          level: "HIGH",
          reasons: ["Terminates active process running on target port."],
          requiresTypedConfirmation: false
        }
      };
    }
    if (/list\s+(all\s+)?files|show\s+files/i.test(prompt)) {
      return {
        command: "ls -la",
        explanation: "Lists all files including hidden dotfiles with size and permission details.",
        risk: { level: "SAFE", reasons: ["Read-only file listing."], requiresTypedConfirmation: false }
      };
    }
    if (/git\s+status|check\s+git/i.test(prompt)) {
      return {
        command: "git status",
        explanation: "Inspects active branch and uncommitted modifications in repository.",
        risk: { level: "SAFE", reasons: ["Read-only git status check."], requiresTypedConfirmation: false }
      };
    }
    if (/docker\s+ps|running\s+containers/i.test(prompt)) {
      return {
        command: "docker ps",
        explanation: "Lists all active running Docker containers.",
        risk: { level: "SAFE", reasons: ["Read-only container inspection."], requiresTypedConfirmation: false }
      };
    }
    if (/disk\s+space|check\s+disk/i.test(prompt)) {
      return {
        command: "df -h",
        explanation: "Displays disk usage and available space in human-readable format.",
        risk: { level: "SAFE", reasons: ["Read-only filesystem report."], requiresTypedConfirmation: false }
      };
    }
    const words = request.naturalLanguagePrompt.split(/\s+/).filter((w) => !/^(please|can|you|how|to|the|a|an|for|in|on|at|of)$/i.test(w));
    const commandCandidate = words.join(" ");
    return {
      command: commandCandidate,
      explanation: `Proposed shell command for: "${request.naturalLanguagePrompt}"`,
      risk: {
        level: "SAFE",
        reasons: ["Parsed from intent tokens."],
        requiresTypedConfirmation: false
      }
    };
  }
  fallbackExplain(command) {
    return {
      command,
      summary: `Executes shell command '${command}'`,
      syntaxBreakdown: command.split(" ").map((tok, idx) => ({
        token: tok,
        description: idx === 0 ? "Primary command binary" : "Option or parameter argument"
      })),
      risk: {
        level: command.includes("rm") ? "HIGH" : "SAFE",
        reasons: ["Heuristic explanation breakdown"],
        requiresTypedConfirmation: false
      }
    };
  }
  fallbackDiagnose(failedCommand, stderr) {
    const isEacces = /EACCES|permission denied/i.test(stderr);
    const isNotFound = /not found|command not found|ENOENT/i.test(stderr);
    if (isEacces) {
      return {
        failedCommand,
        stderr,
        category: "permission",
        rootCause: "Insufficient user permissions to write to target path or port.",
        suggestedFixes: [
          "Verify file permissions or ownership using ls -la",
          "Use sudo if administrative privileges are required",
          "Fix directory ownership with: sudo chown -R $USER <path>"
        ],
        repairedCommand: `sudo ${failedCommand}`
      };
    }
    if (isNotFound) {
      return {
        failedCommand,
        stderr,
        category: "missing_dependency",
        rootCause: "Command or referenced executable is not in current $PATH.",
        suggestedFixes: [
          "Verify the executable is installed",
          "Check system package manager (e.g. brew, apt, npm -g)",
          "Ensure target directory is included in $PATH"
        ]
      };
    }
    return {
      failedCommand,
      stderr,
      category: "other",
      rootCause: "Non-zero exit code encountered during subprocess execution.",
      suggestedFixes: ["Inspect stderr log above for details", "Run with verbose/debug flags enabled"]
    };
  }
};

// packages/ai/src/providers/openai.ts
var OpenAIProvider = class {
  id = "openai";
  name = "OpenAI Compatible (gpt-4o)";
  apiKey;
  model;
  baseUrl;
  constructor(options) {
    this.apiKey = options?.apiKey || process.env.OPENAI_API_KEY;
    this.model = options?.model || "gpt-4o";
    this.baseUrl = options?.baseUrl || "https://api.openai.com/v1";
  }
  async generateCommand(request) {
    if (!this.apiKey) {
      return {
        command: `echo "OpenAI provider requires an API key. Run: ai config set provider.openai.apiKey <key>"`,
        explanation: "Missing OpenAI API Key in configuration",
        risk: {
          level: "SAFE",
          reasons: ["Configuration prompt"],
          requiresTypedConfirmation: false
        }
      };
    }
    try {
      const prompt = buildGenerationPrompt(request);
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: SHELLMIND_SYSTEM_INSTRUCTION },
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" }
        })
      });
      if (!res.ok) {
        throw new Error(`OpenAI HTTP ${res.status}: ${await res.text()}`);
      }
      const json = await res.json();
      const content = json.choices?.[0]?.message?.content || "{}";
      const parsed = JSON.parse(content);
      return {
        command: parsed.command || 'echo "Command generation error"',
        explanation: parsed.explanation || "Generated command",
        risk: parsed.risk || {
          level: "SAFE",
          reasons: ["Evaluated by OpenAI"],
          requiresTypedConfirmation: false
        },
        alternatives: parsed.alternatives || [],
        multiStepPlan: parsed.multiStepPlan
      };
    } catch (err) {
      console.error("[ShellMind OpenAIProvider Error]:", err);
      throw err;
    }
  }
  async explainCommand(command, context) {
    const prompt = buildExplanationPrompt(command, context);
    if (!this.apiKey) {
      return {
        command,
        summary: `Shell command: ${command}`,
        syntaxBreakdown: [],
        risk: { level: "SAFE", reasons: [], requiresTypedConfirmation: false }
      };
    }
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: SHELLMIND_SYSTEM_INSTRUCTION },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      })
    });
    const json = await res.json();
    return JSON.parse(json.choices?.[0]?.message?.content || "{}");
  }
  async diagnoseError(failedCommand, stderr, context) {
    const prompt = buildDiagnosisPrompt(failedCommand, stderr, context);
    if (!this.apiKey) {
      return {
        failedCommand,
        stderr,
        category: "other",
        rootCause: "Command execution returned non-zero code.",
        suggestedFixes: ["Inspect stderr output"]
      };
    }
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: SHELLMIND_SYSTEM_INSTRUCTION },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      })
    });
    const json = await res.json();
    return JSON.parse(json.choices?.[0]?.message?.content || "{}");
  }
};

// packages/ai/src/providers/ollama.ts
var OllamaProvider = class {
  id = "ollama";
  name = "Ollama Local (Offline/Private)";
  endpoint;
  model;
  constructor(options) {
    this.endpoint = options?.endpoint || "http://localhost:11434";
    this.model = options?.model || "llama3:latest";
  }
  async generateCommand(request) {
    try {
      const prompt = buildGenerationPrompt(request);
      const res = await fetch(`${this.endpoint}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          system: SHELLMIND_SYSTEM_INSTRUCTION,
          prompt,
          format: "json",
          stream: false
        })
      });
      if (!res.ok) {
        throw new Error(`Ollama offline or model not found at ${this.endpoint}`);
      }
      const json = await res.json();
      const parsed = JSON.parse(json.response || "{}");
      return {
        command: parsed.command || 'echo "Local model produced no command"',
        explanation: parsed.explanation || "Generated by local Ollama model",
        risk: parsed.risk || {
          level: "SAFE",
          reasons: ["Local offline model inference"],
          requiresTypedConfirmation: false
        },
        alternatives: parsed.alternatives || []
      };
    } catch (err) {
      console.warn("[ShellMind Ollama Error - check if `ollama serve` is running]:", err);
      return {
        command: `echo "Ollama is not reachable at ${this.endpoint}. Start Ollama or run 'ai provider set gemini'"`,
        explanation: "Local Ollama daemon unreachable",
        risk: {
          level: "SAFE",
          reasons: ["Daemon health check notice"],
          requiresTypedConfirmation: false
        }
      };
    }
  }
  async explainCommand(command, context) {
    const prompt = buildExplanationPrompt(command, context);
    try {
      const res = await fetch(`${this.endpoint}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          system: SHELLMIND_SYSTEM_INSTRUCTION,
          prompt,
          format: "json",
          stream: false
        })
      });
      const json = await res.json();
      return JSON.parse(json.response || "{}");
    } catch {
      return {
        command,
        summary: `Local offline explanation for: ${command}`,
        syntaxBreakdown: [],
        risk: { level: "SAFE", reasons: [], requiresTypedConfirmation: false }
      };
    }
  }
  async diagnoseError(failedCommand, stderr, context) {
    const prompt = buildDiagnosisPrompt(failedCommand, stderr, context);
    try {
      const res = await fetch(`${this.endpoint}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          system: SHELLMIND_SYSTEM_INSTRUCTION,
          prompt,
          format: "json",
          stream: false
        })
      });
      const json = await res.json();
      return JSON.parse(json.response || "{}");
    } catch {
      return {
        failedCommand,
        stderr,
        category: "other",
        rootCause: "Failed command in local environment.",
        suggestedFixes: ["Inspect stderr logs above"]
      };
    }
  }
};

// packages/ai/src/factory.ts
var AIProviderFactory = class {
  static create(config) {
    const active = config.provider.active;
    switch (active) {
      case "gemini":
        return new GeminiProvider({
          model: config.provider.gemini?.model
        });
      case "openai":
        return new OpenAIProvider({
          apiKey: config.provider.openai?.apiKey,
          model: config.provider.openai?.model,
          baseUrl: config.provider.openai?.baseUrl
        });
      case "ollama":
        return new OllamaProvider({
          endpoint: config.provider.ollama?.endpoint,
          model: config.provider.ollama?.model
        });
      default:
        console.warn(`Unknown provider '${active}', defaulting to Gemini`);
        return new GeminiProvider();
    }
  }
};

// packages/executor/src/executor.ts
var ProcessExecutor = class {
  async execute(command, options = {}) {
    const startTime = Date.now();
    const timeoutMs = options.timeoutMs || 3e4;
    const isNode = typeof process !== "undefined" && process.versions != null && process.versions.node != null;
    if (!isNode) {
      return this.simulateBrowserExecution(command, startTime);
    }
    try {
      const cp = await import("node:child_process");
      return await new Promise((resolve) => {
        let stdout = "";
        let stderr = "";
        let timer = null;
        let killed = false;
        const child = cp.spawn(command, {
          shell: true,
          cwd: options.cwd || process.cwd(),
          env: { ...process.env, ...options.env || {} }
        });
        if (timeoutMs > 0) {
          timer = setTimeout(() => {
            killed = true;
            child.kill("SIGTERM");
          }, timeoutMs);
        }
        child.stdout?.on("data", (data) => {
          const str = data.toString();
          stdout += str;
          options.onStdoutChunk?.(str);
        });
        child.stderr?.on("data", (data) => {
          const str = data.toString();
          stderr += str;
          options.onStderrChunk?.(str);
        });
        child.on("close", (code) => {
          if (timer) clearTimeout(timer);
          resolve({
            command,
            exitCode: code ?? (killed ? 143 : 1),
            stdout,
            stderr,
            durationMs: Date.now() - startTime,
            cancelled: killed
          });
        });
        child.on("error", (err) => {
          if (timer) clearTimeout(timer);
          resolve({
            command,
            exitCode: 1,
            stdout,
            stderr: `${stderr}
${err.message}`.trim(),
            durationMs: Date.now() - startTime,
            cancelled: false
          });
        });
      });
    } catch (err) {
      return {
        command,
        exitCode: 1,
        stdout: "",
        stderr: err?.message || "Execution failed",
        durationMs: Date.now() - startTime,
        cancelled: false
      };
    }
  }
  simulateBrowserExecution(command, startTime) {
    return {
      command,
      exitCode: 0,
      stdout: `[ShellMind Executed successfully in simulation environment]:
$ ${command}
Done in 42ms.`,
      stderr: "",
      durationMs: Date.now() - startTime,
      cancelled: false
    };
  }
};

// packages/plugins/src/builtin/index.ts
var GitPlugin = {
  id: "git",
  name: "Git Version Control Plugin",
  description: "Enriches branch state, validates against destructive force pushes and hard resets.",
  targetBinary: "git",
  validateCommand(command) {
    const issues = [];
    if (/git\s+push\s+.*(--force|-f)\b/.test(command)) {
      issues.push({
        severity: "warning",
        message: "Force-pushing may overwrite remote history for other contributors.",
        suggestedCorrection: "Use --force-with-lease instead of -f to prevent overwriting unseen remote commits."
      });
    }
    if (/git\s+reset\s+--hard\b/.test(command)) {
      issues.push({
        severity: "warning",
        message: "git reset --hard discards all uncommitted working directory changes permanently.",
        suggestedCorrection: "Consider git stash before resetting."
      });
    }
    return issues;
  },
  promptGuidance() {
    return "For git commands, prefer modern subcommands (switch, restore) over overloaded checkout where appropriate.";
  }
};
var DockerPlugin = {
  id: "docker",
  name: "Docker & Container Plugin",
  description: "Inspects containers, validates volume removals and system prune commands.",
  targetBinary: "docker",
  validateCommand(command) {
    const issues = [];
    if (/docker\s+system\s+prune\s+.*(-a|--all|--volumes)/.test(command)) {
      issues.push({
        severity: "warning",
        message: "Pruning volumes will irreversibly destroy stateful database containers and named volumes."
      });
    }
    return issues;
  },
  promptGuidance() {
    return "For Docker, format port mappings as HOST:CONTAINER and recommend named volumes for persistence.";
  }
};
var NodePlugin = {
  id: "node",
  name: "Node.js & Package Managers Plugin",
  description: "Auto-detects package managers (pnpm, npm, yarn) from lockfiles.",
  targetBinary: "node",
  validateCommand(command, context) {
    const issues = [];
    const hasPnpm = context.project?.manifestFiles?.some((f) => f.includes("pnpm"));
    if (hasPnpm && command.startsWith("npm install")) {
      issues.push({
        severity: "warning",
        message: "Project contains pnpm lockfile. Running npm install will generate conflicting lockfiles.",
        suggestedCorrection: command.replace("npm install", "pnpm install")
      });
    }
    return issues;
  },
  promptGuidance() {
    return "Favor the detected package manager (pnpm > yarn > npm) based on existing lockfiles.";
  }
};
var PythonPlugin = {
  id: "python",
  name: "Python & Virtualenv Plugin",
  description: "Recommends modern uv/poetry/virtualenv commands and prevents polluting global site-packages.",
  targetBinary: "python3",
  validateCommand(command) {
    const issues = [];
    if (/pip\s+install\s+(?!-r|--user|-e)/.test(command) && !process.env.VIRTUAL_ENV) {
      issues.push({
        severity: "warning",
        message: "Running pip install outside a virtual environment may break system-managed packages (PEP 668).",
        suggestedCorrection: "Use python3 -m venv .venv && source .venv/bin/activate before pip install."
      });
    }
    return issues;
  }
};
var AwsPlugin = {
  id: "aws",
  name: "AWS Cloud CLI Plugin",
  description: "Guards against recursive S3 bucket deletions and unauthorized credential disclosure.",
  targetBinary: "aws",
  validateCommand(command) {
    const issues = [];
    if (/aws\s+s3\s+rb\s+.*--force/.test(command)) {
      issues.push({
        severity: "warning",
        message: "aws s3 rb --force deletes an entire S3 bucket and all stored objects permanently."
      });
    }
    return issues;
  }
};
var KubectlPlugin = {
  id: "kubectl",
  name: "Kubernetes Cluster Plugin",
  description: "Prevents accidental deletions against production namespaces.",
  targetBinary: "kubectl",
  validateCommand(command) {
    const issues = [];
    if (/kubectl\s+delete\s+(ns|namespace|all)\b/.test(command)) {
      issues.push({
        severity: "warning",
        message: "Deleting Kubernetes namespaces terminates all pods, ingress, and PV claims within it."
      });
    }
    return issues;
  }
};
var TerraformPlugin = {
  id: "terraform",
  name: "Terraform Infrastructure Plugin",
  description: "Flags terraform destroy and state modification commands.",
  targetBinary: "terraform",
  validateCommand(command) {
    const issues = [];
    if (/terraform\s+destroy\b/.test(command)) {
      issues.push({
        severity: "warning",
        message: "terraform destroy will tear down all provisioned cloud infrastructure.",
        suggestedCorrection: "Use terraform plan -destroy first to preview infrastructure removals."
      });
    }
    return issues;
  }
};
var BUILTIN_PLUGINS = [
  GitPlugin,
  DockerPlugin,
  NodePlugin,
  PythonPlugin,
  AwsPlugin,
  KubectlPlugin,
  TerraformPlugin
];

// packages/plugins/src/registry.ts
var PluginRegistry = class {
  plugins = /* @__PURE__ */ new Map();
  constructor(loadBuiltins = true) {
    if (loadBuiltins) {
      for (const p of BUILTIN_PLUGINS) {
        this.plugins.set(p.id, p);
      }
    }
  }
  register(plugin) {
    this.plugins.set(plugin.id, plugin);
  }
  getPlugin(id) {
    return this.plugins.get(id);
  }
  getAll() {
    return Array.from(this.plugins.values());
  }
  validateCommand(command, context) {
    const issues = [];
    for (const plugin of this.plugins.values()) {
      if (plugin.validateCommand) {
        try {
          const res = plugin.validateCommand(command, context);
          issues.push(...res);
        } catch (err) {
          console.error(`[Plugin ${plugin.id} validation error]:`, err);
        }
      }
    }
    return issues;
  }
};

// packages/memory/src/store.ts
var MemoryStore = class {
  data;
  constructor(initialData) {
    this.data = {
      version: "1.0.0",
      history: initialData?.history || [
        {
          id: "hist-1",
          timestamp: Date.now() - 36e5,
          prompt: "find every pdf larger than 20MB",
          command: 'find . -type f -name "*.pdf" -size +20M',
          directory: "/workspace/docs",
          riskLevel: "SAFE",
          executed: true,
          exitCode: 0
        },
        {
          id: "hist-2",
          timestamp: Date.now() - 18e5,
          prompt: "delete node_modules",
          command: 'find . -name "node_modules" -type d -prune -exec rm -rf {} +',
          directory: "/workspace/applet",
          riskLevel: "MEDIUM",
          executed: true,
          exitCode: 0
        }
      ],
      workflows: initialData?.workflows || [
        {
          phrase: "start backend",
          commands: ["cd backend", "pnpm install", "pnpm dev"],
          usageCount: 14,
          lastUsed: Date.now() - 6e5
        },
        {
          phrase: "ship release",
          commands: ["pnpm lint", "pnpm test", "git push origin main"],
          usageCount: 8,
          lastUsed: Date.now() - 12e5
        }
      ],
      aliases: initialData?.aliases || {
        gco: "git checkout",
        dcu: "docker compose up -d"
      }
    };
  }
  getHistory(limit = 50) {
    return this.data.history.slice(-limit);
  }
  recordCommand(entry) {
    const fullEntry = {
      ...entry,
      id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now()
    };
    this.data.history.push(fullEntry);
    this.detectWorkflowPattern(fullEntry);
    return fullEntry;
  }
  getWorkflows() {
    return [...this.data.workflows];
  }
  findWorkflow(phrase) {
    const norm = phrase.trim().toLowerCase();
    return this.data.workflows.find((w) => w.phrase.toLowerCase() === norm);
  }
  learnWorkflow(phrase, commands) {
    const existing = this.findWorkflow(phrase);
    if (existing) {
      existing.commands = commands;
      existing.usageCount++;
      existing.lastUsed = Date.now();
      return existing;
    }
    const newWf = {
      phrase,
      commands,
      usageCount: 1,
      lastUsed: Date.now()
    };
    this.data.workflows.push(newWf);
    return newWf;
  }
  getAliases() {
    return { ...this.data.aliases };
  }
  setAlias(key, command) {
    this.data.aliases[key] = command;
  }
  detectWorkflowPattern(entry) {
    if (!entry.prompt) return;
    const prompt = entry.prompt.trim().toLowerCase();
    const wf = this.findWorkflow(prompt);
    if (wf) {
      wf.usageCount++;
      wf.lastUsed = Date.now();
    }
  }
};

// packages/shell/src/detector.ts
var ShellDetector = class {
  static detect() {
    if (typeof process === "undefined") return "bash";
    if (process.platform === "win32") {
      if (process.env.PSModulePath) return "powershell";
      return "cmd";
    }
    const envShell = process.env.SHELL || "";
    if (envShell.endsWith("/zsh") || envShell.includes("zsh")) return "zsh";
    if (envShell.endsWith("/fish") || envShell.includes("fish")) return "fish";
    if (envShell.endsWith("/bash") || envShell.includes("bash")) return "bash";
    return "bash";
  }
  static getProfilePath(shell) {
    const isWindows = typeof process !== "undefined" && process.platform === "win32";
    const home = typeof process !== "undefined" ? process.env.HOME || "/root" : "/root";
    switch (shell) {
      case "zsh":
        return `${home}/.zshrc`;
      case "fish":
        return `${home}/.config/fish/config.fish`;
      case "bash":
        return `${home}/.bashrc`;
      case "powershell":
        if (isWindows) {
          const docs = process.env.USERPROFILE || "C:\\";
          return `${docs}\\Documents\\WindowsPowerShell\\Microsoft.PowerShell_profile.ps1`;
        }
        return `${home}/.config/powershell/Microsoft.PowerShell_profile.ps1`;
      case "cmd":
        return `${home}/autorun.cmd`;
      default:
        return `${home}/.bashrc`;
    }
  }
};

// packages/shell/src/completions.ts
var CompletionGenerator = class {
  static generate(shell) {
    switch (shell) {
      case "bash":
        return `
# ShellMind Bash Autocompletion
_shellmind_completions() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  local prev="\${COMP_WORDS[COMP_CWORD-1]}"
  local commands="explain run config provider login history version doctor install update"

  if [ $COMP_CWORD -eq 1 ]; then
    COMPREPLY=( $(compgen -W "\${commands}" -- \${cur}) )
    return 0
  fi
}
complete -F _shellmind_completions ai
complete -F _shellmind_completions shellmind
`;
      case "zsh":
        return `
# ShellMind Zsh Autocompletion
#compdef ai shellmind
_shellmind() {
  local -a commands
  commands=(
    'explain:Explain a command'
    'run:Run shell command with explanation'
    'config:Manage configuration'
    'provider:View or switch LLM provider'
    'login:Authenticate provider credentials'
    'history:View command history'
    'version:Display version information'
    'doctor:Diagnose installation health'
    'install:Integrate alias into shell rc'
    'update:Check and install updates'
  )
  _describe 'command' commands
}
compdef _shellmind ai shellmind
`;
      case "fish":
        return `
# ShellMind Fish Autocompletion
complete -c ai -f -a "explain run config provider login history version doctor install update" -d "ShellMind AI Commands"
complete -c shellmind -f -a "explain run config provider login history version doctor install update" -d "ShellMind AI Commands"
`;
      case "powershell":
        return `
# ShellMind PowerShell Autocompletion
Register-ArgumentCompleter -Native -CommandName ai,shellmind -ScriptBlock {
    param($wordToComplete, $commandAst, $cursorPosition)
    @('explain', 'run', 'config', 'provider', 'login', 'history', 'version', 'doctor', 'install', 'update') |
        Where-Object { $_ -like "$wordToComplete*" } |
        ForEach-Object { [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_) }
}
`;
      default:
        return "";
    }
  }
};

// packages/shell/src/installer.ts
var ShellInstaller = class {
  static getProfileInfo() {
    const shell = ShellDetector.detect();
    const profilePath = ShellDetector.getProfilePath(shell);
    const aliasSnippet = shell === "powershell" ? `Set-Alias -Name ai -Value shellmind` : `alias ai="shellmind"`;
    return {
      shell,
      profilePath,
      isInstalled: false,
      aliasSnippet
    };
  }
  static async install() {
    const info = this.getProfileInfo();
    const isNode = typeof process !== "undefined" && process.versions != null && process.versions.node != null;
    if (!isNode) {
      return {
        shell: info.shell,
        profilePath: info.profilePath,
        success: true,
        message: `Simulation: Added alias ai="shellmind" to ${info.profilePath}`
      };
    }
    try {
      const fs = await import("node:fs");
      const path2 = await import("node:path");
      const dir = path2.dirname(info.profilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const existingContent = fs.existsSync(info.profilePath) ? fs.readFileSync(info.profilePath, "utf-8") : "";
      if (existingContent.includes("alias ai=") || existingContent.includes("Set-Alias -Name ai")) {
        return {
          shell: info.shell,
          profilePath: info.profilePath,
          success: true,
          message: `ShellMind alias is already installed in ${info.profilePath}`
        };
      }
      const completion = CompletionGenerator.generate(info.shell);
      const appendBlock = `
# >>> ShellMind Terminal Copilot >>>
${info.aliasSnippet}
${completion}
# <<< ShellMind Terminal Copilot <<<
`;
      fs.appendFileSync(info.profilePath, appendBlock, "utf-8");
      return {
        shell: info.shell,
        profilePath: info.profilePath,
        success: true,
        message: `Successfully installed ShellMind alias & autocompletions to ${info.profilePath}. Restart shell or run: source ${info.profilePath}`
      };
    } catch (err) {
      return {
        shell: info.shell,
        profilePath: info.profilePath,
        success: false,
        message: `Failed to update ${info.profilePath}: ${err.message}`
      };
    }
  }
};

// packages/cli/src/commands/doctor.ts
import { ContextCollector as ContextCollector2 } from "@shellmind/context";
import { ShellDetector as ShellDetector2 } from "@shellmind/shell";
import { ConfigManager as ConfigManager2 } from "@shellmind/core";
var DoctorCommand = class {
  static async run() {
    const configManager = new ConfigManager2();
    const config = configManager.getConfig();
    const collector = new ContextCollector2();
    const context = await collector.collect();
    const shell = ShellDetector2.detect();
    const checks = [
      {
        name: "Node.js Runtime",
        status: "ok",
        details: `${process.version} (requires >= 22.0.0)`
      },
      {
        name: "Active Shell Detection",
        status: "ok",
        details: `${shell} (${context.os.platform} ${context.os.arch})`
      },
      {
        name: "AI Provider Selected",
        status: "ok",
        details: `${config.provider.active.toUpperCase()}`
      },
      {
        name: "Gemini API Key",
        status: process.env.GEMINI_API_KEY ? "ok" : "warn",
        details: process.env.GEMINI_API_KEY ? "Configured in environment" : "Not set (heuristic mode active)"
      },
      {
        name: "Git Version Control",
        status: context.tools.git ? "ok" : "warn",
        details: context.tools.git || "Git not found in PATH"
      },
      {
        name: "Container Runtime (Docker)",
        status: context.tools.docker ? "ok" : "warn",
        details: context.tools.docker || "Docker not found in PATH"
      },
      {
        name: "Configuration File",
        status: "ok",
        details: configManager.getConfigPath()
      }
    ];
    return checks;
  }
};

// scripts/test-phase1.ts
async function runPhase1Tests() {
  const results = [];
  function assert(suite, name, condition, failMessage) {
    const t0 = performance.now();
    results.push({
      suite,
      name,
      passed: Boolean(condition),
      message: condition ? void 0 : failMessage || "Assertion failed",
      durationMs: Math.round((performance.now() - t0) * 100) / 100
    });
  }
  const analyzer = new SecurityAnalyzer();
  const safeRes = analyzer.analyze("ls -la /tmp");
  assert("SecurityAnalyzer", 'Categorizes "ls -la /tmp" as SAFE', safeRes.level === "SAFE" && !safeRes.requiresTypedConfirmation);
  const gitStatRes = analyzer.analyze("git status");
  assert("SecurityAnalyzer", 'Categorizes "git status" as SAFE', gitStatRes.level === "SAFE");
  const medRes = analyzer.analyze("docker compose down");
  assert("SecurityAnalyzer", 'Categorizes "docker compose down" as MEDIUM', medRes.level === "MEDIUM");
  const highRes = analyzer.analyze("chmod -R 777 /var/www");
  assert("SecurityAnalyzer", 'Categorizes "chmod -R 777" as HIGH', highRes.level === "HIGH");
  const gitResetRes = analyzer.analyze("git reset --hard HEAD~1");
  assert("SecurityAnalyzer", 'Categorizes "git reset --hard" as HIGH', gitResetRes.level === "HIGH");
  const critRootRes = analyzer.analyze("sudo rm -rf /");
  assert(
    "SecurityAnalyzer",
    'Categorizes "sudo rm -rf /" as CRITICAL with typed confirmation required',
    critRootRes.level === "CRITICAL" && critRootRes.requiresTypedConfirmation
  );
  const mkfsRes = analyzer.analyze("mkfs.ext4 /dev/sdb1");
  assert("SecurityAnalyzer", 'Categorizes "mkfs.ext4" as CRITICAL', mkfsRes.level === "CRITICAL" && mkfsRes.requiresTypedConfirmation);
  const forkbombRes = analyzer.analyze(":(){ :|:& };:");
  assert("SecurityAnalyzer", "Detects fork bomb as CRITICAL", forkbombRes.level === "CRITICAL" && forkbombRes.requiresTypedConfirmation);
  const configManager = new ConfigManager();
  const cfg = configManager.getConfig();
  assert("ConfigManager", "Defaults active provider to gemini", cfg.provider.active === "gemini");
  assert("ConfigManager", "Enforces zero auto execution by default", cfg.security.enforceZeroAutoExecution === true);
  configManager.setActiveProvider("ollama");
  assert("ConfigManager", "Switches active provider to ollama", configManager.getConfig().provider.active === "ollama");
  const orchestrator = new ShellMindOrchestrator(configManager, {
    securityEngine: analyzer,
    executionEngine: {
      execute: async (cmd) => ({
        command: cmd,
        exitCode: 0,
        stdout: "ok",
        stderr: "",
        durationMs: 10,
        cancelled: false
      })
    }
  });
  let blocked = false;
  try {
    await orchestrator.executeWithGuardrails("echo test", false);
  } catch {
    blocked = true;
  }
  assert("Orchestrator Guardrails", "Blocks unconfirmed command execution", blocked);
  let critBlocked = false;
  try {
    await orchestrator.executeWithGuardrails("sudo rm -rf /", true, "INVALID_TOKEN");
  } catch {
    critBlocked = true;
  }
  assert("Orchestrator Guardrails", 'Requires typed token "CONFIRM" for CRITICAL execution', critBlocked);
  const registry = new PluginRegistry();
  const plugins = registry.getAll();
  assert("PluginRegistry", "Registers 7 builtin plugins (git, docker, node, python, aws, kubectl, terraform)", plugins.length === 7);
  const mockCtx = {
    os: { platform: "linux", release: "6.0", arch: "x64", type: "Linux" },
    shell: "zsh",
    currentDirectory: "/app",
    user: "test",
    tools: {}
  };
  const gitIssues = registry.validateCommand("git push origin main --force", mockCtx);
  assert("PluginRegistry", "Git plugin catches destructive force push", gitIssues.length > 0 && gitIssues[0].severity === "warning");
  const allPassed = results.every((r) => r.passed);
  return { passed: allPassed, results };
}
if (typeof process !== "undefined" && process.argv && process.argv[1]?.includes("test-phase1")) {
  runPhase1Tests().then(({ passed, results }) => {
    console.log("\n--- ShellMind Phase 1 Test Results ---");
    results.forEach((r) => {
      console.log(`${r.passed ? "\u2714 PASS" : "\u2716 FAIL"} [${r.suite}] ${r.name} (${r.durationMs}ms)`);
      if (!r.passed && r.message) {
        console.log(`    Error: ${r.message}`);
      }
    });
    console.log(`
Summary: ${results.filter((r) => r.passed).length}/${results.length} passed.
`);
    if (!passed) process.exit(1);
  });
}

// server.ts
dotenv.config();
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3e3;
  app.use(express.json());
  const configManager = new ConfigManager();
  const securityAnalyzer = new SecurityAnalyzer();
  const executor = new ProcessExecutor();
  const pluginRegistry = new PluginRegistry();
  const memoryStore = new MemoryStore();
  const contextCollector = new ContextCollector();
  app.get("/api/context", async (_req, res) => {
    try {
      const context = await contextCollector.collect();
      res.json(context);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/ai/generate", async (req, res) => {
    try {
      const { prompt, preferredShell } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }
      const context = await contextCollector.collect();
      const config = configManager.getConfig();
      const provider = AIProviderFactory.create(config);
      const orchestrator = new ShellMindOrchestrator(configManager, {
        securityEngine: securityAnalyzer,
        aiGenerator: {
          generate: (req2) => provider.generateCommand(req2)
        },
        executionEngine: executor
      });
      const plan = await orchestrator.plan({
        naturalLanguagePrompt: prompt,
        context,
        preferredShell
      });
      const pluginIssues = pluginRegistry.validateCommand(plan.command, context);
      memoryStore.recordCommand({
        prompt,
        command: plan.command,
        directory: context.currentDirectory,
        riskLevel: plan.risk.level,
        executed: false
      });
      res.json({
        plan,
        pluginIssues
      });
    } catch (err) {
      console.error("Error generating command:", err);
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/ai/explain", async (req, res) => {
    try {
      const { command } = req.body;
      if (!command) {
        return res.status(400).json({ error: "Command is required" });
      }
      const context = await contextCollector.collect();
      const config = configManager.getConfig();
      const provider = AIProviderFactory.create(config);
      const explanation = await provider.explainCommand(command, context);
      res.json(explanation);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/ai/diagnose", async (req, res) => {
    try {
      const { failedCommand, stderr } = req.body;
      const context = await contextCollector.collect();
      const config = configManager.getConfig();
      const provider = AIProviderFactory.create(config);
      const diagnosis = await provider.diagnoseError(failedCommand, stderr || "", context);
      res.json(diagnosis);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/security/evaluate", (req, res) => {
    try {
      const { command } = req.body;
      const assessment = securityAnalyzer.analyze(command || "");
      res.json(assessment);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/doctor", async (_req, res) => {
    try {
      const checks = await DoctorCommand.run();
      const shell = ShellDetector.detect();
      const profile = ShellInstaller.getProfileInfo();
      res.json({
        checks,
        shell,
        profile,
        activeProvider: configManager.getConfig().provider.active
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/config", (_req, res) => {
    res.json(configManager.getConfig());
  });
  app.post("/api/config", (req, res) => {
    try {
      const updated = configManager.updateConfig(req.body);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/plugins", (_req, res) => {
    res.json(pluginRegistry.getAll());
  });
  app.get("/api/memory", (_req, res) => {
    res.json({
      history: memoryStore.getHistory(30),
      workflows: memoryStore.getWorkflows(),
      aliases: memoryStore.getAliases()
    });
  });
  app.get("/api/tests/run", async (_req, res) => {
    try {
      const results = await runPhase1Tests();
      res.json(results);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/execute", async (req, res) => {
    try {
      const { command, confirmed, typedConfirmationToken } = req.body;
      const orchestrator = new ShellMindOrchestrator(configManager, {
        securityEngine: securityAnalyzer,
        executionEngine: executor
      });
      const result = await orchestrator.executeWithGuardrails(
        command,
        confirmed,
        typedConfirmationToken
      );
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
  if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.resolve(__dirname, "dist")));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(__dirname, "dist", "index.html"));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`
\u{1F680} ShellMind Server running on http://0.0.0.0:${PORT}`);
  });
}
startServer().catch((err) => {
  console.error("Failed to start ShellMind server:", err);
  process.exit(1);
});
/**
 * @license Apache-2.0
 * ShellMind Core Domain Types
 */
/**
 * @license Apache-2.0
 * ShellMind Configuration Schema & Defaults
 */
/**
 * @license Apache-2.0
 * ShellMind Config Manager
 * Handles loading, saving, and merging configuration from ~/.shellmind/config.json
 */
/**
 * @license Apache-2.0
 * ShellMind Event Bus and Lifecycle Hooks
 */
/**
 * @license Apache-2.0
 * ShellMind Central Orchestrator
 * Coordinates context extraction, memory lookup, AI command generation,
 * strict security analysis, and safe execution guardrails.
 */
/**
 * @license Apache-2.0
 * @shellmind/core - Main entry point
 */
/**
 * @license Apache-2.0
 * ShellMind Security Types
 */
/**
 * @license Apache-2.0
 * ShellMind Security Rules & Pattern Definitions
 */
/**
 * @license Apache-2.0
 * ShellMind Security Analyzer
 * Deterministic command risk classification & guardrail evaluator
 */
/**
 * @license Apache-2.0
 * @shellmind/security - Main entry point
 */
/**
 * @license Apache-2.0
 * ShellMind Context Types
 */
/**
 * @license Apache-2.0
 * ShellMind Context Collector
 * Automatically gathers OS, Shell, Git, project indicators, and toolchain info.
 */
/**
 * @license Apache-2.0
 * @shellmind/context - Main entry point
 */
/**
 * @license Apache-2.0
 * ShellMind AI Prompt Templates & System Instructions
 */
/**
 * @license Apache-2.0
 * ShellMind Gemini AI Provider
 * Integrates with Google Gen AI SDK (@google/genai)
 */
/**
 * @license Apache-2.0
 * ShellMind OpenAI-Compatible Provider Adapter
 */
/**
 * @license Apache-2.0
 * ShellMind Ollama Local Provider Adapter
 * Completely offline, privacy-first terminal copilot using local models
 */
/**
 * @license Apache-2.0
 * ShellMind AI Provider Factory
 */
/**
 * @license Apache-2.0
 * ShellMind Execution Engine Types
 */
/**
 * @license Apache-2.0
 * ShellMind Process Execution Engine
 */
/**
 * @license Apache-2.0
 * @shellmind/executor - Main entry point
 */
/**
 * @license Apache-2.0
 * ShellMind Plugin Architecture Types
 */
/**
 * @license Apache-2.0
 * ShellMind Builtin Plugins
 * Git, Docker, Node, Python, AWS CLI, kubectl, Terraform
 */
/**
 * @license Apache-2.0
 * ShellMind Plugin Registry
 */
/**
 * @license Apache-2.0
 * @shellmind/plugins - Main entry point
 */
/**
 * @license Apache-2.0
 * ShellMind Memory Types
 */
/**
 * @license Apache-2.0
 * ShellMind Memory Store
 * Manages persistent history, frequent patterns, and learned workflows
 */
/**
 * @license Apache-2.0
 * @shellmind/memory - Main entry point
 */
/**
 * @license Apache-2.0
 * ShellMind Shell Integration Types
 */
/**
 * @license Apache-2.0
 * ShellMind Shell Detector
 */
/**
 * @license Apache-2.0
 * ShellMind Shell Autocompletions Generator
 */
/**
 * @license Apache-2.0
 * ShellMind Shell Installer
 * Safely adds alias ai="shellmind" and completion hooks to user profile
 */
/**
 * @license Apache-2.0
 * @shellmind/shell - Main entry point
 */
/**
 * @license Apache-2.0
 * ShellMind Doctor Command
 * Diagnoses system environment, active provider, shell integration, and permissions
 */
/**
 * @license Apache-2.0
 * ShellMind Phase 1 Test Suite
 * Verifies clean architecture, security categorization, config management, and guardrails.
 */
/**
 * @license Apache-2.0
 * ShellMind Server Entrypoint
 * Full-stack Express server bridging AI Studio, Vite dev middlewares, and ShellMind core packages.
 */
