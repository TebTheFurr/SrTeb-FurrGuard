#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  printf '%s\n' "Usage: bash install.sh --version 1-9-6"
  printf '%s\n' "   or: bash install.sh --zip luna-pterodactyl-1-9-6.zip"
}

fail() {
  printf '\n%s\n' "$1" >&2
  exit 1
}

run() {
  printf '\n> %s\n' "$*"
  "$@"
}

need_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

read_manifest_array() {
  local key="$1"
  php -r '$manifest = json_decode(file_get_contents($argv[1]), true, 512, JSON_THROW_ON_ERROR); $value = $manifest[$argv[2]] ?? null; if (!is_array($value)) { fwrite(STDERR, "Manifest key \"" . $argv[2] . "\" must be an array.\n"); exit(1); } foreach ($value as $item) { if (!is_string($item) || trim($item) === "") { fwrite(STDERR, "Manifest key \"" . $argv[2] . "\" contains an invalid entry.\n"); exit(1); } echo trim($item), PHP_EOL; }' "$MANIFEST_FILE" "$key"
}

read_manifest_value() {
  local key="$1"
  php -r '$manifest = json_decode(file_get_contents($argv[1]), true, 512, JSON_THROW_ON_ERROR); $value = $manifest[$argv[2]] ?? ""; if (is_array($value) || is_object($value)) { exit(1); } echo trim((string) $value);' "$MANIFEST_FILE" "$key"
}

run_with_privileges() {
  if [[ ${EUID:-$(id -u)} -eq 0 ]]; then
    run "$@"
    return
  fi

  need_command sudo
  printf '\n> sudo %s\n' "$*"
  sudo "$@"
}

node_major_version() {
  if ! command -v node >/dev/null 2>&1; then
    printf '%s\n' "0"
    return
  fi

  local version
  version="$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || printf '%s' '0')"
  if [[ "$version" =~ ^[0-9]+$ ]]; then
    printf '%s\n' "$version"
    return
  fi

  printf '%s\n' "0"
}

install_nodejs() {
  need_command curl

  if command -v apt-get >/dev/null 2>&1; then
    if [[ ${EUID:-$(id -u)} -eq 0 ]]; then
      run bash -c "curl -fsSL https://deb.nodesource.com/setup_22.x | bash -"
      run apt-get install -y nodejs
      return
    fi

    need_command sudo
    printf '\n> curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -\n'
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    run sudo apt-get install -y nodejs
    return
  fi

  if command -v dnf >/dev/null 2>&1; then
    if [[ ${EUID:-$(id -u)} -eq 0 ]]; then
      run bash -c "curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -"
      run dnf install -y nodejs
      return
    fi

    need_command sudo
    printf '\n> curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo -E bash -\n'
    curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo -E bash -
    run sudo dnf install -y nodejs
    return
  fi

  if command -v yum >/dev/null 2>&1; then
    if [[ ${EUID:-$(id -u)} -eq 0 ]]; then
      run bash -c "curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -"
      run yum install -y nodejs
      return
    fi

    need_command sudo
    printf '\n> curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo -E bash -\n'
    curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo -E bash -
    run sudo yum install -y nodejs
    return
  fi

  fail "Unsupported distribution. Install Node.js 22 manually, then run the installer again."
}

ensure_nodejs() {
  local version
  version="$(node_major_version)"
  if (( version >= 22 )); then
    return
  fi

  printf '\n%s\n' "Installing Node.js 22..."
  install_nodejs
}

ensure_yarn() {
  if command -v yarn >/dev/null 2>&1; then
    return
  fi

  need_command npm
  printf '\n%s\n' "Installing Yarn..."
  run_with_privileges npm install --global yarn
}

backup_path() {
  local relative_path="$1"
  local source_path="$PANEL_DIR/$relative_path"
  local backup_path="$BACKUP_DIR/$relative_path"

  if [[ ! -e "$source_path" && ! -L "$source_path" ]]; then
    return
  fi

  mkdir -p "$(dirname "$backup_path")"
  cp -a "$source_path" "$backup_path"
}

