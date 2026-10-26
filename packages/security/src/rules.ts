/**
 * @license Apache-2.0
 * ShellMind Security Rules & Pattern Definitions
 */

import { SecurityRule } from './types.js';

export const BUILTIN_SECURITY_RULES: SecurityRule[] = [
  // --- CRITICAL RULES (Mandatory typed confirmation) ---
  {
    id: 'SEC-CRIT-ROOT-RM',
    name: 'Root/System Directory Recursive Deletion',
    pattern: /\b(sudo\s+)?rm\s+.*(-[a-zA-Z]*r[a-zA-Z]*f?|-[a-zA-Z]*f[a-zA-Z]*r?|--recursive)\s+(\/|\/\*|~|\$HOME|\/etc|\/boot|\/var|\/usr|\/bin)(\s|$)/i,
    level: 'CRITICAL',
    reason: 'Attempts recursive deletion of root or vital operating system directories.',
    requiresTypedConfirmation: true,
  },
  {
    id: 'SEC-CRIT-MKFS',
    name: 'Filesystem Format (mkfs)',
    pattern: /\b(mkfs(\.[a-z0-9]+)?|format\s+[a-z]:)\b/i,
    level: 'CRITICAL',
    reason: 'Formats a storage device or filesystem, completely wiping existing partitions.',
    requiresTypedConfirmation: true,
  },
  {
    id: 'SEC-CRIT-DD-RAW',
    name: 'Raw Disk Write (dd of=/dev)',
    pattern: /\bdd\s+.*of=\/dev\/(sd[a-z]|nvme[0-9]n[0-9]|hd[a-z]|disk[0-9])/i,
    level: 'CRITICAL',
    reason: 'Direct low-level block write directly to physical disk device.',
    requiresTypedConfirmation: true,
  },
  {
    id: 'SEC-CRIT-FORKBOMB',
    name: 'Shell Fork Bomb',
    pattern: /:\(\)\s*\{\s*:\|:&\s*\}\s*;\s*:/,
    level: 'CRITICAL',
    reason: 'Classic recursive fork bomb causing kernel starvation and system freeze.',
    requiresTypedConfirmation: true,
  },
  {
    id: 'SEC-CRIT-REMOTE-PIPE-EXEC',
    name: 'Remote Code Pipeline Ingestion (curl | sh)',
    pattern: /\b(curl|wget)\b.*\|\s*(sudo\s+)?(ba|z|fi)?sh\b/i,
    level: 'CRITICAL',
    reason: 'Directly executes unverified remote script directly into root or user shell.',
    requiresTypedConfirmation: true,
  },
  {
    id: 'SEC-CRIT-RAW-DEV-REDIRECT',
    name: 'Redirection to Raw Device',
    pattern: />\s*\/dev\/(sda|sdb|nvme|kmem|mem|port)/i,
    level: 'CRITICAL',
    reason: 'Overwrites raw hardware memory or storage block devices.',
    requiresTypedConfirmation: true,
  },

  // --- HIGH RULES (Explicit prompt & caution) ---
  {
    id: 'SEC-HIGH-CHMOD-777',
    name: 'Insecure Permissive Permissions (chmod 777)',
    pattern: /\bchmod\s+(-[a-zA-Z]*R[a-zA-Z]*\s+)?(777|a\+[rwx]{3})\b/i,
    level: 'HIGH',
    reason: 'Grants universal read, write, and execute permissions to all users on the host.',
  },
  {
    id: 'SEC-HIGH-GIT-RESET-HARD',
    name: 'Destructive Git Hard Reset',
    pattern: /\bgit\s+reset\s+--hard\b/i,
    level: 'HIGH',
    reason: 'Discards uncommitted working tree and staging area changes permanently.',
  },
  {
    id: 'SEC-HIGH-GIT-PUSH-FORCE',
    name: 'Force Git Push',
    pattern: /\bgit\s+push\s+.*(--force|-f)\b/i,
    level: 'HIGH',
    reason: 'Overwrites remote Git history, potentially erasing teammates commits.',
  },
  {
    id: 'SEC-HIGH-RM-RECURSIVE',
    name: 'Recursive File Removal',
    pattern: /\brm\s+-[a-zA-Z]*r/i,
    level: 'HIGH',
    reason: 'Recursively deletes directory contents from the filesystem.',
  },
  {
    id: 'SEC-HIGH-DOCKER-PRUNE-ALL',
    name: 'Docker System Prune Volumes',
    pattern: /\bdocker\s+system\s+prune\s+.*--volumes/i,
    level: 'HIGH',
    reason: 'Removes all unused Docker containers, networks, images, and data volumes.',
  },
  {
    id: 'SEC-HIGH-KILL-ALL',
    name: 'Mass Process Termination',
    pattern: /\b(killall|pkill)\s+(-9\s+)?/i,
    level: 'HIGH',
    reason: 'Terminates active running system processes matching target pattern.',
  },

  // --- MEDIUM RULES (Modification of state) ---
  {
    id: 'SEC-MED-DOCKER-DOWN',
    name: 'Docker Compose Down',
    pattern: /\bdocker\s+compose\s+down\b/i,
    level: 'MEDIUM',
    reason: 'Stops and removes running containers, networks, and configured services.',
  },
  {
    id: 'SEC-MED-PKG-GLOBAL-INSTALL',
    name: 'Global Package Installation',
    pattern: /\b(npm|yarn|pnpm)\s+(install|add|i)\s+(-g|--global)\b/i,
    level: 'MEDIUM',
    reason: 'Installs global executable packages affecting the global system environment.',
  },
  {
    id: 'SEC-MED-GIT-CHECKOUT-DISCARD',
    name: 'Git Checkout File Discard',
    pattern: /\bgit\s+checkout\s+--\s+/i,
    level: 'MEDIUM',
    reason: 'Discards uncommitted modifications to selected local working files.',
  },
  {
    id: 'SEC-MED-FILE-OVERWRITE',
    name: 'Output File Overwrite Redirection',
    pattern: /(?<!>|&)>\s*[^\s&|]+/i,
    level: 'MEDIUM',
    reason: 'Overwrites target destination file contents.',
  },

  // --- SAFE RULES (Read-only / inspection) ---
  {
    id: 'SEC-SAFE-QUERY',
    name: 'Read-only System Inspection',
    pattern: /^\s*(ls|pwd|cat|head|tail|find|grep|stat|which|whoami|date|df|du|uname|git\s+(status|diff|log|branch|show)|docker\s+ps)\b/i,
    level: 'SAFE',
    reason: 'Read-only query that inspects files or system status without modifying state.',
  },
];
