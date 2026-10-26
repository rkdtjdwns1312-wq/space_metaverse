#!/usr/bin/env bash
set -euo pipefail
umask 077

[[ $EUID -eq 0 ]] || { printf '%s\n' 'Run this backup through the root systemd service.' >&2; exit 1; }
backup_dir=/var/backups/woozooclass
[[ -d /etc/woozooclass && -d /var/lib/woozooclass/classes ]] || { printf '%s\n' 'Private configuration or classroom directory is missing.' >&2; exit 1; }
install -d -m 0700 -o root -g root "$backup_dir"
exec 9>/run/lock/woozooclass-backup.lock
flock -n 9 || { printf '%s\n' 'Another backup is already running.' >&2; exit 1; }

restart_app=0
backup_tmp=''
finish() {
  local result=$?
  trap - EXIT
  if [[ -n "$backup_tmp" && -f "$backup_tmp" ]]; then rm -- "$backup_tmp" || result=1; fi
  if [[ $restart_app -eq 1 ]]; then
    systemctl start woozooclass.service || result=1
  fi
  exit "$result"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
if systemctl is-active --quiet woozooclass.service; then
  restart_app=1
  systemctl stop woozooclass.service
fi
[[ ! -e /var/lib/woozooclass/classes/.writer.lock ]] || { printf '%s\n' 'Store lock remains; preserve it and inspect the stopped service before backing up.' >&2; exit 1; }

backup_tmp=$(mktemp "$backup_dir/.snapshot.XXXXXX")
tar -czf "$backup_tmp" -C / etc/woozooclass var/lib/woozooclass
tar -tzf "$backup_tmp" >/dev/null
backup_name="woozooclass-$(date -u +%Y%m%dT%H%M%SZ)-$$.tar.gz"
mv -- "$backup_tmp" "$backup_dir/$backup_name"
backup_tmp=''
(cd "$backup_dir" && sha256sum "$backup_name" > "$backup_name.sha256")

# Only this service's daily archives/checksums are removed after 14 days.
find "$backup_dir" -maxdepth 1 -type f \( -name 'woozooclass-*.tar.gz' -o -name 'woozooclass-*.tar.gz.sha256' \) -mtime +14 -delete
printf '%s\n' "Local backup created: $backup_name"
