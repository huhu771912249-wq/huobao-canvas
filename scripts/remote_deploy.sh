#!/usr/bin/env bash
# Server-side half of Frontend CD. Streamed to the deploy host over ssh stdin.
#
# Implements DEPLOYMENT.md: a checksum-verified immutable release directory
# holding `dist/` plus its `release-manifest.json`, then an atomic symlink
# switch. Nginx serves ${APP_ROOT}/current/dist, so the switch is the release.
#
# No host, path or credential is hardcoded; the workflow supplies every value
# from repository secrets.
set -euo pipefail

: "${APP_ROOT:?APP_ROOT is required}"
: "${RELEASE_ID:?RELEASE_ID is required}"
DRY_RUN="${DRY_RUN:-1}"
TARBALL="${TARBALL:-}"
RELOAD_COMMAND="${RELOAD_COMMAND:-}"

releases_dir="$APP_ROOT/releases"
release_dir="$releases_dir/$RELEASE_ID"
incoming_dir="$releases_dir/.incoming-$RELEASE_ID"

log() { printf '[remote] %s\n' "$*"; }
die() { printf '[remote] ERROR: %s\n' "$*" >&2; exit 1; }

case "$RELEASE_ID" in
  *[!A-Za-z0-9._-]* | "" | . | ..) die "invalid RELEASE_ID (allowed: A-Z a-z 0-9 . _ -)" ;;
esac

preflight() {
  log "release id      : $RELEASE_ID"
  [ -d "$APP_ROOT" ] || die "APP_ROOT does not exist on this host"
  [ -d "$releases_dir" ] || die "releases/ does not exist under APP_ROOT (see docs/cd-pipeline.md first-run setup)"
  [ -w "$releases_dir" ] || die "releases/ is not writable by the deploy user"
  if [ -e "$release_dir" ]; then
    die "release $RELEASE_ID already exists; immutable releases are never overwritten"
  fi

  if [ -L "$APP_ROOT/current" ]; then
    log "current release : $(basename "$(readlink -f "$APP_ROOT/current")")"
  elif [ -e "$APP_ROOT/current" ]; then
    die "APP_ROOT/current exists but is not a symlink; refusing to touch it"
  else
    log "current release : (none yet - this would be the first release)"
  fi

  log "free space      : $(df -Pk "$releases_dir" | awk 'NR==2 {printf "%d MiB", $4/1024}')"
  if [ -n "$RELOAD_COMMAND" ]; then
    log "reload          : would run the configured reload command"
  else
    log "reload          : none configured (nginx resolves the symlink per request)"
  fi
}

deploy() {
  [ -n "$TARBALL" ] || die "TARBALL is required for a real deploy"
  [ -f "$TARBALL" ] || die "uploaded artifact not found on this host"

  rm -rf -- "$incoming_dir"
  mkdir -p -- "$incoming_dir"
  tar -xzf "$TARBALL" -C "$incoming_dir"

  [ -f "$incoming_dir/release-manifest.json" ] || die "artifact has no release-manifest.json"
  [ -f "$incoming_dir/SHA256SUMS" ] || die "artifact has no SHA256SUMS"
  [ -f "$incoming_dir/dist/index.html" ] || die "artifact has no dist/index.html; refusing to publish an empty site"

  # "产物校验值": the bytes nginx will serve must be the bytes CI built.
  ( cd "$incoming_dir" && sha256sum -c SHA256SUMS --quiet ) \
    || die "checksum verification failed; artifact is corrupt or tampered with"
  log "checksums verified against SHA256SUMS"

  local previous=""
  if [ -L "$APP_ROOT/current" ]; then
    previous="$(readlink -f "$APP_ROOT/current")"
  fi

  mv -T -- "$incoming_dir" "$release_dir"
  log "release directory materialised"

  # The atomic switch, verbatim from DEPLOYMENT.md.
  ln -sfn "$release_dir" "$APP_ROOT/current.next"
  mv -Tf "$APP_ROOT/current.next" "$APP_ROOT/current"
  log "current -> $RELEASE_ID"

  if [ -n "$previous" ]; then
    ln -sfn "$previous" "$APP_ROOT/previous.next"
    mv -Tf "$APP_ROOT/previous.next" "$APP_ROOT/previous"
    log "previous -> $(basename "$previous")"
  fi

  # Only needed if nginx is configured with open_file_cache; harmless otherwise.
  if [ -n "$RELOAD_COMMAND" ]; then
    log "running reload command"
    eval "$RELOAD_COMMAND"
  fi

  rm -f -- "$TARBALL"
  log "deploy finished; the site must now serve this release's assets"
}

if [ "$DRY_RUN" = "1" ]; then
  log "DRY RUN - no files written, no symlink moved"
  preflight
  log "DRY RUN complete: the host is ready for this release id"
else
  preflight
  deploy
fi
