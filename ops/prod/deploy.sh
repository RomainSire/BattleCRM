#!/bin/sh
# Delivers one release of BattleCRM (spec stack §10.3, ADR 0013), in /opt/docker/battlecrm.
# The release workflow calls it over SSH as battlecrm-deploy, whose key only runs this script:
#   restrict,command="/opt/docker/battlecrm/deploy.sh" ssh-ed25519 …
# so the tag arrives in SSH_ORIGINAL_COMMAND. By hand: ./deploy.sh v1.2.3
#
# Steps: the compose file and its companions come out of the API image of that tag, migrate runs
# (a failure stops everything, the running API stays), then up waits for /api/health. On any failure
# it goes back to the tag recorded in deployed_tag. Installed by hand: deploy.sh never replaces itself.
set -eu

image=ghcr.io/romainsire/battlecrm-api
compose="docker compose -f docker-compose.prod.yml"

tag=${SSH_ORIGINAL_COMMAND:-${1:-}}
if ! printf '%s' "$tag" | grep -Eqx 'v[0-9]+\.[0-9]+\.[0-9]+'; then
  echo "usage: deploy.sh vMAJOR.MINOR.PATCH (got '$tag')" >&2
  exit 2
fi

cd "$(dirname "$(readlink -f "$0")")"

# One delivery at a time.
exec 9>deploy.lock
if ! flock -n 9; then
  echo "another delivery is running" >&2
  exit 1
fi

deliver() {
  echo "==> $1"
  export BATTLECRM_VERSION="${1#v}"
  docker pull --quiet "$image:$BATTLECRM_VERSION" >/dev/null || return 1
  container=$(docker create "$image:$BATTLECRM_VERSION") || return 1
  docker cp --quiet "$container:/ops/." . || {
    docker rm "$container" >/dev/null
    return 1
  }
  docker rm "$container" >/dev/null
  chmod 755 backup.sh
  $compose pull --quiet || return 1
  $compose run --rm migrate || return 1
  # --wait fails when a healthcheck does not pass in time: the API's calls /api/health.
  $compose up --detach --remove-orphans --wait --wait-timeout 120 || return 1
}

previous=$(cat deployed_tag 2>/dev/null || true)

if deliver "$tag"; then
  echo "$tag" >deployed_tag
  echo "==> $tag delivered"
  exit 0
fi

echo "==> $tag failed" >&2
if [ -n "$previous" ] && [ "$previous" != "$tag" ]; then
  if deliver "$previous"; then
    echo "==> back on $previous" >&2
  else
    echo "==> going back to $previous failed too: see docker compose ps and logs" >&2
  fi
fi
exit 1
