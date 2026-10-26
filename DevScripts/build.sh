#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="$ROOT_DIR/Source"
RELEASES_DIR="$ROOT_DIR/Releases"
VERSION="0.1.0"

arch="x64"
build_type="Release"
package_kind="portable"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --arch)
      arch="${2:?missing value for --arch}"
      shift 2
      ;;
    --type)
      build_type="${2:?missing value for --type}"
      shift 2
      ;;
    --package)
      package_kind="${2:?missing value for --package}"
      shift 2
      ;;
    -h|--help)
      cat <<EOF
Usage: $0 [--arch x64|x86|all] [--type Debug|Release] [--package portable|installer|all|none]
EOF
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    echo "Run DevScripts/setup_env.sh first." >&2
    exit 1
  fi
}

require_cmd cmake
require_cmd ninja

case "$package_kind" in
  portable|installer|all|none)
    ;;
  *)
    echo "Unsupported package type: $package_kind" >&2
    exit 2
    ;;
esac

case "$build_type" in
  Debug|Release|RelWithDebInfo|MinSizeRel)
    ;;
  *)
    echo "Unsupported build type: $build_type" >&2
    exit 2
    ;;
esac

build_one_arch() {
  local target_arch="$1"
  local build_dir="$SOURCE_DIR/build/${target_arch}-${build_type}${MEMGRAPH_BUILD_DIR_SUFFIX:-}"
  local install_dir="$build_dir/package-root"
  local cmake_args=(
    -S "$SOURCE_DIR"
    -B "$build_dir"
    -G Ninja
    -DCMAKE_BUILD_TYPE="$build_type"
    -DCMAKE_INSTALL_PREFIX="$install_dir"
  )

  if [[ "$target_arch" == "x86" ]]; then
    compiler_machine="$(c++ -dumpmachine 2>/dev/null || true)"
    if [[ "$compiler_machine" != i386-* && "$compiler_machine" != i486-* && "$compiler_machine" != i586-* && "$compiler_machine" != i686-* ]]; then
      cmake_args+=(
        -DCMAKE_C_FLAGS=-m32
        -DCMAKE_CXX_FLAGS=-m32
      )
    fi
    if [[ -n "${MEMGRAPH_QT_PREFIX_X86:-}" ]]; then
      cmake_args+=(-DCMAKE_PREFIX_PATH="$MEMGRAPH_QT_PREFIX_X86")
    fi
  fi

  echo "Configuring MemGraph for $target_arch..."
  cmake "${cmake_args[@]}"

  echo "Building MemGraph for $target_arch..."
  cmake --build "$build_dir"

  if [[ "$package_kind" == "none" ]]; then
    return
  fi

  echo "Installing into package staging directory..."
  cmake --install "$build_dir"

  mkdir -p "$RELEASES_DIR"

  if [[ "$package_kind" == "portable" || "$package_kind" == "all" ]]; then
    local portable_name="MemGraph-v${VERSION}-linux-${target_arch}-portable"
    local portable_path="$RELEASES_DIR/${portable_name}.tar.gz"
    local unpacked_path="$RELEASES_DIR/${portable_name}-unpacked"
    rm -rf "$unpacked_path"
    mkdir -p "$unpacked_path"
    cp -a "$install_dir"/. "$unpacked_path"/
    tar -C "$install_dir" -czf "$portable_path" .
    echo "Wrote $portable_path"
    echo "Wrote $unpacked_path"
  fi

  if [[ "$package_kind" == "installer" || "$package_kind" == "all" ]]; then
    local installer_name="MemGraph-v${VERSION}-linux-${target_arch}.run"
    local installer_path="$RELEASES_DIR/$installer_name"
    local archive_path="$build_dir/installer-payload.tar.gz"
    tar -C "$install_dir" -czf "$archive_path" .
    {
      cat <<'INSTALLER'
#!/usr/bin/env bash
set -euo pipefail

target_dir="${1:-$HOME/.local/opt/MemGraph}"
mkdir -p "$target_dir"
payload_line="$(awk '/^__MEMGRAPH_PAYLOAD_BELOW__/ { print NR + 1; exit 0; }' "$0")"
tail -n +"$payload_line" "$0" | tar -xz -C "$target_dir"
mkdir -p "$HOME/.local/bin"
ln -sf "$target_dir/bin/MemGraph" "$HOME/.local/bin/MemGraph"
echo "MemGraph installed to $target_dir"
echo "Run: $HOME/.local/bin/MemGraph"
exit 0
__MEMGRAPH_PAYLOAD_BELOW__
INSTALLER
      cat "$archive_path"
    } > "$installer_path"
    chmod +x "$installer_path"
    echo "Wrote $installer_path"
  fi
}

case "$arch" in
  x64|x86)
    build_one_arch "$arch"
    ;;
  all)
    build_one_arch x64
    build_one_arch x86
    ;;
  *)
    echo "Unsupported arch: $arch" >&2
    exit 2
    ;;
esac
