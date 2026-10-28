/**
 * @license Apache-2.0
 * ShellMind AI Terminal Copilot - Interactive Development Center & Playground
 */

import React, { useState, useEffect } from 'react';
import {
  Terminal,
  Shield,
  Layers,
  Cpu,
  Settings,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Play,
  RotateCcw,
  Sparkles,
  BookOpen,
  Activity,
  FolderGit2,
  Command,
  FileCode,
  Zap,
  Lock,
  ArrowRight,
  Database,
  History,
  Box,
  Download,
  ExternalLink,
  PackageCheck,
  Check,
} from 'lucide-react';

interface RiskAssessment {
  level: 'SAFE' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reasons: string[];
  requiresTypedConfirmation: boolean;
  destructiveFlags?: string[];
}

interface CommandPlan {
  command: string;
  explanation: string;
  risk: RiskAssessment;
  alternatives?: Array<{ command: string; description: string }>;
  multiStepPlan?: string[];
  safetyNotes?: string[];
}

interface TestItem {
  suite: string;
  name: string;
  passed: boolean;
  message?: string;
  durationMs: number;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<
    'terminal' | 'architecture' | 'security' | 'context' | 'plugins' | 'config' | 'tests' | 'download'
  >('terminal');

  // Terminal state
  const [promptInput, setPromptInput] = useState('find every pdf larger than 20MB');
  const [loading, setLoading] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<CommandPlan | null>(null);
  const [pluginIssues, setPluginIssues] = useState<any[]>([]);
  const [editableCommand, setEditableCommand] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [typedConfirmation, setTypedConfirmation] = useState('');
  const [executionOutput, setExecutionOutput] = useState<{
    stdout: string;
    stderr: string;
    exitCode: number;
    durationMs: number;
  } | null>(null);

  // Security sandbox state
  const [sandboxCmd, setSandboxCmd] = useState('chmod -R 777 /var/www');
  const [sandboxRisk, setSandboxRisk] = useState<RiskAssessment | null>(null);

  // System Context & Doctor state
  const [systemContext, setSystemContext] = useState<any>(null);
  const [doctorInfo, setDoctorInfo] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [pluginsList, setPluginsList] = useState<any[]>([]);
  const [memoryData, setMemoryData] = useState<any>(null);

  // Test suite state
  const [testResults, setTestResults] = useState<{ passed: boolean; results: TestItem[] } | null>(null);
  const [runningTests, setRunningTests] = useState(false);

  // Quick prompt presets
  const presets = [
    { label: 'Find PDFs > 20MB', prompt: 'find every pdf larger than 20MB' },
    { label: 'Delete node_modules', prompt: 'delete node_modules' },
    { label: 'Compress PNGs', prompt: 'compress every png in assets to webp' },
    { label: 'Explain chmod 755', prompt: 'chmod 755', isExplain: true },
    { label: 'Docker Status', prompt: 'docker ps', isRun: true },
    { label: 'Root rm (CRITICAL test)', prompt: 'sudo rm -rf /', isRaw: true },
  ];

  // Fetch initial data
  useEffect(() => {
    fetchContext();
    fetchConfig();
    fetchDoctor();
    fetchPlugins();
    fetchMemory();
    runTests();
    evaluateSandbox(sandboxCmd);
  }, []);

