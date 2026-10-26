/**
 * @license Apache-2.0
 * ShellMind Context Collector
 * Automatically gathers OS, Shell, Git, project indicators, and toolchain info.
 */

import { SystemContext, ShellType } from '@shellmind/core';
import { ContextCollectorOptions } from './types.js';

export class ContextCollector {
  private options: ContextCollectorOptions;
  private static cachedContext: SystemContext | null = null;
  private static lastCollectTime: number = 0;

  constructor(options: ContextCollectorOptions = {}) {
    this.options = {
      cwd: options.cwd || (typeof process !== 'undefined' ? process.cwd() : '/workspace'),
      maxFilesScanned: options.maxFilesScanned || 50,
      skipGit: options.skipGit || false,
    };
  }

  public async collect(): Promise<SystemContext> {
    const now = Date.now();
    if (ContextCollector.cachedContext && now - ContextCollector.lastCollectTime < 10000) {
      return ContextCollector.cachedContext;
    }

    const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

    if (!isNode) {
      return this.collectBrowserFallback();
    }

    try {
      const os = await import('node:os');
      const fs = await import('node:fs');
      const path = await import('node:path');
      const cp = await import('node:child_process');

      const cwd = this.options.cwd || process.cwd();
      const shell = this.detectActiveShell();

      // Project manifest indicator scan
      const candidateFiles = [
        'package.json',
        'Dockerfile',
        'docker-compose.yml',
        'docker-compose.yaml',
        'requirements.txt',
        'Cargo.toml',
        'go.mod',
        'pom.xml',
        'Makefile',
        '.gitignore',
      ];

      const foundManifests: string[] = [];
      let packageJsonContent: any = undefined;

      for (const file of candidateFiles) {
        try {
          const filePath = path.join(cwd, file);
          if (fs.existsSync(filePath)) {
            foundManifests.push(file);
            if (file === 'package.json') {
              try {
                packageJsonContent = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
              } catch {
                // ignore json error
              }
            }
          }
        } catch {
          // ignore fs check error
        }
      }

      // Git inspection
      let gitInfo: SystemContext['git'] = { isRepo: false };
      if (!this.options.skipGit) {
        try {
          const gitDir = path.join(cwd, '.git');
          if (fs.existsSync(gitDir)) {
            const branch = cp.execSync('git rev-parse --abbrev-ref HEAD 2>/dev/null', {
              cwd,
              encoding: 'utf-8',
              timeout: 1000,
            }).trim();

            const status = cp.execSync('git status --porcelain 2>/dev/null', {
              cwd,
              encoding: 'utf-8',
              timeout: 1000,
            }).trim();

            gitInfo = {
              isRepo: true,
              branch: branch || 'main',
              statusSummary: status ? `${status.split('\n').length} modified files` : 'clean',
            };
          }
        } catch {
          // git command failed or not a repo
        }
      }

      // Check installed tools
      const tools: SystemContext['tools'] = {
        node: process.version,
      };

      const toolBinaries = ['git', 'docker', 'python3', 'pnpm', 'aws', 'kubectl', 'terraform'];
      for (const tool of toolBinaries) {
        try {
          const out = cp.execSync(`${tool} --version 2>/dev/null`, {
            encoding: 'utf-8',
            timeout: 500,
          }).trim();
          if (out) {
            (tools as any)[tool] = out.split('\n')[0]?.substring(0, 40);
          }
        } catch {
          // tool not installed or timed out
        }
      }

      const collected: SystemContext = {
        os: {
          platform: os.platform(),
          release: os.release(),
          arch: os.arch(),
          type: os.type(),
        },
        shell,
        currentDirectory: cwd,
        user: os.userInfo?.()?.username || process.env.USER || 'developer',
        git: gitInfo,
        project: {
          type: foundManifests.length > 0 ? foundManifests[0].split('.')[0] : 'general',
          manifestFiles: foundManifests,
          hasDockerfile: foundManifests.includes('Dockerfile'),
          hasDockerCompose: foundManifests.some(f => f.startsWith('docker-compose')),
          packageJson: packageJsonContent
            ? {
                name: packageJsonContent.name,
                scripts: packageJsonContent.scripts,
                dependencies: packageJsonContent.dependencies,
              }
            : undefined,
        },
        tools,
      };

      ContextCollector.cachedContext = collected;
      ContextCollector.lastCollectTime = Date.now();
      return collected;
    } catch (err) {
      console.warn('[ShellMind ContextCollector error, falling back]:', err);
      return this.collectBrowserFallback();
    }
  }

  private detectActiveShell(): ShellType {
    if (typeof process === 'undefined') return 'unknown';

    if (process.platform === 'win32') {
      if (process.env.PSModulePath) return 'powershell';
      return 'cmd';
    }

    const shellEnv = process.env.SHELL || '';
    if (shellEnv.includes('zsh')) return 'zsh';
    if (shellEnv.includes('fish')) return 'fish';
    if (shellEnv.includes('bash')) return 'bash';

    return 'bash';
  }

  private collectBrowserFallback(): SystemContext {
    return {
      os: {
        platform: 'linux',
        release: '6.6.0-x86_64',
        arch: 'x64',
        type: 'Linux',
      },
      shell: 'zsh',
      currentDirectory: '/workspace/shellmind',
      user: 'developer',
      git: {
        isRepo: true,
        branch: 'main',
        statusSummary: 'clean',
        remoteOrigin: 'github.com/shellmind/shellmind',
      },
      project: {
        type: 'node',
        manifestFiles: ['package.json', 'Dockerfile', 'docker-compose.yml'],
        hasDockerfile: true,
        hasDockerCompose: true,
        packageJson: {
          name: 'shellmind',
          scripts: {
            build: 'turbo run build',
            test: 'turbo run test',
          },
        },
      },
      tools: {
        node: 'v22.14.0',
        git: 'git version 2.44.0',
        docker: 'Docker version 26.1.1',
        pnpm: '9.1.0',
        python: 'Python 3.12.3',
        kubectl: 'v1.30.0',
        aws: 'aws-cli/2.15.30',
        terraform: 'Terraform v1.8.2',
      },
    };
  }
}
