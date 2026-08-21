#!/usr/bin/env bash
# Server-side half of Frontend CD rollback. Streamed over ssh stdin.
#
# ROLLBACK.md: only roll back to an immutable release whose manifest and
# artifacts verify. The release we roll away from is never deleted.
set -euo pipefail

: "${APP_ROOT:?APP_ROOT is required}"
: "${RELEASE_ID:?RELEASE_ID is required}"
DRY_RUN="${DRY_RUN:-1}"
RELOAD_COMMAND="${RELOAD_COMMAND:-}"

release_dir="$APP_ROOT/releases/$RELEASE_ID"

log() { printf '[remote] %s\n' "$*"; }
die() { printf '[remote] ERROR: %s\n' "$*" >&2; exit 1; }

case "$RELEASE_ID" in
  *[!A-Za-z0-9._-]* | "" | . | ..) die "invalid RELEASE_ID (allowed: A-Z a-z 0-9 . _ -)" ;;
esac

[ -d "$release_dir" ] || die "release $RELEASE_ID does not exist on this host"
[ -f "$release_dir/release-manifest.json" ] || die "release $RELEASE_ID has no manifest; refusing to roll back to it"
[ -f "$release_dir/SHA256SUMS" ] || die "release $RELEASE_ID has no SHA256SUMS; refusing to roll back to it"
[ -f "$release_dir/dist/index.html" ] || die "release $RELEASE_ID has no dist/index.html"

( cd "$release_dir" && sha256sum -c SHA256SUMS --quiet ) \
  || die "release $RELEASE_ID fails its own checksums; it is not a safe rollback target"
log "rollback target passed checksum verification"

# A static-file host is not guaranteed to have node, so python3 is tried first.
read_release_id() {
  if command -v python3 >/dev/null 2>&1; then
    python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["release_id"], end="")' "$1"
  elif command -v node >/dev/null 2>&1; then
    node -e 'process.stdout.write(String(require(process.argv[1]).release_id))' "$1"
  else
    die "neither python3 nor node is available to parse the release manifest"
  fi
}
manifest_release_id="$(read_release_id "$release_dir/release-manifest.json")"
[ "$manifest_release_id" = "$RELEASE_ID" ] \
  || die "manifest says release_id=$manifest_release_id but the directory is $RELEASE_ID"

current_target="(none)"
if [ -L "$APP_ROOT/current" ]; then
  current_target="$(basename "$(readlink -f "$APP_ROOT/current")")"
fi
log "current release : $current_target"
log "rollback target : $RELEASE_ID"

if [ "$DRY_RUN" = "1" ]; then
  log "DRY RUN - target verified, nothing switched"
  exit 0
fi

previous=""
if [ -L "$APP_ROOT/current" ]; then
  previous="$(readlink -f "$APP_ROOT/current")"
fi

ln -sfn "$release_dir" "$APP_ROOT/current.next"
mv -Tf "$APP_ROOT/current.next" "$APP_ROOT/current"
log "current -> $RELEASE_ID"

if [ -n "$previous" ]; then
  ln -sfn "$previous" "$APP_ROOT/previous.next"
  mv -Tf "$APP_ROOT/previous.next" "$APP_ROOT/previous"
  log "previous -> $(basename "$previous") (kept on disk as evidence)"
fi

if [ -n "$RELOAD_COMMAND" ]; then
  log "running reload command"
  eval "$RELOAD_COMMAND"
fi

log "rollback finished; the site must now serve the rollback target's assets"