replace_path() {
  local relative_path="$1"
  local source_path="$PRODUCT_DIR/$relative_path"
  local target_path="$PANEL_DIR/$relative_path"

  [[ -e "$source_path" || -L "$source_path" ]] || fail "Missing packaged path in archive: $relative_path"

  rm -rf "$target_path"
  mkdir -p "$(dirname "$target_path")"
  cp -a "$source_path" "$target_path"
}

restore_path() {
  local relative_path="$1"
  local backup_path="$BACKUP_DIR/$relative_path"
  local target_path="$PANEL_DIR/$relative_path"

  if [[ ! -e "$backup_path" && ! -L "$backup_path" ]]; then
    return
  fi

  rm -rf "$target_path"
  mkdir -p "$(dirname "$target_path")"
  cp -a "$backup_path" "$target_path"
}

ZIP_FILE="${1:-}"
[[ -n "$ZIP_FILE" ]] || {
  usage
  exit 1
}

[[ -f "$ZIP_FILE" ]] || fail "Zip file not found: $ZIP_FILE"
[[ -f "artisan" ]] || fail "Run this installer from your Pterodactyl panel root."

need_command unzip
need_command php

PANEL_DIR="$(pwd)"
TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/luna-install.XXXXXX")"
ARCHIVE_DIR="$TEMP_DIR/archive"
PRODUCT_DIR="$ARCHIVE_DIR/Product"
BACKUP_DIR="$TEMP_DIR/preserve"
MANIFEST_FILE="$TEMP_DIR/updateManifest.json"

cleanup() {
  rm -rf "$TEMP_DIR"
}

trap cleanup EXIT

mkdir -p "$ARCHIVE_DIR" "$BACKUP_DIR"
unzip -p "$ZIP_FILE" install_script/updateManifest.json > "$MANIFEST_FILE" || fail "Could not read install_script/updateManifest.json from $ZIP_FILE"
unzip -oq "$ZIP_FILE" "Product/*" -d "$ARCHIVE_DIR" || fail "Could not extract Product from $ZIP_FILE"

mapfile -t REPLACE_PATHS < <(read_manifest_array replace)
mapfile -t PRESERVE_PATHS < <(read_manifest_array preserve)
PRODUCT_NAME="$(read_manifest_value productName)"
[[ -n "$PRODUCT_NAME" ]] || PRODUCT_NAME="Luna Pterodactyl Theme"
(( ${#REPLACE_PATHS[@]} > 0 )) || fail "The installer manifest does not contain any paths to replace."

for relative_path in "${REPLACE_PATHS[@]}"; do
  [[ -e "$PRODUCT_DIR/$relative_path" || -L "$PRODUCT_DIR/$relative_path" ]] || fail "The archive is missing Product/$relative_path"
done

printf '\n%s\n' "Installing $PRODUCT_NAME"

run php artisan down

for relative_path in "${PRESERVE_PATHS[@]}"; do
  backup_path "$relative_path"
done

for relative_path in "${REPLACE_PATHS[@]}"; do
  replace_path "$relative_path"
done

for relative_path in "${PRESERVE_PATHS[@]}"; do
  restore_path "$relative_path"
done

ensure_nodejs
ensure_yarn

run yarn install

if [[ -e "public/storage" || -L "public/storage" ]]; then
  rm -rf public/storage
fi

run php artisan migrate --force
run php artisan storage:link
run php artisan route:clear
run php artisan view:clear
run env NODE_OPTIONS=--openssl-legacy-provider yarn build:production

PANEL_OWNER="$(stat -c '%u:%g' "$PANEL_DIR" 2>/dev/null || printf '%s' '')"
if [[ -n "$PANEL_OWNER" ]]; then
  for relative_path in "${REPLACE_PATHS[@]}"; do
    if [[ -e "$relative_path" || -L "$relative_path" ]]; then
      run_with_privileges chown -R "$PANEL_OWNER" "$relative_path"
    fi
  done

  if [[ -e "public/storage" || -L "public/storage" ]]; then
    run_with_privileges chown -R "$PANEL_OWNER" public/storage
  fi
fi

run php artisan up

printf '\n%s\n' "$PRODUCT_NAME installed successfully."
