#!/usr/bin/env bash
#
# garu-cli installer
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Garu-Pagamentos/garu-cli/main/install.sh | bash
#
# Environment overrides:
#   GARU_CLI_VERSION  Pin a specific version (default: latest)
#   GARU_CLI_DIR      Install directory (default: /usr/local/bin, fallback $HOME/.local/bin)

set -euo pipefail

REPO="Garu-Pagamentos/garu-cli"
BINARY_NAME="garu"

# ── platform detection ─────────────────────────────────────────────────────────
detect_platform() {
  local os arch
  case "$(uname -s)" in
    Darwin) os="darwin" ;;
    Linux)  os="linux" ;;
    *) fail "Unsupported OS: $(uname -s). Use 'npm install -g @garuhq/cli' instead." ;;
  esac
  case "$(uname -m)" in
    arm64|aarch64) arch="arm64" ;;
    x86_64|amd64)  arch="x64" ;;
    *) fail "Unsupported architecture: $(uname -m)" ;;
  esac
  # darwin-x64 is built but not the default download — we have darwin-arm64 and linux-x64 in the release matrix.
  if [[ "$os" == "darwin" && "$arch" == "x64" ]]; then
    echo "darwin-x64"
  elif [[ "$os" == "darwin" && "$arch" == "arm64" ]]; then
    echo "darwin-arm64"
  elif [[ "$os" == "linux" && "$arch" == "x64" ]]; then
    echo "linux-x64"
  else
    fail "No prebuilt binary for ${os}-${arch}. Use 'npm install -g @garuhq/cli' instead."
  fi
}

# ── install dir ────────────────────────────────────────────────────────────────
resolve_install_dir() {
  if [[ -n "${GARU_CLI_DIR:-}" ]]; then
    echo "$GARU_CLI_DIR"
    return
  fi
  if [[ -w /usr/local/bin ]]; then
    echo "/usr/local/bin"
  else
    mkdir -p "$HOME/.local/bin"
    echo "$HOME/.local/bin"
  fi
}

# ── helpers ────────────────────────────────────────────────────────────────────
fail() {
  printf '\033[31mError:\033[0m %s\n' "$*" >&2
  exit 1
}

info() {
  printf '\033[36m→\033[0m %s\n' "$*"
}

success() {
  printf '\033[32m✓\033[0m %s\n' "$*"
}

resolve_version() {
  if [[ -n "${GARU_CLI_VERSION:-}" ]]; then
    echo "$GARU_CLI_VERSION"
    return
  fi
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
      | grep -m1 '"tag_name"' \
      | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/'
  else
    fail "curl is required to resolve the latest version. Install curl or pin GARU_CLI_VERSION."
  fi
}

# ── main ───────────────────────────────────────────────────────────────────────
main() {
  local platform version install_dir url tmp_file

  platform="$(detect_platform)"
  version="$(resolve_version)"
  install_dir="$(resolve_install_dir)"

  [[ -z "$version" ]] && fail "Could not resolve the latest release tag."

  url="https://github.com/${REPO}/releases/download/${version}/${BINARY_NAME}-${platform}"

  info "Installing ${BINARY_NAME} ${version} (${platform}) → ${install_dir}/${BINARY_NAME}"

  tmp_file="$(mktemp)"
  trap 'rm -f "$tmp_file"' EXIT

  if ! curl -fsSL --output "$tmp_file" "$url"; then
    fail "Failed to download ${url}"
  fi

  chmod +x "$tmp_file"

  if [[ -w "$install_dir" ]]; then
    mv "$tmp_file" "${install_dir}/${BINARY_NAME}"
  elif command -v sudo >/dev/null 2>&1; then
    info "Elevating with sudo to write ${install_dir}/${BINARY_NAME}"
    sudo mv "$tmp_file" "${install_dir}/${BINARY_NAME}"
  else
    fail "${install_dir} is not writable and sudo is not available. Set GARU_CLI_DIR=\$HOME/.local/bin and retry."
  fi

  success "Installed ${BINARY_NAME} ${version} to ${install_dir}/${BINARY_NAME}"

  if ! echo ":${PATH}:" | grep -q ":${install_dir}:"; then
    printf '\033[33m⚠\033[0m  %s is not on your PATH.\n' "$install_dir"
    printf '    Add this to your shell profile:\n'
    printf '        export PATH="%s:$PATH"\n' "$install_dir"
  fi

  printf '\nRun \033[1m%s doctor\033[0m to verify.\n' "$BINARY_NAME"
}

main "$@"
