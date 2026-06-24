import os
import tempfile

db_path = os.path.join(tempfile.gettempdir(), "crewops-pytest.db")
if os.path.exists(db_path):
    os.remove(db_path)
os.environ["DATABASE_URL"] = f"sqlite:///{db_path.replace(os.sep, '/')}"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


def test_core_modules_are_reachable_and_audited():
    with TestClient(app) as client:
        setup = {
            "organisation_name": "CrewOps Test",
            "organisation_short_name": "CrewOps",
            "admin_username": "admin",
            "admin_email": "admin@example.org",
            "admin_display_name": "System Owner",
            "admin_password": "change-me-now",
            "default_regions": ["Upper North Island", "Lower North Island"],
        }
        response = client.post("/api/setup/complete", json=setup)
        assert response.status_code == 200, response.text
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        me = client.get("/api/auth/me", headers=headers)
        assert me.status_code == 200, me.text
        user_id = me.json()["id"]

        created = {}

        def post(path, payload):
            response = client.post(path, headers=headers, json=payload)
            assert response.status_code < 300, (path, response.status_code, response.text)
            return response.json()

        def get(path):
            response = client.get(path, headers=headers)
            assert response.status_code < 300, (path, response.status_code, response.text)
            return response.json()

        created["region"] = post("/api/org/regions", {"name": "Hamilton"})
        created["team"] = post("/api/org/teams", {"name": "Hamilton Film Team", "region_id": created["region"]["id"]})
        created["member"] = post(
            "/api/users",
            {
                "username": "member1",
                "email": "member1@example.org",
                "display_name": "Member One",
                "password": "change-me-now",
                "permission_tags": ["Project Manager"],
            },
        )
        created["visitor"] = post("/api/visitors", {"name": "Visitor One", "email": "visitor@example.org"})
        created["project"] = post("/api/projects", {"title": "Short Film", "project_type_name": "Film"})
        created["task"] = post("/api/tasks", {"title": "Prepare call sheet", "assigned_to_id": created["member"]["id"]})
        created["event"] = post("/api/calendar/events", {"title": "Workshop", "starts_at": "2026-07-01T09:00:00+12:00"})
        created["attendance"] = client.post(
            f"/api/calendar/events/{created['event']['id']}/attendance",
            headers=headers,
            params={"user_id": created["member"]["id"], "status": "Attended"},
        )
        assert created["attendance"].status_code < 300, created["attendance"].text
        created["workshop"] = post("/api/training/workshops", {"title": "Camera basics"})
        created["skill"] = post("/api/training/skills", {"name": "Camera operation", "category": "Film"})
        created["training"] = post("/api/training/records", {"user_id": created["member"]["id"], "training_name": "Camera basics"})
        created["equipment"] = post("/api/equipment/items", {"name": "Camera Kit", "category": "Camera"})
        created["loan"] = post("/api/equipment/loans", {"equipment_item_id": created["equipment"]["id"]})
        created["budget"] = post("/api/finance/budget-requests", {"title": "Batteries", "amount": 42.5})
        created["finance"] = post("/api/finance/records", {"title": "Receipt", "amount": 42.5})
        created["hr"] = post("/api/hr/records", {"user_id": created["member"]["id"], "title": "Private note"})
        created["thread"] = post("/api/messages/threads", {"title": "Production thread"})
        created["message"] = post(f"/api/messages/threads/{created['thread']['id']}/messages", {"body": "Hello"})
        created["announcement"] = post("/api/announcements", {"title": "Notice", "body": "Hello crew"})
        created["file"] = post("/api/files/records", {"local_path": "/data/uploads/test.pdf", "original_filename": "test.pdf"})
        created["link"] = post("/api/files/links", {"label": "Drive folder", "url": "https://example.org"})
        created["xp"] = post("/api/xp/records", {"user_id": created["member"]["id"], "amount": 10, "reason": "Workshop help"})
        created["notification"] = post("/api/notifications", {"user_id": user_id, "title": "System ready"})
        created["form"] = post("/api/forms/definitions", {"name": "Incident report", "form_type": "incident"})
        created["submission"] = post("/api/forms/submissions", {"form_definition_id": created["form"]["id"], "payload": {"summary": "Test"}})
        created["integration"] = post("/api/integrations/connections", {"provider": "google", "display_name": "Google Workspace"})
        created["backup"] = post("/api/backups", {"backup_type": "manual", "status": "Recorded"})

        for path in [
            "/api/org",
            "/api/org/settings",
            "/api/org/permissions",
            "/api/org/regions",
            "/api/org/teams",
            "/api/users",
            "/api/visitors",
            "/api/projects",
            "/api/tasks?assigned_to_me=false",
            "/api/calendar/events",
            "/api/training/workshops",
            "/api/training/records",
            "/api/training/skills",
            "/api/equipment/items",
            "/api/equipment/loans",
            "/api/finance/budget-requests",
            "/api/finance/records",
            "/api/hr/records?reason=Smoke%20test",
            "/api/messages/threads",
            f"/api/messages/threads/{created['thread']['id']}/messages",
            "/api/announcements",
            "/api/files/records",
            "/api/files/links",
            "/api/xp/records",
            "/api/notifications",
            "/api/forms/definitions",
            "/api/forms/submissions",
            "/api/integrations/connections",
            "/api/audit",
            "/api/backups",
            "/api/health",
        ]:
            get(path)

        audit_entries = get("/api/audit")
        assert len(audit_entries) >= 20
