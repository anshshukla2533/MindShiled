#!/usr/bin/env bash
# @license Apache-2.0
# ShellMind AI Terminal Copilot Installer
set -e

INSTALL_DIR="${HOME}/.shellmind/bin"
CONFIG_DIR="${HOME}/.shellmind"
mkdir -p "${INSTALL_DIR}"
mkdir -p "${CONFIG_DIR}"

echo -e "\033[36m=================================================\033[0m"
echo -e "\033[36m   ShellMind AI Terminal Copilot Installer       \033[0m"
echo -e "\033[36m=================================================\033[0m"

# Check Node.js runtime
if ! command -v node >/dev/null 2>&1; then
  echo -e "\033[31m✖ Error: Node.js (>= 20.0.0) is required to run ShellMind.\033[0m"
  echo "Please install Node.js from https://nodejs.org and re-run this installer."
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo -e "\033[33m⚠ Warning: Node.js version $NODE_VERSION detected. Version 20 or higher is recommended.\033[0m"
fi

echo -e "\033[32m✔ Node.js runtime $(node -v) detected.\033[0m"

# Install or link ShellMind binary
cat << 'EOF' > "${INSTALL_DIR}/ai"
#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

// Determine command
const args = process.argv.slice(2);
console.log('\x1b[36m●\x1b[0m ShellMind Terminal Copilot active');
EOF
chmod +x "${INSTALL_DIR}/ai"
ln -sf "${INSTALL_DIR}/ai" "${INSTALL_DIR}/shellmind"

# Update PATH in shell profile
DETECTED_PROFILE=""
if [ -n "$ZSH_VERSION" ] || [ -f "$HOME/.zshrc" ]; then
  DETECTED_PROFILE="$HOME/.zshrc"
elif [ -n "$BASH_VERSION" ] || [ -f "$HOME/.bashrc" ]; then
  DETECTED_PROFILE="$HOME/.bashrc"
fi

if [ -n "$DETECTED_PROFILE" ]; then
  if ! grep -q "SHELLMIND_HOME" "$DETECTED_PROFILE" 2>/dev/null; then
    echo "" >> "$DETECTED_PROFILE"
    echo "# >>> ShellMind Terminal Copilot >>>" >> "$DETECTED_PROFILE"
    echo "export PATH=\"${INSTALL_DIR}:\$PATH\"" >> "$DETECTED_PROFILE"
    echo "alias ai=\"${INSTALL_DIR}/ai\"" >> "$DETECTED_PROFILE"
    echo "# <<< ShellMind Terminal Copilot <<<" >> "$DETECTED_PROFILE"
    echo -e "\033[32m✔ Added ShellMind to ${DETECTED_PROFILE}\033[0m"
  else
    echo -e "\033[32m✔ ShellMind is already configured in ${DETECTED_PROFILE}\033[0m"
  fi
fi

echo ""
echo -e "\033[32m✔ Installation complete!\033[0m"
echo -e "Run: \033[1mexport PATH=\"${INSTALL_DIR}:\$PATH\"\033[0m or restart your terminal."
echo -e "Try it: \033[36mai \"find every pdf larger than 20MB\"\033[0m"
