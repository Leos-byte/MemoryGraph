#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

build_type="Release"
package_kind="portable"
image="docker.io/i386/debian:trixie"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --type)
      build_type="${2:?missing value for --type}"
      shift 2
      ;;
    --package)
      package_kind="${2:?missing value for --package}"
      shift 2
      ;;
    --image)
      image="${2:?missing value for --image}"
      shift 2
      ;;
    -h|--help)
      cat <<EOF
Usage: $0 [--type Debug|Release] [--package portable|installer|all|none] [--image IMAGE]

Builds strict 32-bit x86/i686 MemGraph packages in an isolated Linux container.
This avoids Fedora multilib conflicts between qt6-qtbase-devel.x86_64 and qt6-qtbase-devel.i686.
EOF
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

if ! command -v podman >/dev/null 2>&1; then
  echo "Missing required command: podman" >&2
  echo "Install it with: sudo dnf install -y podman" >&2
  exit 1
fi

container_script='set -euo pipefail
if [[ -f /etc/os-release ]]; then
  source /etc/os-release
else
  ID=unknown
fi

if [[ "$ID" == "fedora" ]]; then
  dnf install -y gcc-c++ cmake ninja-build qt6-qtbase-devel qt6-qttools-devel qt6-qttranslations sqlite-devel libsecret tar gzip file
elif [[ "$ID" == "debian" || "$ID" == "ubuntu" ]]; then
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    g++ cmake ninja-build qt6-base-dev qt6-tools-dev qt6-tools-dev-tools \
    libqt6sql6-sqlite libsqlite3-dev libsecret-tools tar gzip file ca-certificates
else
  echo "Unsupported container distribution: $ID" >&2
  exit 1
fi

cd /workspace
./DevScripts/build.sh --arch x86 --type "$MEMGRAPH_BUILD_TYPE" --package "$MEMGRAPH_PACKAGE_KIND"
file Source/build/x86-"$MEMGRAPH_BUILD_TYPE"-podman/MemGraph
'

podman run --rm --arch 386 \
  -e MEMGRAPH_BUILD_TYPE="$build_type" \
  -e MEMGRAPH_PACKAGE_KIND="$package_kind" \
  -e MEMGRAPH_BUILD_DIR_SUFFIX="-podman" \
  -v "$ROOT_DIR:/workspace:Z" \
  -w /workspace \
  "$image" \
  /bin/bash -lc "$container_script"
