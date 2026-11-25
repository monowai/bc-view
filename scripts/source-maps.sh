#!/bin/sh
#
# Ready a production build's source maps for Sentry, without serving them.
#
#   scripts/source-maps.sh .next
#
# Run by `yarn build`, straight after `next build`, so the CI artifact and
# the in-container build carry the same files. Three steps:
#
# 1. Stamp every chunk and its map with a debug ID (`sentry-cli sourcemaps
#    inject`). Sentry pairs a stack frame with its map by that ID, not by
#    release name. The ID is a hash of the file, so the copy of a server chunk
#    that `output: "standalone"` made gets the same ID as the original.
# 2. Copy every chunk and every map into <next>/sourcemaps: all of them,
#    because Turbopack names a map apart from its chunk and sentry-cli pairs
#    them by the chunk's sourceMappingURL, so a map uploaded without its chunk
#    is never read. The image carries that folder outside anything the server
#    hands out, and bc-deploy uploads it from the running pod: only a build
#    that is deployed sends its maps, and the build never holds a token.
# 3. Delete the browser maps from <next>/static, which is served as
#    /_next/static. A map there gives anyone the source, comments included.
#
# POSIX sh, not bash: the image builds on node:*-alpine, which has no bash.
set -eu

next=$(cd "${1:?usage: scripts/source-maps.sh <the .next directory>}" && pwd)
cli="$(cd "$(dirname "$0")/.." && pwd)/node_modules/.bin/sentry-cli"
# Refuse before touching anything: the rm -rf below is under $next.
fail() { echo "scripts/source-maps.sh: $*" >&2; exit 1; }
[ -d "$next/static" ] && [ -d "$next/server" ] ||
  fail "$next is not a next build: no static/ and server/"
[ -x "$cli" ] || fail "no sentry-cli at $cli: is @sentry/cli installed?"

set -- "$next/static" "$next/server"
standalone_server="$next/standalone/.next/server"
if [ -d "$standalone_server" ]; then set -- "$@" "$standalone_server"; fi
"$cli" sourcemaps inject --quiet "$@" >/dev/null

kept="$next/sourcemaps"
rm -rf "$kept"
for part in static server; do
  (
    cd "$next/$part"
    find . \( -name '*.js' -o -name '*.map' \) -print | while read -r file; do
      mkdir -p "$kept/$part/$(dirname "$file")"
      cp "$file" "$kept/$part/$file"
    done
  )
done

find "$next/static" -name '*.map' -delete
