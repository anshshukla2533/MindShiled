/**
 * @license Apache-2.0
 * ShellMind Shell Autocompletions Generator
 */

import { ShellType } from '@shellmind/core';

export class CompletionGenerator {
  public static generate(shell: ShellType): string {
    switch (shell) {
      case 'bash':
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

      case 'zsh':
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

      case 'fish':
        return `
# ShellMind Fish Autocompletion
complete -c ai -f -a "explain run config provider login history version doctor install update" -d "ShellMind AI Commands"
complete -c shellmind -f -a "explain run config provider login history version doctor install update" -d "ShellMind AI Commands"
`;

      case 'powershell':
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
        return '';
    }
  }
}
