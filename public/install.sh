#!/usr/bin/env bash
# @license Apache-2.0
# ShellMind AI Terminal Copilot — Automatic Terminal Installer
set -e

BASE_URL="https://ais-pre-awthkhsjwjp4gmwpmeou6r-670799253577.asia-east1.run.app"
INSTALL_DIR="${HOME}/.shellmind/bin"
PREFIX_DIR="${HOME}/.shellmind"
mkdir -p "${INSTALL_DIR}"
mkdir -p "${PREFIX_DIR}"

echo -e "\033[36m=================================================\033[0m"
echo -e "\033[36m   ShellMind AI Terminal Copilot Installer       \033[0m"
echo -e "\033[36m=================================================\033[0m"

# 1. Check Node.js runtime
if ! command -v node >/dev/null 2>&1; then
  echo -e "\033[31m✖ Error: Node.js (>= 20.0.0) is required.\033[0m"
  echo "Please install Node.js from https://nodejs.org and re-run."
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
echo -e "\033[32m✔ Node.js runtime $(node -v) detected.\033[0m"

# 2. Check npm
if ! command -v npm >/dev/null 2>&1; then
  echo -e "\033[31m✖ Error: npm is required to install packages.\033[0m"
  exit 1
fi

echo -e "\033[34m⬇ Downloading and installing ShellMind package bundle...\033[0m"
npm install --silent --no-audit --no-fund --prefix "${PREFIX_DIR}" "${BASE_URL}/packages/shellmind-0.1.0.tgz"

# Symlink binaries
ln -sf "${PREFIX_DIR}/node_modules/.bin/ai" "${INSTALL_DIR}/ai"
ln -sf "${PREFIX_DIR}/node_modules/.bin/shellmind" "${INSTALL_DIR}/shellmind"

# 3. Configure Shell Profile PATH
DETECTED_PROFILE=""
if [ -n "$ZSH_VERSION" ] || [ -f "$HOME/.zshrc" ]; then
  DETECTED_PROFILE="$HOME/.zshrc"
elif [ -n "$BASH_VERSION" ] || [ -f "$HOME/.bashrc" ]; then
  DETECTED_PROFILE="$HOME/.bashrc"
fi

if [ -n "$DETECTED_PROFILE" ]; then
  if ! grep -q "SHELLMIND_HOME" "$DETECTED_PROFILE" 2>/dev/null; then
    echo "" >> "$DETECTED_PROFILE"
    echo "# >>> ShellMind Terminal Copilot (SHELLMIND_HOME) >>>" >> "$DETECTED_PROFILE"
    echo "export PATH=\"${INSTALL_DIR}:\$PATH\"" >> "$DETECTED_PROFILE"
    echo "# <<< ShellMind Terminal Copilot <<<" >> "$DETECTED_PROFILE"
    echo -e "\033[32m✔ Added ${INSTALL_DIR} to ${DETECTED_PROFILE}\033[0m"
  fi
fi

echo ""
echo -e "\033[32m=================================================\033[0m"
echo -e "\033[32m✔ ShellMind Copilot installed successfully!\033[0m"
echo -e "\033[32m=================================================\033[0m"
echo -e "To activate in this terminal session, run:"
echo -e "   \033[1;36mexport PATH=\"${INSTALL_DIR}:\$PATH\"\033[0m"
echo ""
echo -e "Try it right now:"
echo -e "   \033[1;33mai doctor\033[0m"
echo -e "   \033[1;33mai \"create a folder java and inside it create a file thread.java\"\033[0m"
echo -e "   \033[1;33mai explain \"chmod 755\"\033[0m"
echo ""
