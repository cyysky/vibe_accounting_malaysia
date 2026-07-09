# Operations

Day-2 operations for Vibe Accounting Malaysia. All commands assume the repo
root as the current directory unless stated otherwise.

## Scripts

| Script                | Purpose                                                |
| --------------------- | ------------------------------------------------------ |
| `scripts/up.ps1`      | Build (optional) and start the full stack               |
| `scripts/down.ps1`    | Stop the stack (persistent data is kept)               |
| `scripts/status.ps1`  | Show container status and `infra/data/` size           |
| `scripts/backup.ps1`  | Snapshot `infra/data/` to `infra/data/backups/*.zip`   |
| `scripts/restore.ps1` | Stop the stack and restore a snapshot                  |
| `scripts/reset.ps1`   | DESTRUCTIVE — stop the stack and wipe `infra/data/`    |

All scripts accept `-Build`, `-Volumes`, `-Prune`, or `-Force` where relevant.
Run `Get-Help .\scripts\<name>.ps1 -Full` for parameter details.

## Backup strategy

The persistent data tree (`infra/data/`) is the **single source of truth**.
Postgres files, user uploads, and previous backups all live inside it.

Recommended schedule:

1. **Before any upgrade** — `scripts/backup.ps1`
2. **Daily / nightly** — scheduled task that calls `scripts/backup.ps1` and
   copies the resulting zip off-host
3. **Before destructive ops** — `scripts/backup.ps1` then `scripts/restore.ps1 -Prune`

Snapshots are zip files for easy inspection. To list contents:

```powershell
Expand-Archive .\infra\data\backups\vibe-backup-2026-07-10.zip -DestinationPath C:\peek
```

To do a logical (SQL) dump in addition to the file-level snapshot:

```powershell
docker exec vibe-accounting-malaysia-postgres `
  pg_dump -U vibe -d vibe > infra\data\backups\vibe-$(Get-Date -Format yyyy-MM-dd).sql
```

## Restore

```powershell
# Restore into the current infra/data/ (overlapping files overwritten,
# extra files kept)
.\scripts\restore.ps1 -Archive infra\data\backups\vibe-backup-2026-07-10.zip

# Restore into a fully-pruned infra/data/ (exact match to the archive)
.\scripts\restore.ps1 -Archive infra\data\backups\vibe-backup-2026-07-10.zip -Prune
```

`restore.ps1` stops the stack before extracting, so there is no risk of
Postgres writing to the data directory while files are being replaced.

## Troubleshooting

### "port is already allocated"

Another container on this host is using port `8080` (or another port declared
in `infra/docker-compose.yml`). Edit `infra/.env` to change `PUBLIC_PORT` and
the matching `ports:` line in `infra/docker-compose.yml`.

### api container keeps restarting

Run `docker logs vibe-accounting-malaysia-api` to see why. Common causes:

- Postgres not healthy yet — the `depends_on: condition: service_healthy`
  clause should prevent this, but if you started the stack with
  `docker compose up` instead of `-d`, you may see restart attempts in the
  log. Wait a few seconds; it will settle.
- A leftover Postgres data directory from a different PG major version.
  `scripts/reset.ps1 -Force` will start over cleanly.

### "Cannot find module" on api start

The image was built from a stale cache. Run `scripts/up.ps1 -Build` to
rebuild.

### Permission errors on Windows bind mounts

`infra/data/postgres/` must be writable by the postgres container's
`postgres` user (UID 999). If Windows ACLs are blocking this:

```powershell
# Wipe and let postgres reinitialize cleanly
.\scripts\reset.ps1 -Force
.\scripts\up.ps1 -Build
```

### Database feels slow / disk full

```powershell
# Inside the postgres container
docker exec -it vibe-accounting-malaysia-postgres `
  psql -U vibe -d vibe -c "VACUUM (ANALYZE);"

# Outside, see what's eating disk
.\scripts\status.ps1
```

## Logs

```powershell
# Tail all services
docker compose -f infra\docker-compose.yml logs -f

# Just one
docker logs -f vibe-accounting-malaysia-api
```

## Updating the stack

```powershell
git pull
.\scripts\backup.ps1
.\scripts\up.ps1 -Build
```

If the upgrade involves a Postgres schema change and `up.ps1` fails because
the data directory is from an incompatible version, do a logical dump first:

```powershell
docker exec vibe-accounting-malaysia-postgres `
  pg_dump -U vibe -d vibe > infra\data\backups\pre-upgrade.sql
.\scripts\reset.ps1 -Force
.\scripts\up.ps1 -Build
# then load the dump
Get-Content infra\data\backups\pre-upgrade.sql | `
  docker exec -i vibe-accounting-malaysia-postgres psql -U vibe -d vibe
```
