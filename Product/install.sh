#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  printf '%s\n' "Usage: bash install.sh [--version 1-9-6] [--zip luna-pterodactyl-1-9-6.zip]"
}

fail() {
  printf '\n%s\n' "$1" >&2
  exit 1
}

need_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

resolve_zip_from_version() {
  local version="$1"
  local normalised_version="${version//./-}"
  local expected_name="luna-pterodactyl-${normalised_version}.zip"

  if [[ -f "$expected_name" ]]; then
    printf '%s\n' "$expected_name"
    return
  fi

  shopt -s nullglob
  local matches=( *"${normalised_version}"*.zip )
  shopt -u nullglob

  if (( ${#matches[@]} == 1 )); then
    printf '%s\n' "${matches[0]}"
    return
  fi

  fail "Could not find a unique zip for version: $version"
}

resolve_zip_automatically() {
  shopt -s nullglob
  local matches=( luna-pterodactyl-*.zip )
  shopt -u nullglob

  if (( ${#matches[@]} == 1 )); then
    printf '%s\n' "${matches[0]}"
    return
  fi

  fail "Could not automatically determine the Luna zip file. Use --zip or --version."
}

ZIP_FILE=""
VERSION=""

while (( $# > 0 )); do
  case "$1" in
    --version)
      shift
      [[ $# -gt 0 ]] || fail "Missing value for --version"
      VERSION="$1"
      ;;
    --zip)
      shift
      [[ $# -gt 0 ]] || fail "Missing value for --zip"
      ZIP_FILE="$1"
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      fail "Unknown argument: $1"
      ;;
  esac
  shift
done

need_command unzip

if [[ -n "$ZIP_FILE" && -n "$VERSION" ]]; then
  fail "Use either --zip or --version, not both."
fi

if [[ -n "$VERSION" ]]; then
  ZIP_FILE="$(resolve_zip_from_version "$VERSION")"
elif [[ -z "$ZIP_FILE" ]]; then
  ZIP_FILE="$(resolve_zip_automatically)"
fi

[[ -f "$ZIP_FILE" ]] || fail "Zip file not found: $ZIP_FILE"

TEMP_SCRIPT="$(mktemp "${TMPDIR:-/tmp}/luna-bootstrap.XXXXXX")"

cleanup() {
  rm -f "$TEMP_SCRIPT"
}

trap cleanup EXIT

unzip -p "$ZIP_FILE" install_script/install.sh > "$TEMP_SCRIPT" || fail "Could not read install_script/install.sh from $ZIP_FILE"
chmod +x "$TEMP_SCRIPT"

bash "$TEMP_SCRIPT" "$ZIP_FILE"
