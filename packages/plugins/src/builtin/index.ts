/**
 * @license Apache-2.0
 * ShellMind Builtin Plugins
 * Git, Docker, Node, Python, AWS CLI, kubectl, Terraform
 */

import { ShellMindPlugin, ValidationIssue } from '../types.js';
import { SystemContext } from '@shellmind/core';

export const GitPlugin: ShellMindPlugin = {
  id: 'git',
  name: 'Git Version Control Plugin',
  description: 'Enriches branch state, validates against destructive force pushes and hard resets.',
  targetBinary: 'git',
  validateCommand(command: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (/git\s+push\s+.*(--force|-f)\b/.test(command)) {
      issues.push({
        severity: 'warning',
        message: 'Force-pushing may overwrite remote history for other contributors.',
        suggestedCorrection: 'Use --force-with-lease instead of -f to prevent overwriting unseen remote commits.',
      });
    }
    if (/git\s+reset\s+--hard\b/.test(command)) {
      issues.push({
        severity: 'warning',
        message: 'git reset --hard discards all uncommitted working directory changes permanently.',
        suggestedCorrection: 'Consider git stash before resetting.',
      });
    }
    return issues;
  },
  promptGuidance(): string {
    return 'For git commands, prefer modern subcommands (switch, restore) over overloaded checkout where appropriate.';
  },
};

export const DockerPlugin: ShellMindPlugin = {
  id: 'docker',
  name: 'Docker & Container Plugin',
  description: 'Inspects containers, validates volume removals and system prune commands.',
  targetBinary: 'docker',
  validateCommand(command: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (/docker\s+system\s+prune\s+.*(-a|--all|--volumes)/.test(command)) {
      issues.push({
        severity: 'warning',
        message: 'Pruning volumes will irreversibly destroy stateful database containers and named volumes.',
      });
    }
    return issues;
  },
  promptGuidance(): string {
    return 'For Docker, format port mappings as HOST:CONTAINER and recommend named volumes for persistence.';
  },
};

export const NodePlugin: ShellMindPlugin = {
  id: 'node',
  name: 'Node.js & Package Managers Plugin',
  description: 'Auto-detects package managers (pnpm, npm, yarn) from lockfiles.',
  targetBinary: 'node',
  validateCommand(command: string, context: SystemContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const hasPnpm = context.project?.manifestFiles?.some((f: string) => f.includes('pnpm'));
    if (hasPnpm && command.startsWith('npm install')) {
      issues.push({
        severity: 'warning',
        message: 'Project contains pnpm lockfile. Running npm install will generate conflicting lockfiles.',
        suggestedCorrection: command.replace('npm install', 'pnpm install'),
      });
    }
    return issues;
  },
  promptGuidance(): string {
    return 'Favor the detected package manager (pnpm > yarn > npm) based on existing lockfiles.';
  },
};

export const PythonPlugin: ShellMindPlugin = {
  id: 'python',
  name: 'Python & Virtualenv Plugin',
  description: 'Recommends modern uv/poetry/virtualenv commands and prevents polluting global site-packages.',
  targetBinary: 'python3',
  validateCommand(command: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (/pip\s+install\s+(?!-r|--user|-e)/.test(command) && !process.env.VIRTUAL_ENV) {
      issues.push({
        severity: 'warning',
        message: 'Running pip install outside a virtual environment may break system-managed packages (PEP 668).',
        suggestedCorrection: 'Use python3 -m venv .venv && source .venv/bin/activate before pip install.',
      });
    }
    return issues;
  },
};

export const AwsPlugin: ShellMindPlugin = {
  id: 'aws',
  name: 'AWS Cloud CLI Plugin',
  description: 'Guards against recursive S3 bucket deletions and unauthorized credential disclosure.',
  targetBinary: 'aws',
  validateCommand(command: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (/aws\s+s3\s+rb\s+.*--force/.test(command)) {
      issues.push({
        severity: 'warning',
        message: 'aws s3 rb --force deletes an entire S3 bucket and all stored objects permanently.',
      });
    }
    return issues;
  },
};

export const KubectlPlugin: ShellMindPlugin = {
  id: 'kubectl',
  name: 'Kubernetes Cluster Plugin',
  description: 'Prevents accidental deletions against production namespaces.',
  targetBinary: 'kubectl',
  validateCommand(command: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (/kubectl\s+delete\s+(ns|namespace|all)\b/.test(command)) {
      issues.push({
        severity: 'warning',
        message: 'Deleting Kubernetes namespaces terminates all pods, ingress, and PV claims within it.',
      });
    }
    return issues;
  },
};

export const TerraformPlugin: ShellMindPlugin = {
  id: 'terraform',
  name: 'Terraform Infrastructure Plugin',
  description: 'Flags terraform destroy and state modification commands.',
  targetBinary: 'terraform',
  validateCommand(command: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (/terraform\s+destroy\b/.test(command)) {
      issues.push({
        severity: 'warning',
        message: 'terraform destroy will tear down all provisioned cloud infrastructure.',
        suggestedCorrection: 'Use terraform plan -destroy first to preview infrastructure removals.',
      });
    }
    return issues;
  },
};

export const BUILTIN_PLUGINS: ShellMindPlugin[] = [
  GitPlugin,
  DockerPlugin,
  NodePlugin,
  PythonPlugin,
  AwsPlugin,
  KubectlPlugin,
  TerraformPlugin,
];
