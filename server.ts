/**
 * @license Apache-2.0
 * ShellMind Server Entrypoint
 * Full-stack Express server bridging AI Studio, Vite dev middlewares, and ShellMind core packages.
 */

import { spawn } from 'node:child_process';

// Auto-bootstrap TSX loader if executed directly via raw 'node server.ts'
if (typeof process !== 'undefined' && !process.execArgv.some(a => a.includes('tsx')) && !process.env._SHELLMIND_TSX_ACTIVE) {
  const child = spawn(process.execPath, ['--import', 'tsx', ...process.argv.slice(1)], {
    stdio: 'inherit',
    env: { ...process.env, _SHELLMIND_TSX_ACTIVE: '1' },
  });
  child.on('exit', (code) => process.exit(code || 0));
} else {
  // Main server execution under tsx loader
  runMainServer();
}

async function runMainServer() {
  const express = (await import('express')).default;
  const dotenv = (await import('dotenv')).default;
  const path = (await import('path')).default;
  const { fileURLToPath } = await import('url');
  const { createServer: createViteServer } = await import('vite');

  const { ConfigManager, ShellMindOrchestrator } = await import('./packages/core/src/index.js');
  const { SecurityAnalyzer } = await import('./packages/security/src/index.js');
  const { ContextCollector } = await import('./packages/context/src/index.js');
  const { AIProviderFactory } = await import('./packages/ai/src/factory.js');
  const { ProcessExecutor } = await import('./packages/executor/src/index.js');
  const { PluginRegistry } = await import('./packages/plugins/src/index.js');
  const { MemoryStore } = await import('./packages/memory/src/index.js');
  const { ShellDetector, ShellInstaller } = await import('./packages/shell/src/index.js');
  const { DoctorCommand } = await import('./packages/cli/src/commands/doctor.js');
  const { runPhase1Tests } = await import('./scripts/test-phase1.js');

  dotenv.config();

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Services
  const configManager = new ConfigManager();
  const securityAnalyzer = new SecurityAnalyzer();
  const executor = new ProcessExecutor();
  const pluginRegistry = new PluginRegistry();
  const memoryStore = new MemoryStore();
  const contextCollector = new ContextCollector();

  // 1. Get Live Environment Context
  app.get('/api/context', async (_req, res) => {
    try {
      const context = await contextCollector.collect();
      res.json(context);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Generate Command from Natural Language
  app.post('/api/ai/generate', async (req, res) => {
    try {
      const { prompt, preferredShell } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const context = await contextCollector.collect();
      const config = configManager.getConfig();
      const provider = AIProviderFactory.create(config);

      const orchestrator = new ShellMindOrchestrator(configManager, {
        securityEngine: securityAnalyzer,
        aiGenerator: {
          generate: req => provider.generateCommand(req),
        },
        executionEngine: executor,
      });

      const plan = await orchestrator.plan({
        naturalLanguagePrompt: prompt,
        context,
        preferredShell,
      });

      // Also validate with plugins
      const pluginIssues = pluginRegistry.validateCommand(plan.command, context);

      // Record to history memory
      memoryStore.recordCommand({
        prompt,
        command: plan.command,
        directory: context.currentDirectory,
        riskLevel: plan.risk.level,
        executed: false,
      });

      res.json({
        plan,
        pluginIssues,
      });
    } catch (err: any) {
      console.error('Error generating command:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Explain Command
  app.post('/api/ai/explain', async (req, res) => {
    try {
      const { command } = req.body;
      if (!command) {
        return res.status(400).json({ error: 'Command is required' });
      }

      const context = await contextCollector.collect();
      const config = configManager.getConfig();
      const provider = AIProviderFactory.create(config);

      const explanation = await provider.explainCommand(command, context);
      res.json(explanation);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Diagnose Command Error
  app.post('/api/ai/diagnose', async (req, res) => {
    try {
      const { failedCommand, stderr } = req.body;
      const context = await contextCollector.collect();
      const config = configManager.getConfig();
      const provider = AIProviderFactory.create(config);

      const diagnosis = await provider.diagnoseError(failedCommand, stderr || '', context);
      res.json(diagnosis);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. Evaluate Security of Any Command
  app.post('/api/security/evaluate', (req, res) => {
    try {
      const { command } = req.body;
      const assessment = securityAnalyzer.analyze(command || '');
      res.json(assessment);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6. Doctor System Diagnostics
  app.get('/api/doctor', async (_req, res) => {
    try {
      const checks = await DoctorCommand.run();
      const shell = ShellDetector.detect();
      const profile = ShellInstaller.getProfileInfo();

      res.json({
        checks,
        shell,
        profile,
        activeProvider: configManager.getConfig().provider.active,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7. Config Management
  app.get('/api/config', (_req, res) => {
    res.json(configManager.getConfig());
  });

  app.post('/api/config', (req, res) => {
    try {
      const updated = configManager.updateConfig(req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 8. Plugins
  app.get('/api/plugins', (_req, res) => {
    res.json(pluginRegistry.getAll());
  });

  // 9. Memory & History
  app.get('/api/memory', (_req, res) => {
    res.json({
      history: memoryStore.getHistory(30),
      workflows: memoryStore.getWorkflows(),
      aliases: memoryStore.getAliases(),
    });
  });

  // 10. Run Phase 1 Tests
  app.get('/api/tests/run', async (_req, res) => {
    try {
      const results = await runPhase1Tests();
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 11. Execute Command with Guardrails
  app.post('/api/execute', async (req, res) => {
    try {
      const { command, confirmed, typedConfirmationToken } = req.body;
      const orchestrator = new ShellMindOrchestrator(configManager, {
        securityEngine: securityAnalyzer,
        executionEngine: executor,
      });

      const result = await orchestrator.executeWithGuardrails(
        command,
        confirmed,
        typedConfirmationToken
      );

      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 12. Download Standalone Package (.tar.gz)
  app.get(['/download', '/api/download/package', '/download/shellmind.tar.gz'], (_req, res) => {
    const archivePath = path.resolve(__dirname, 'public', 'shellmind-v0.1.0.tar.gz');
    res.download(archivePath, 'shellmind-v0.1.0.tar.gz', (err) => {
      if (err) {
        console.error('Download error:', err);
      }
    });
  });

  // 13. One-Liner Install Script
  app.get(['/install.sh', '/api/install.sh'], (_req, res) => {
    const scriptPath = path.resolve(__dirname, 'public', 'install.sh');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.sendFile(scriptPath);
  });

  // 14. Direct NPM Release Tarball
  app.get(['/download/shellmind-ai.tgz', '/download/shellmind-ai-0.1.0.tgz'], (_req, res) => {
    const archivePath = path.resolve(__dirname, 'public', 'packages', 'shellmind-ai-0.1.0.tgz');
    res.download(archivePath, 'shellmind-ai-0.1.0.tgz');
  });

  // Serve Vite in development or static dist in production
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 ShellMind Server running on http://0.0.0.0:${PORT}`);
  });
}
