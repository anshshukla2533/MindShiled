/**
 * @license Apache-2.0
 * ShellMind Terminal Color & Style Helpers (ANSI escape sequences)
 */

export const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',

  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',

  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
};

export function badge(text: string, level: 'SAFE' | 'MEDIUM' | 'HIGH' | 'CRITICAL'): string {
  switch (level) {
    case 'SAFE':
      return `${colors.bgGreen}${colors.black}${colors.bold} SAFE ${colors.reset}`;
    case 'MEDIUM':
      return `${colors.bgYellow}${colors.black}${colors.bold} MEDIUM ${colors.reset}`;
    case 'HIGH':
      return `${colors.bgMagenta}${colors.white}${colors.bold} HIGH ${colors.reset}`;
    case 'CRITICAL':
      return `${colors.bgRed}${colors.white}${colors.bold} CRITICAL ${colors.reset}`;
  }
}

export function formatCommandCard(command: string, explanation: string, level: 'SAFE' | 'MEDIUM' | 'HIGH' | 'CRITICAL'): string {
  return `
${colors.cyan}╭── ShellMind Generated Command ─────────────────────────────────╮${colors.reset}
  ${colors.bold}${colors.green}$ ${command}${colors.reset}

  ${colors.dim}Explanation:${colors.reset} ${explanation}
  ${colors.dim}Risk Level:${colors.reset}  ${badge(level, level)}
${colors.cyan}╰────────────────────────────────────────────────────────────────╯${colors.reset}
`;
}
