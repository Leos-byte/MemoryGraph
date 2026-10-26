#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

install=false
if [[ "${1:-}" == "--install" ]]; then
  install=true
fi

missing=()
for cmd in cmake ninja g++; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    missing+=("$cmd")
  fi
done

qt_tool_found=false
if command -v qtpaths6 >/dev/null 2>&1 || command -v qtpaths >/dev/null 2>&1 || command -v qmake6 >/dev/null 2>&1 || command -v qmake >/dev/null 2>&1; then
  qt_tool_found=true
fi

if [[ ${#missing[@]} -eq 0 && "$qt_tool_found" == true ]]; then
  echo "MemGraph development tools appear to be installed."
  exit 0
fi

echo "MemGraph development environment is incomplete."
if [[ ${#missing[@]} -gt 0 ]]; then
  echo "Missing commands: ${missing[*]}"
fi
if [[ "$qt_tool_found" != true ]]; then
  echo "Missing Qt tools: qtpaths/qmake not found."
fi

if [[ -f /etc/os-release ]]; then
  # shellcheck disable=SC1091
  source /etc/os-release
else
  ID="unknown"
fi

if [[ "$ID" == "fedora" ]]; then
  packages=(
    gcc-c++
    cmake
    ninja-build
    qt6-qtbase-devel
    qt6-qttools-devel
    qt6-qttranslations
    sqlite-devel
    libsecret
    podman
    patchelf
    tar
    gzip
  )

  echo
  echo "Fedora detected. Install x64 dependencies with:"
  echo "  sudo dnf install -y ${packages[*]}"
  echo
  echo "Strict 32-bit i686 Qt builds should use the isolated Podman workflow."
  echo "The default x86 container image is docker.io/i386/debian:trixie because Fedora 43 does not publish a 386 image:"
  echo "  $ROOT_DIR/DevScripts/build_x86_podman.sh --package portable"
  echo
  echo "Do not install qt6-qtbase-devel.i686 alongside qt6-qtbase-devel.x86_64 on Fedora 43."
  echo "Those packages conflict on /usr/bin/qt-configure-module."
  echo

  if [[ "$install" == true ]]; then
    echo "Installing x64 dependencies through dnf..."
    sudo dnf install -y "${packages[@]}"
  else
    echo "Run '$ROOT_DIR/DevScripts/setup_env.sh --install' to install the x64 dependency set."
  fi
else
  echo
  echo "Unsupported distribution for automatic package suggestions: ${ID:-unknown}"
  echo "Install a C++17 compiler, CMake, Ninja, Qt Widgets/Network/Sql/LinguistTools, SQLite development headers, tar, and gzip."
fi
