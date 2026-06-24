# CrewOps

CrewOps is a self-hosted operations backend for community, film, nonprofit, club, and volunteer organisations. It is designed to be run in Docker/Portainer with PostgreSQL and local persistent upload/backup volumes.

This first version prioritises:

- broad data structure over deep polish in one module
- setup-time branding and module configuration
- username/password auth with hashed passwords
- composable permission tags, regions, and teams
- audit logging for important changes
- clean APIs for future integrations
- local file metadata and future sync fields

Cloudflare Tunnel is intentionally not included in this stack. Run it as a separate Portainer stack/container so redeploying CrewOps does not reset the temporary tunnel URL.

## Quick start

1. Copy `.env.example` to `.env` and edit secrets/passwords.
2. Deploy with Docker Compose or Portainer.
3. Open `http://localhost:8088`.
4. Complete the first-run setup wizard.

```powershell
docker compose up --build
```

## Test locally

```powershell
pip install -r requirements-dev.txt
pytest -q
```

The smoke test creates a throwaway SQLite database and verifies the setup flow plus the main create/list APIs across users, visitors, regions, projects, tasks, calendar, attendance, training, equipment, finance, HR, messages, announcements, files, XP, notifications, forms, integrations, audit, and backups.

## Default service URLs

- App: `http://localhost:8088`
- API docs: `http://localhost:8088/docs`
- Health: `http://localhost:8088/api/health`

## Portainer notes

Use `docker-compose.yml` as the stack file. Keep the `crewops_uploads`, `crewops_backups`, and `crewops_postgres` volumes persistent.

Required stack environment values:

```env
APP_NAME=CrewOps
ENVIRONMENT=production
SECRET_KEY=replace-with-a-long-random-secret
ACCESS_TOKEN_EXPIRE_MINUTES=720
POSTGRES_DB=crewops
POSTGRES_USER=crewops
POSTGRES_PASSWORD=replace-with-a-strong-database-password
DATABASE_URL=postgresql+psycopg://crewops:replace-with-a-strong-database-password@db:5432/crewops
UPLOAD_DIR=/data/uploads
BACKUP_DIR=/data/backups
CORS_ORIGINS=http://localhost:8088
```

If you expose the app through Cloudflare Tunnel for testing, create a separate tunnel stack and point it at `http://crewops-app:8000` if both stacks share an external Docker network, or at the host/Portainer published port otherwise.

## Security notes

- Change `SECRET_KEY` before deployment.
- Use HTTPS at the tunnel/domain layer.
- Keep PostgreSQL private to the Docker network.
- Sensitive HR and finance API routes require domain permissions or password re-entry with an access reason, and create audit entries.
- Uploaded files are saved to the persistent upload volume, with metadata and checksums recorded in the database.
