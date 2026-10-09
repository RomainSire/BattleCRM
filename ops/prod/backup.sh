#!/bin/sh
# Nightly dump of the BattleCRM database (spec stack §12), installed by deploy.sh and run by root's crontab:
#   0 3 * * * /opt/docker/battlecrm/backup.sh
# Keeps 30 days, then pings the backups' push monitor, only when everything succeeded:
# uptime-kuma alerts when that ping is missing. Restoring: docs/ops/restore.md.
set -eu
umask 077

cd "$(dirname "$(readlink -f "$0")")"
mkdir -p backups
chmod 700 backups

dump="backups/battlecrm-$(date -u +%Y%m%dT%H%M%SZ).dump"
# As the superuser, over the container's local socket.
docker exec battlecrm-postgres pg_dump --format=custom --username=postgres --dbname=battlecrm >"$dump.partial"
# A dump that cannot be listed is not a backup.
docker exec -i battlecrm-postgres pg_restore --list >/dev/null <"$dump.partial"
mv "$dump.partial" "$dump"

find backups -name 'battlecrm-*.dump' -mtime +30 -delete
find backups -name 'battlecrm-*.dump.partial' -mtime +1 -delete

. ./backup.env
if [ -n "${BACKUP_PUSH_URL:-}" ]; then
  curl --fail --silent --show-error --max-time 10 --retry 3 --output /dev/null "$BACKUP_PUSH_URL"
fi