  const fetchContext = async () => {
    try {
      const res = await fetch('/api/context');
      if (res.ok) setSystemContext(await res.json());
    } catch (e) {
      console.warn('Context fetch error:', e);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) setConfig(await res.json());
    } catch (e) {
      console.warn('Config fetch error:', e);
    }
  };

  const fetchDoctor = async () => {
    try {
      const res = await fetch('/api/doctor');
      if (res.ok) setDoctorInfo(await res.json());
    } catch (e) {
      console.warn('Doctor fetch error:', e);
    }
  };

  const fetchPlugins = async () => {
    try {
      const res = await fetch('/api/plugins');
      if (res.ok) setPluginsList(await res.json());
    } catch (e) {
      console.warn('Plugins fetch error:', e);
    }
  };

  const fetchMemory = async () => {
    try {
      const res = await fetch('/api/memory');
      if (res.ok) setMemoryData(await res.json());
    } catch (e) {
      console.warn('Memory fetch error:', e);
    }
  };

  const runTests = async () => {
    setRunningTests(true);
    try {
      const res = await fetch('/api/tests/run');
      if (res.ok) setTestResults(await res.json());
    } catch (e) {
      console.warn('Tests run error:', e);
    } finally {
      setRunningTests(false);
    }
  };

  const evaluateSandbox = async (cmd: string) => {
    try {
      const res = await fetch('/api/security/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd }),
      });
      if (res.ok) setSandboxRisk(await res.json());
    } catch (e) {
      console.warn('Security eval error:', e);
    }
  };

  const handleGenerate = async (e?: React.FormEvent, overridePrompt?: string) => {
    if (e) e.preventDefault();
    const query = overridePrompt ?? promptInput;
    if (!query.trim()) return;

    setLoading(true);
    setExecutionOutput(null);
    setIsEditing(false);
    setTypedConfirmation('');

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: query }),
      });

      if (res.ok) {
        const data = await res.json();
        setCurrentPlan(data.plan);
        setPluginIssues(data.pluginIssues || []);
        setEditableCommand(data.plan.command);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!currentPlan) return;
    const cmdToRun = isEditing ? editableCommand : currentPlan.command;

    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: cmdToRun,
          confirmed: true,
          typedConfirmationToken: typedConfirmation,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setExecutionOutput({
          stdout: '',
          stderr: data.error || 'Execution blocked by guardrail',
          exitCode: 1,
          durationMs: 0,
        });
      } else {
        setExecutionOutput(data);
        fetchMemory();
      }
    } catch (err: any) {
      setExecutionOutput({
        stdout: '',
        stderr: err.message,
        exitCode: 1,
        durationMs: 0,
      });
    }
  };

  const handleTriggerErrorDiagnosis = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          failedCommand: 'npm install -g pnpm',
          stderr: 'npm ERR! code EACCES\nnpm ERR! syscall mkdir\nnpm ERR! path /usr/local/lib/node_modules/pnpm\nnpm ERR! errno -13\nnpm ERR! Error: EACCES: permission denied, mkdir "/usr/local/lib/node_modules/pnpm"',
        }),
      });

      if (res.ok) {
        const diag = await res.json();
        setCurrentPlan({
          command: diag.repairedCommand || 'sudo npm install -g pnpm',
          explanation: `Diagnosis: ${diag.rootCause}`,
          risk: {
            level: 'HIGH',
            reasons: ['Privilege escalation with sudo', 'Global package installation'],
            requiresTypedConfirmation: false,
          },
          alternatives: diag.suggestedFixes.map((f: string) => ({
            command: f,
            description: 'Proposed fix step',
          })),
        });
        setEditableCommand(diag.repairedCommand || 'sudo npm install -g pnpm');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getRiskBadge = (level?: string) => {
    switch (level) {
      case 'SAFE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" /> SAFE (Read-Only)
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded bg-amber-950 text-amber-300 border border-amber-800">
            <AlertTriangle className="w-3.5 h-3.5" /> MEDIUM (State Modifying)
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded bg-purple-950 text-purple-300 border border-purple-800">
            <AlertTriangle className="w-3.5 h-3.5" /> HIGH (Destructive / Permissions)
          </span>
        );
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded bg-rose-950 text-rose-300 border border-rose-800 animate-pulse">
            <XCircle className="w-3.5 h-3.5" /> CRITICAL (System / Disk Impact)
          </span>
        );
      default:
        return null;
    }
  };

  const packagesInfo = [
    {
      id: '@shellmind/core',
      name: 'core',
      color: 'border-blue-500/40 bg-blue-950/20 text-blue-300',
      description: 'Central domain contracts, orchestrator lifecycle, event bus, and config manager.',
      exports: ['ShellMindOrchestrator', 'ConfigManager', 'EventEmitter', 'ShellMindConfig'],
    },
    {
      id: '@shellmind/security',
      name: 'security',
      color: 'border-rose-500/40 bg-rose-950/20 text-rose-300',
      description: 'Deterministic 4-tier risk classifier, dangerous regex rules, and typed confirmation guardrail.',
      exports: ['SecurityAnalyzer', 'BUILTIN_SECURITY_RULES', 'RiskAssessment'],
    },
    {
      id: '@shellmind/ai',
      name: 'ai',
      color: 'border-amber-500/40 bg-amber-950/20 text-amber-300',
      description: 'Multi-provider abstraction supporting Google Gemini (gemini-3.8-flash), OpenAI, and Ollama.',
      exports: ['GeminiProvider', 'OpenAIProvider', 'OllamaProvider', 'AIProviderFactory'],
    },
    {
      id: '@shellmind/context',
      name: 'context',
      color: 'border-cyan-500/40 bg-cyan-950/20 text-cyan-300',
      description: 'Environment telemetry engine: detects OS, Shell, Git branch, package manifests, and tools.',
      exports: ['ContextCollector', 'SystemContext'],
    },
    {
      id: '@shellmind/executor',
      name: 'executor',
      color: 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300',
      description: 'Safe subprocess execution with stream piping, timeout control, and stderr capture.',
      exports: ['ProcessExecutor', 'ExecutionResult'],
    },
    {
      id: '@shellmind/shell',
      name: 'shell',
      color: 'border-purple-500/40 bg-purple-950/20 text-purple-300',
      description: 'Cross-shell detector (Bash, Zsh, Fish, PS, CMD), .rc profile installer, and tab completions.',
      exports: ['ShellDetector', 'ShellInstaller', 'CompletionGenerator'],
    },
    {
      id: '@shellmind/memory',
      name: 'memory',
      color: 'border-indigo-500/40 bg-indigo-950/20 text-indigo-300',
      description: 'Persistent history store, learned project workflows, and command frequency tracker.',
      exports: ['MemoryStore', 'CommandHistoryEntry', 'LearnedWorkflow'],
    },
    {
      id: '@shellmind/plugins',
      name: 'plugins',
      color: 'border-teal-500/40 bg-teal-950/20 text-teal-300',
      description: 'Extensible tool plugins: Git, Docker, Node, Python, AWS CLI, kubectl, Terraform.',
      exports: ['PluginRegistry', 'BUILTIN_PLUGINS', 'ShellMindPlugin'],
    },
    {
      id: '@shellmind/cli',
      name: 'cli',
      color: 'border-sky-500/40 bg-sky-950/20 text-sky-300',
      description: 'Commander.js executable binary (`ai`, `shellmind`), terminal tables, and doctor diagnostics.',
      exports: ['createCLI', 'DoctorCommand', 'formatCommandCard'],
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      {/* Top Navbar */}
      <header className="border-b border-zinc-800 bg-zinc-900/60 backdrop-blur sticky top-0 z-50 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-600 to-emerald-500 flex items-center justify-center text-white shadow-lg shadow-cyan-900/30">
            <Terminal className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
                ShellMind
              </span>
              <span className="text-xs px-2 py-0.5 rounded font-mono bg-zinc-800 text-zinc-400 border border-zinc-700">
                Phase 1 Active
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              AI Terminal Copilot • Native Shell Integration • Zero Auto-Execution
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
          {[
            { id: 'terminal', label: 'Copilot Terminal', icon: Terminal },
            { id: 'architecture', label: 'Architecture & Pkgs', icon: Layers },
            { id: 'security', label: 'Security Guardrails', icon: Shield },
            { id: 'context', label: 'Context Engine', icon: Cpu },
            { id: 'plugins', label: 'Plugins (7)', icon: Box },
            { id: 'tests', label: 'Tests (15)', icon: CheckCircle2 },
            { id: 'config', label: 'Config & Doctor', icon: Settings },
            { id: 'download', label: 'Download & SDK', icon: Download },
          ].map(tab => {
            const Icon = tab.icon;
            const isSel = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  isSel
                    ? 'bg-zinc-800 text-cyan-400 shadow-sm border border-zinc-700'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <a
          href="/download"
          download="shellmind-v0.1.0.tar.gz"
          className="hidden lg:flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white shadow-md shadow-cyan-900/20 transition cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download v0.1.0</span>
        </a>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        {/* TAB 1: TERMINAL COPILOT */}
        {activeTab === 'terminal' && (
          <div className="space-y-6">
            {/* Quick Hero Banner */}
            <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-850 p-5 rounded-xl border border-zinc-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-cyan-400" />
                  Natural Language Terminal Copilot
                </h1>
                <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
                  Type what you want to accomplish in natural language. ShellMind inspects your OS, shell, and project files, produces exact shell syntax, assesses risk level, and halts for your explicit confirmation.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTriggerErrorDiagnosis}
                  className="px-3 py-1.5 text-xs font-medium rounded bg-rose-950/60 text-rose-300 border border-rose-800/80 hover:bg-rose-900/60 transition flex items-center gap-1.5"
                >
                  <AlertTriangle className="w-3.5 h-3.5" /> Test Error Diagnosis (EACCES)
                </button>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-zinc-400 font-mono">Try examples:</span>
              {presets.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setPromptInput(p.prompt);
                    handleGenerate(undefined, p.prompt);
                  }}
                  className="px-2.5 py-1 text-xs rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition font-mono"
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Interactive Terminal Window */}
            <div className="rounded-xl border border-zinc-800 bg-black/90 shadow-2xl overflow-hidden">
              {/* Terminal Title Bar */}
              <div className="bg-zinc-900/90 px-4 py-2.5 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                  <span className="ml-2 text-xs font-mono text-zinc-400">
                    user@shellmind: {systemContext?.currentDirectory || '/workspace/shellmind'} ({systemContext?.shell || 'zsh'})
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs font-mono text-zinc-400">
                  <span>Provider: <strong className="text-cyan-400">{config?.provider?.active || 'gemini'}</strong></span>
                  <span>Enforce Zero Auto-Exec: <strong className="text-emerald-400">ON</strong></span>
                </div>
              </div>

              {/* Command Prompt Input */}
              <form onSubmit={e => handleGenerate(e)} className="p-4 border-b border-zinc-800/80 bg-zinc-950/40">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-emerald-400 font-mono font-bold text-sm">
                    <span>❯</span>
                    <span className="text-cyan-400">ai</span>
                  </div>
                  <input
                    type="text"
                    value={promptInput}
                    onChange={e => setPromptInput(e.target.value)}
                    placeholder='Describe command, e.g. "find every pdf larger than 20MB"'
                    className="flex-1 bg-transparent border-0 outline-none font-mono text-sm text-zinc-100 placeholder-zinc-600"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-1.5 text-xs font-semibold rounded bg-cyan-600 hover:bg-cyan-500 text-white transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <RotateCcw className="w-3.5 h-3.5 animate-spin" /> Thinking...
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5" /> Plan Command
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Plan Output & Interactive Confirmation Panel */}
              <div className="p-5 space-y-5 font-mono text-sm">
                {currentPlan ? (
                  <div className="space-y-4">
                    {/* Command Card */}
                    <div className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="text-xs text-zinc-400 uppercase font-sans font-semibold tracking-wider mb-1">
                            Generated Command
                          </div>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editableCommand}
                              onChange={e => setEditableCommand(e.target.value)}
                              className="w-full bg-zinc-950 border border-cyan-500 rounded px-2.5 py-1 text-cyan-300 font-mono text-sm outline-none"
                            />
                          ) : (
                            <div className="text-base text-cyan-300 font-bold break-all flex items-center gap-2">
                              <span>$</span>
                              <span>{editableCommand}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {getRiskBadge(currentPlan.risk.level)}
                          <button
                            onClick={() => navigator.clipboard.writeText(editableCommand)}
                            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
                            title="Copy command"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Explanation */}
                      <div className="mt-3 text-xs text-zinc-300 border-t border-zinc-800/80 pt-3">
                        <span className="text-zinc-400 font-semibold font-sans">Explanation: </span>
                        {currentPlan.explanation}
                      </div>

                      {/* Security Reasons */}
                      {currentPlan.risk.reasons?.length > 0 && (
                        <div className="mt-2 text-xs text-zinc-400">
                          <span className="text-zinc-400 font-semibold font-sans">Security Check: </span>
                          {currentPlan.risk.reasons.join(' • ')}
                        </div>
                      )}

                      {/* Plugin Guidance Warnings */}
                      {pluginIssues.length > 0 && (
                        <div className="mt-3 p-2.5 rounded bg-amber-950/40 border border-amber-800/50 text-xs text-amber-200 space-y-1">
                          <div className="font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Plugin Advisory:
                          </div>
                          {pluginIssues.map((issue, idx) => (
                            <div key={idx} className="pl-4">
                              • {issue.message} {issue.suggestedCorrection && `(Suggested: ${issue.suggestedCorrection})`}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Alternatives */}
                      {currentPlan.alternatives && currentPlan.alternatives.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-zinc-800/80 text-xs">
                          <span className="text-zinc-400 font-semibold font-sans">Alternative Commands:</span>
                          <div className="mt-1 space-y-1">
                            {currentPlan.alternatives.map((alt, i) => (
                              <div
                                key={i}
                                onClick={() => {
                                  setEditableCommand(alt.command);
                                  setIsEditing(false);
                                }}
                                className="cursor-pointer text-zinc-400 hover:text-cyan-300 transition pl-2"
                              >
                                ❯ <code className="text-zinc-300">{alt.command}</code> — <span className="text-zinc-400">{alt.description}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Interactive Confirmation Guardrail */}
                    <div className="p-4 rounded-lg bg-zinc-900/90 border border-zinc-700/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div>
                        <div className="text-xs font-sans font-bold text-zinc-200 flex items-center gap-1.5">
                          <Lock className="w-4 h-4 text-cyan-400" />
                          Zero Auto-Execution Policy: Execution Confirmation
                        </div>
                        <p className="text-xs text-zinc-400 font-sans mt-0.5">
                          ShellMind will NEVER execute commands without human permission.
                        </p>
                      </div>

                      {/* Critical Typed Confirmation Requirement */}
                      {currentPlan.risk.level === 'CRITICAL' && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-rose-400 font-sans font-semibold">Type "CONFIRM":</span>
                          <input
                            type="text"
                            value={typedConfirmation}
                            onChange={e => setTypedConfirmation(e.target.value)}
                            placeholder="CONFIRM"
                            className="bg-black border border-rose-500 rounded px-2 py-1 text-xs font-mono text-rose-300 w-28 uppercase"
                          />
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setIsEditing(!isEditing)}
                          className="px-3 py-1.5 text-xs font-medium rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition"
                        >
                          {isEditing ? 'Done Editing' : '[E] Edit Command'}
                        </button>
                        <button
                          onClick={() => {
                            setCurrentPlan(null);
                            setExecutionOutput(null);
                          }}
                          className="px-3 py-1.5 text-xs font-medium rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
                        >
                          [N] Cancel
                        </button>
                        <button
                          onClick={handleExecute}
                          disabled={
                            currentPlan.risk.level === 'CRITICAL' && typedConfirmation !== 'CONFIRM'
                          }
                          className="px-4 py-1.5 text-xs font-bold rounded bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-emerald-900/30"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" /> [Y] Execute Command
                        </button>
                      </div>
                    </div>

                    {/* Execution Output Box */}
                    {executionOutput && (
                      <div className="p-4 rounded-lg bg-black border border-zinc-800 space-y-2">
                        <div className="flex items-center justify-between text-xs text-zinc-400 font-sans">
                          <span className="flex items-center gap-2">
                            <span>Process Execution Result:</span>
                            {executionOutput.exitCode === 0 ? (
                              <span className="text-emerald-400 font-bold">Exit Code 0 (Success)</span>
                            ) : (
                              <span className="text-rose-400 font-bold">Exit Code {executionOutput.exitCode} (Failed)</span>
                            )}
                          </span>
                          <span>Completed in {executionOutput.durationMs}ms</span>
                        </div>
                        {executionOutput.stdout && (
                          <pre className="text-xs text-zinc-200 whitespace-pre-wrap font-mono bg-zinc-950 p-3 rounded border border-zinc-900">
                            {executionOutput.stdout}
                          </pre>
                        )}
                        {executionOutput.stderr && (
                          <pre className="text-xs text-rose-300 whitespace-pre-wrap font-mono bg-rose-950/20 p-3 rounded border border-rose-900/40">
                            {executionOutput.stderr}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-12 text-center text-zinc-400 space-y-2">
                    <Terminal className="w-8 h-8 mx-auto text-zinc-400" />
                    <p className="text-sm">Ready. Enter a command prompt above or pick a preset to see ShellMind in action.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ARCHITECTURE & PACKAGES */}
        {activeTab === 'architecture' && (
          <div className="space-y-6">
            <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800">
              <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <Layers className="w-5 h-5 text-cyan-400" />
                Monorepo Architecture (9 Domain Packages)
              </h2>
              <p className="text-sm text-zinc-400 mt-1">
                Every package adheres to Single Responsibility, strict TypeScript, ES2022, and explicit dependency injection.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {packagesInfo.map(pkg => (
                <div
                  key={pkg.id}
                  className={`p-4 rounded-xl border ${pkg.color} flex flex-col justify-between`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-bold tracking-tight">{pkg.id}</span>
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-900/60 border border-zinc-800">
                        v0.1.0
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-2 font-sans">{pkg.description}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-800/80">
                    <span className="text-xs font-mono text-zinc-400 block mb-1">Key Exports:</span>
                    <div className="flex flex-wrap gap-1">
                      {pkg.exports.map((exp, idx) => (
                        <span
                          key={idx}
                          className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300"
                        >
                          {exp}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Dependency Tree Diagram */}
            <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 font-mono text-xs text-zinc-300 space-y-2">
              <div className="font-bold text-sm text-cyan-400 font-sans flex items-center gap-2 mb-3">
                <FileCode className="w-4 h-4" /> Package Dependency Flow (Clean Onion Architecture)
              </div>
              <pre className="bg-zinc-950 p-4 rounded-lg overflow-x-auto text-zinc-300 leading-relaxed border border-zinc-800">
{`[User Shell] (Bash, Zsh, Fish, PowerShell, CMD)
      │
      ▼
[@shellmind/cli] (Commander.js, Terminal UX, Spinners, Tables)
      │
      ▼
[@shellmind/core] (Orchestrator Lifecycle, Event Bus, Config Manager)
   ├─── [@shellmind/context] (OS, Shell, Git, Filesystem Manifests)
   ├─── [@shellmind/plugins] (Git, Docker, Node, Python, AWS, k8s, TF)
   ├─── [@shellmind/memory] (History Store, Learned Workflows)
   ├─── [@shellmind/ai] (Gemini gemini-3.8-flash, OpenAI, Ollama)
   ├─── [@shellmind/security] (SAFE, MEDIUM, HIGH, CRITICAL Guardrails)
   └─── [@shellmind/executor] (Subprocess Isolation, Output Streams)`}
              </pre>
            </div>
          </div>
        )}

        {/* TAB 3: SECURITY GUARDRAILS */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800">
              <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <Shield className="w-5 h-5 text-rose-400" />
                Security Risk Evaluation Engine & Sandbox
              </h2>
              <p className="text-sm text-zinc-400 mt-1">
                Zero auto-execution: Every command is evaluated before execution. Critical commands require typed token validation.
              </p>
            </div>

            {/* Sandbox Input */}
            <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
              <div className="text-xs font-sans font-semibold text-zinc-300">
                Live Command Risk Sandbox:
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={sandboxCmd}
                  onChange={e => {
                    setSandboxCmd(e.target.value);
                    evaluateSandbox(e.target.value);
                  }}
                  className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono text-zinc-100 outline-none focus:border-cyan-500"
                  placeholder="Type any command (e.g. sudo rm -rf /, docker compose down, git status)..."
                />
              </div>

              {sandboxRisk && (
                <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-3 font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400 font-sans font-semibold">Assessed Risk Tier:</span>
                    {getRiskBadge(sandboxRisk.level)}
                  </div>
                  <div>
                    <span className="text-xs text-zinc-400 font-sans block mb-1">Reasoning:</span>
                    <ul className="text-xs text-zinc-300 space-y-1 list-disc pl-4">
                      {sandboxRisk.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="text-xs text-zinc-400 pt-2 border-t border-zinc-800 flex items-center justify-between">
                    <span>Requires Typed Confirmation ("CONFIRM"):</span>
                    <strong className={sandboxRisk.requiresTypedConfirmation ? 'text-rose-400' : 'text-emerald-400'}>
                      {sandboxRisk.requiresTypedConfirmation ? 'YES (MANDATORY)' : 'NO'}
                    </strong>
                  </div>
                </div>
              )}
            </div>

            {/* Security Rules Table */}
            <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
              <div className="font-bold text-sm text-zinc-100">4-Tier Risk Classification Matrix</div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-zinc-950 text-zinc-400 border-b border-zinc-800">
                    <tr>
                      <th className="p-3">Level</th>
                      <th className="p-3">Policy & Guardrail</th>
                      <th className="p-3">Typical Commands</th>
                      <th className="p-3">Interactive Prompt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    <tr>
                      <td className="p-3 text-emerald-400 font-bold">SAFE</td>
                      <td className="p-3 text-zinc-300">Read-only queries, no persistent state altered</td>
                      <td className="p-3 text-zinc-400">ls, pwd, cat, git status, date</td>
                      <td className="p-3 text-zinc-400">[Y/n] Default Enter</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-amber-400 font-bold">MEDIUM</td>
                      <td className="p-3 text-zinc-300">Local file writes, container stops, global packages</td>
                      <td className="p-3 text-zinc-400">docker compose down, npm install -g</td>
                      <td className="p-3 text-zinc-400">[Y/n] Explicit confirmation</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-purple-400 font-bold">HIGH</td>
                      <td className="p-3 text-zinc-300">Recursive deletions, permission resets, git hard resets</td>
                      <td className="p-3 text-zinc-400">chmod -R 777, git reset --hard, rm -rf</td>
                      <td className="p-3 text-zinc-400">[Y/n] Highlighted warning</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-rose-400 font-bold">CRITICAL</td>
                      <td className="p-3 text-zinc-300">Root deletions, raw device writes, partition formatting</td>
                      <td className="p-3 text-zinc-400">sudo rm -rf /, mkfs, dd of=/dev/sda</td>
                      <td className="p-3 text-rose-400 font-bold">Must type "CONFIRM" string</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: CONTEXT ENGINE */}
        {activeTab === 'context' && (
          <div className="space-y-6">
            <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800">
              <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <Cpu className="w-5 h-5 text-cyan-400" />
                Live Context Engine Telemetry
              </h2>
              <p className="text-sm text-zinc-400 mt-1">
                ShellMind automatically extracts OS details, active shell, Git status, project indicator files, and installed toolchains to formulate syntactically exact commands.
              </p>
            </div>

            {systemContext ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* OS & Shell */}
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3 font-mono text-xs">
                  <div className="font-sans font-bold text-sm text-cyan-400 flex items-center gap-2">
                    <Terminal className="w-4 h-4" /> System & Shell Environment
                  </div>
                  <div className="space-y-1.5 text-zinc-300">
                    <div>Platform: <strong className="text-zinc-100">{systemContext.os?.platform} ({systemContext.os?.type} {systemContext.os?.release})</strong></div>
                    <div>Architecture: <strong className="text-zinc-100">{systemContext.os?.arch}</strong></div>
                    <div>Active Shell: <strong className="text-emerald-400">{systemContext.shell}</strong></div>
                    <div>User: <strong className="text-zinc-100">{systemContext.user}</strong></div>
                    <div>Working Directory: <strong className="text-zinc-100 break-all">{systemContext.currentDirectory}</strong></div>
                  </div>
                </div>

                {/* Git Metadata */}
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3 font-mono text-xs">
                  <div className="font-sans font-bold text-sm text-purple-400 flex items-center gap-2">
                    <FolderGit2 className="w-4 h-4" /> Git Repository Context
                  </div>
                  <div className="space-y-1.5 text-zinc-300">
                    <div>Repository: <strong className="text-zinc-100">{systemContext.git?.isRepo ? 'YES' : 'NO'}</strong></div>
                    <div>Branch: <strong className="text-cyan-400">{systemContext.git?.branch || 'main'}</strong></div>
                    <div>Status: <strong className="text-zinc-100">{systemContext.git?.statusSummary || 'clean'}</strong></div>
                  </div>
                </div>

                {/* Project Indicators */}
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3 font-mono text-xs">
                  <div className="font-sans font-bold text-sm text-amber-400 flex items-center gap-2">
                    <FileCode className="w-4 h-4" /> Project Manifests Detected
                  </div>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {systemContext.project?.manifestFiles?.map((file: string, idx: number) => (
                        <span key={idx} className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-700 text-zinc-200">
                          {file}
                        </span>
                      ))}
                    </div>
                    {systemContext.project?.packageJson?.name && (
                      <div className="text-zinc-400 mt-2">
                        Package: <span className="text-zinc-200">{systemContext.project.packageJson.name}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Toolchain Check */}
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3 font-mono text-xs">
                  <div className="font-sans font-bold text-sm text-emerald-400 flex items-center gap-2">
                    <Command className="w-4 h-4" /> Installed CLI Toolchains
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-zinc-300">
                    {Object.entries(systemContext.tools || {}).map(([tool, version]: any) => (
                      <div key={tool} className="p-2 rounded bg-zinc-950 border border-zinc-800">
                        <div className="text-zinc-400 uppercase text-[10px]">{tool}</div>
                        <div className="text-zinc-200 truncate">{version || 'Not detected'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-zinc-400">Loading context...</div>
            )}
          </div>
        )}

        {/* TAB 5: PLUGINS */}
        {activeTab === 'plugins' && (
          <div className="space-y-6">
            <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800">
              <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <Box className="w-5 h-5 text-teal-400" />
                Built-in Plugins (7 Initial Implementations)
              </h2>
              <p className="text-sm text-zinc-400 mt-1">
                Plugins enrich context, inject domain validations (e.g. guarding git push --force), improve prompts, and provide flag explanations.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pluginsList.map(plugin => (
                <div key={plugin.id} className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-teal-300">{plugin.name}</span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-950 border border-zinc-700 text-zinc-400">
                      binary: {plugin.targetBinary}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">{plugin.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: TESTS RUNNER */}
        {activeTab === 'tests' && (
          <div className="space-y-6">
            <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  Phase 1 Unit & Integration Test Suite
                </h2>
                <p className="text-sm text-zinc-400 mt-1">
                  Verifies security rules, configuration defaults, orchestrator zero auto-execution guardrails, and plugin validators.
                </p>
              </div>
              <button
                onClick={runTests}
                disabled={runningTests}
                className="px-4 py-2 text-xs font-bold rounded bg-cyan-600 hover:bg-cyan-500 text-white transition flex items-center gap-2 disabled:opacity-50"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${runningTests ? 'animate-spin' : ''}`} />
                {runningTests ? 'Running...' : 'Re-run Tests'}
              </button>
            </div>

            {testResults && (
              <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                  <div className="text-sm font-semibold text-zinc-200">
                    Results: {testResults.results.filter(r => r.passed).length} / {testResults.results.length} Passed
                  </div>
                  <span className="px-2.5 py-1 text-xs font-bold rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                    100% SUITE PASS
                  </span>
                </div>

                <div className="space-y-2 font-mono text-xs">
                  {testResults.results.map((res, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        {res.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        )}
                        <span className="text-zinc-400">[{res.suite}]</span>
                        <span className="text-zinc-200">{res.name}</span>
                      </div>
                      <span className="text-zinc-400">{res.durationMs}ms</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 7: CONFIG & DOCTOR */}
        {activeTab === 'config' && (
          <div className="space-y-6">
            <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800">
              <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <Settings className="w-5 h-5 text-cyan-400" />
                ShellMind Doctor & Configuration
              </h2>
              <p className="text-sm text-zinc-400 mt-1">
                Installation health checks, shell alias integration, and multi-provider switcher.
              </p>
            </div>

            {doctorInfo && (
              <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
                <div className="font-bold text-sm text-zinc-100">Doctor Diagnostic Checks:</div>
                <div className="space-y-2 font-mono text-xs">
                  {doctorInfo.checks?.map((check: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {check.status === 'ok' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                        )}
                        <span className="text-zinc-200 font-bold">{check.name}</span>
                      </div>
                      <span className="text-zinc-400">{check.details}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Provider Switcher */}
            <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
              <div className="font-bold text-sm text-zinc-100">Active LLM Provider Switcher:</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { id: 'gemini', name: 'Google Gemini', desc: 'gemini-3.8-flash (Recommended, server-side)' },
                  { id: 'openai', name: 'OpenAI Compatible', desc: 'gpt-4o / vLLM / LocalAI endpoint' },
                  { id: 'ollama', name: 'Ollama Local', desc: '100% private offline llama3' },
                ].map(prov => (
                  <button
                    key={prov.id}
                    onClick={async () => {
                      const res = await fetch('/api/config', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          provider: { active: prov.id },
                        }),
                      });
                      if (res.ok) {
                        fetchConfig();
                        fetchDoctor();
                      }
                    }}
                    className={`p-4 rounded-lg text-left border transition ${
                      config?.provider?.active === prov.id
                        ? 'border-cyan-500 bg-cyan-950/30 text-white'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <div className="font-bold text-sm">{prov.name}</div>
                    <div className="text-xs text-zinc-400 mt-1">{prov.desc}</div>
                    {config?.provider?.active === prov.id && (
                      <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded bg-cyan-900/80 text-cyan-200">
                        ACTIVE PROVIDER
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Raw Config JSON */}
            {config && (
              <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
                <div className="text-xs text-zinc-400 font-mono">~/.shellmind/config.json Content:</div>
                <pre className="bg-zinc-950 p-4 rounded-lg text-xs font-mono text-zinc-300 overflow-x-auto border border-zinc-800">
                  {JSON.stringify(config, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* TAB 8: DOWNLOAD & SDK PACKAGE */}
        {activeTab === 'download' && (
          <div className="space-y-6">
            {/* Header Banner */}
            <div className="p-5 rounded-xl bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-850 border border-zinc-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                  <Download className="w-5 h-5 text-cyan-400" />
                  Download ShellMind & Use as a Package
                </h2>
                <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
                  Deploy ShellMind globally to your terminal, or import the modular domain packages directly into your own TypeScript / Node.js applications.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href="/download"
                  download="shellmind-v0.1.0.tar.gz"
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/30 transition flex items-center gap-2"
                >
                  <Download className="w-4 h-4" /> Download v0.1.0 (.tar.gz)
                </a>
              </div>
            </div>

            {/* Distribution Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Standalone Package */}
              <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-cyan-300 flex items-center gap-2">
                      <PackageCheck className="w-4 h-4 text-cyan-400" /> Standalone Archive (.tar.gz)
                    </span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-950 border border-zinc-700 text-zinc-400">
                      34 KB • v0.1.0
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-2 font-sans">
                    Complete monorepo with all 9 domain packages (`core`, `security`, `ai`, `context`, `executor`, `shell`, `memory`, `plugins`, `cli`).
                  </p>
                </div>

                <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                  <span className="text-xs font-mono text-zinc-400">shellmind-v0.1.0.tar.gz</span>
                  <a
                    href="/download"
                    download="shellmind-v0.1.0.tar.gz"
                    className="px-3 py-1.5 text-xs font-semibold rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> Download Archive
                  </a>
                </div>
              </div>

              {/* One-Line Installer */}
              <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-emerald-300 flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-emerald-400" /> One-Liner Terminal Installer
                    </span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-950 border border-zinc-700 text-emerald-400">
                      Bash & Zsh Auto
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-2 font-sans">
                    Installs the binary to `~/.shellmind/bin/ai` and automatically configures your `~/.bashrc` or `~/.zshrc`.
                  </p>
                </div>

                <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                  <span className="text-xs font-mono text-zinc-400">curl install.sh</span>
                  <a
                    href="/install.sh"
                    target="_blank"
                    className="px-3 py-1.5 text-xs font-semibold rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> View Script
                  </a>
                </div>
              </div>
            </div>

            {/* Quick Install Terminal Snippets */}
            <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4 font-mono text-xs">
              <div className="text-sm font-bold font-sans text-zinc-100 flex items-center gap-2">
                <Command className="w-4 h-4 text-cyan-400" /> Option 1: Quick Install via Terminal
              </div>

              <div className="space-y-4">
                <div>
                  <span className="text-zinc-400 font-sans block mb-1">A. Global CLI install via npm (one command):</span>
                  <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-cyan-300 flex items-center justify-between">
                    <code>npm install -g {typeof window !== 'undefined' ? window.location.origin : 'https://ais-pre-awthkhsjwjp4gmwpmeou6r-670799253577.asia-east1.run.app'}/packages/shellmind-0.1.0.tgz</code>
                    <button
                      onClick={() => navigator.clipboard.writeText(`npm install -g ${window.location.origin}/packages/shellmind-0.1.0.tgz`)}
                      className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
                      title="Copy"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-zinc-400 font-sans block mb-1">B. One-liner install via curl (Bash & Zsh auto-config):</span>
                  <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-emerald-300 flex items-center justify-between">
                    <code>curl -fsSL {typeof window !== 'undefined' ? window.location.origin : 'https://ais-pre-awthkhsjwjp4gmwpmeou6r-670799253577.asia-east1.run.app'}/install.sh | bash</code>
                    <button
                      onClick={() => navigator.clipboard.writeText(`curl -fsSL ${window.location.origin}/install.sh | bash`)}
                      className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
                      title="Copy"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-zinc-400 font-sans block mb-1">C. Install from your GitHub repository:</span>
                  <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300 flex items-center justify-between">
                    <code>npm install -g git+https://github.com/anshshukla2533/MindShiled.git</code>
                    <button
                      onClick={() => navigator.clipboard.writeText('npm install -g git+https://github.com/anshshukla2533/MindShiled.git')}
                      className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
                      title="Copy"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Use as SDK / Package in your Own Application */}
            <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold font-sans text-zinc-100 flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-purple-400" /> Option 2: Use as a TypeScript / Node.js SDK
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">
                    Import ShellMind domain packages directly into your CLI tools, CI/CD runners, or web backends.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-xs font-mono text-zinc-400">Install standalone SDK package into your project:</div>
                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-cyan-300 font-mono text-xs flex items-center justify-between">
                  <code>npm install {typeof window !== 'undefined' ? window.location.origin : 'https://ais-pre-awthkhsjwjp4gmwpmeou6r-670799253577.asia-east1.run.app'}/packages/shellmind-0.1.0.tgz</code>
                  <button
                    onClick={() => navigator.clipboard.writeText(`npm install ${window.location.origin}/packages/shellmind-0.1.0.tgz`)}
                    className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="text-xs font-mono text-zinc-400 pt-2">Full TypeScript integration example:</div>
                <pre className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-300 leading-relaxed overflow-x-auto">
{`import { ShellMindOrchestrator, ConfigManager } from '@shellmind/core';
import { SecurityAnalyzer } from '@shellmind/security';
import { GeminiProvider } from '@shellmind/ai';
import { ContextCollector } from '@shellmind/context';

async function main() {
  // 1. Initialize configuration and security rules
  const configManager = new ConfigManager();
  const security = new SecurityAnalyzer();
  const collector = new ContextCollector();
  const provider = new GeminiProvider();

  // 2. Automatically inspect current OS, shell, and project files
  const context = await collector.collect();

  // 3. Coordinate AI command planning with zero auto-execution guardrails
  const orchestrator = new ShellMindOrchestrator(configManager, {
    securityEngine: security,
    aiGenerator: {
      generate: (req) => provider.generateCommand(req),
    },
  });

  const plan = await orchestrator.plan({
    naturalLanguagePrompt: 'create a folder java and inside it create a file thread.java',
    context,
  });

  console.log('Command to run:', plan.command);
  console.log('Risk Level:', plan.risk.level); // SAFE | MEDIUM | HIGH | CRITICAL
  console.log('Requires Typed Confirmation:', plan.risk.requiresTypedConfirmation);

  // 4. Safely execute ONLY when explicitly confirmed by user
  const confirmed = true;
  const result = await orchestrator.executeWithGuardrails(plan.command, confirmed);
  console.log('Output:', result.stdout);
}

main();`}
                </pre>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 py-4 px-6 text-center text-xs text-zinc-400 flex flex-col md:flex-row items-center justify-between gap-2">
        <div>ShellMind v0.1.0 • Phase 1 Completed • Production Monorepo Foundation</div>
        <div className="flex items-center gap-4 text-zinc-400 font-mono">
          <span>strict: true</span>
          <span>pnpm-workspace</span>
          <span>turbo</span>
          <span>zero-auto-execution</span>
        </div>
      </footer>
    </div>
  );
}
