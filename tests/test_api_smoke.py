import os
import tempfile

db_path = os.path.join(tempfile.gettempdir(), "crewops-pytest.db")
if os.path.exists(db_path):
    os.remove(db_path)
upload_dir = os.path.join(tempfile.gettempdir(), "crewops-test-uploads")
os.environ["DATABASE_URL"] = f"sqlite:///{db_path.replace(os.sep, '/')}"
os.environ["UPLOAD_DIR"] = upload_dir

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
        sensitive_headers = {
            **headers,
            "X-Reauth-Password": "change-me-now",
            "X-Access-Reason": "Automated smoke test",
        }

        me = client.get("/api/auth/me", headers=headers)
        assert me.status_code == 200, me.text
        user_id = me.json()["id"]

        created = {}
        unauth_task = client.post("/api/tasks", json={"title": "Should not save"})
        assert unauth_task.status_code == 401

        def post(path, payload, request_headers=headers):
            response = client.post(path, headers=request_headers, json=payload)
            assert response.status_code < 300, (path, response.status_code, response.text)
            return response.json()

        def get(path, request_headers=headers):
            response = client.get(path, headers=request_headers)
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
        edited_task = client.patch(
            f"/api/tasks/{created['task']['id']}",
            headers=headers,
            json={"title": "Prepare final call sheet", "status": "In Progress"},
        )
        assert edited_task.status_code == 200, edited_task.text
        assert edited_task.json()["title"] == "Prepare final call sheet"
        completed_task = client.patch(
            f"/api/tasks/{created['task']['id']}/status",
            headers=headers,
            params={"status": "Complete"},
        )
        assert completed_task.status_code == 200, completed_task.text
        login_member = client.post("/api/auth/login", data={"username": "member1", "password": "change-me-now"})
        assert login_member.status_code == 200, login_member.text
        member_headers = {"Authorization": f"Bearer {login_member.json()['access_token']}"}
        assigned_user_update = client.patch(
            f"/api/tasks/{created['task']['id']}",
            headers=member_headers,
            json={"status": "In Progress"},
        )
        assert assigned_user_update.status_code == 200, assigned_user_update.text
        other_user = post(
            "/api/users",
            {
                "username": "member2",
                "email": "member2@example.org",
                "display_name": "Member Two",
                "password": "change-me-now",
            },
        )
        login_other = client.post("/api/auth/login", data={"username": other_user["username"], "password": "change-me-now"})
        assert login_other.status_code == 200, login_other.text
        other_headers = {"Authorization": f"Bearer {login_other.json()['access_token']}"}

        hidden_admin_search = client.get("/api/users?q=System", headers=member_headers)
        assert hidden_admin_search.status_code == 200, hidden_admin_search.text
        assert all(row["id"] != user_id for row in hidden_admin_search.json())
        private_message_update = client.patch(
            f"/api/users/{other_user['id']}",
            headers=other_headers,
            json={"message_privacy": "private"},
        )
        assert private_message_update.status_code == 200, private_message_update.text
        hidden_private_search = client.get("/api/users?q=Member Two", headers=member_headers)
        assert hidden_private_search.status_code == 200, hidden_private_search.text
        assert all(row["id"] != other_user["id"] for row in hidden_private_search.json())

        hr_task = post(
            "/api/tasks",
            {"title": "Confidential HR follow-up", "sensitivity": "HR-only", "assignee_ids": [created["member"]["id"]]},
        )
        finance_task = post(
            "/api/tasks",
            {"title": "Confidential finance review", "attached_entity_type": "Finance", "assignee_ids": [created["member"]["id"]]},
        )
        private_task = post("/api/tasks", {"title": "Administrator private task", "visibility": "Private"})
        private_assigned_task = post(
            "/api/tasks",
            {"title": "Member private task", "visibility": "Private", "assignee_ids": [created["member"]["id"]]},
        )
        member_task_ids = {
            row["id"] for row in client.get("/api/tasks?assigned_to_me=false", headers=member_headers).json()
        }
        assert hr_task["id"] not in member_task_ids
        assert finance_task["id"] not in member_task_ids
        assert private_task["id"] not in member_task_ids
        assert private_assigned_task["id"] in member_task_ids

        blocked_task_update = client.patch(
            f"/api/tasks/{created['task']['id']}",
            headers=other_headers,
            json={"status": "Cancelled"},
        )
        assert blocked_task_update.status_code == 403

        xp_setting = client.put(
            "/api/org/settings",
            headers=headers,
            json={
                "key": "xp_settings",
                "category": "settings",
                "value": {"task_default": 5, "attendance_default": 3, "level_thresholds": [0, 10, 20]},
            },
        )
        assert xp_setting.status_code == 200, xp_setting.text

        multi_task = post(
            "/api/tasks",
            {
                "title": "Review production plan",
                "assignee_ids": [created["member"]["id"], other_user["id"]],
                "xp_value": 12,
            },
        )
        assert set(multi_task["assignee_ids"]) == {created["member"]["id"], other_user["id"]}
        member_notifications = get("/api/notifications", member_headers)
        other_notifications = get("/api/notifications", other_headers)
        for notifications in (member_notifications, other_notifications):
            assigned = next(row for row in notifications if row["notification_type"] == "task_assigned" and row["target_id"] == multi_task["id"])
            assert assigned["target_type"] == "task"
            assert assigned["target_url"] == f"#tasks/{multi_task['id']}"

        complete_multi = client.patch(
            f"/api/tasks/{multi_task['id']}/status",
            headers=member_headers,
            params={"status": "Done"},
        )
        assert complete_multi.status_code == 200, complete_multi.text
        assert complete_multi.json()["xp_awarded"] is True
        xp_after_first = get(f"/api/xp/records?user_id={created['member']['id']}")
        task_xp = [row for row in xp_after_first if row["source_entity_id"] == multi_task["id"]]
        assert len(task_xp) == 1
        assert task_xp[0]["amount"] == 12
        member_after_xp = client.get("/api/auth/me", headers=member_headers).json()
        assert member_after_xp["xp_total"] == 12
        assert member_after_xp["level"] == 2

        complete_again = client.patch(
            f"/api/tasks/{multi_task['id']}/status",
            headers=member_headers,
            params={"status": "Done"},
        )
        assert complete_again.status_code == 200, complete_again.text
        assert complete_again.json()["xp_awarded"] is False
        xp_after_second = get(f"/api/xp/records?user_id={created['member']['id']}")
        assert len([row for row in xp_after_second if row["source_entity_id"] == multi_task["id"]]) == 1

        halted_task = post(
            "/api/tasks",
            {"title": "Confirm venue access", "assignee_ids": [created["member"]["id"]]},
        )
        halted_response = client.patch(
            f"/api/tasks/{halted_task['id']}/status",
            headers=member_headers,
            params={"status": "Halted", "reason": "Venue contact has not replied"},
        )
        assert halted_response.status_code == 200, halted_response.text
        halted_row = next(row for row in get("/api/tasks?assigned_to_me=false") if row["id"] == halted_task["id"])
        assert halted_row["halted_reason"] == "Venue contact has not replied"
        assert halted_row["halted_by_id"] == created["member"]["id"]
        creator_notifications = get("/api/notifications")
        halted_notification = next(row for row in creator_notifications if row["notification_type"] == "task_halted" and row["target_id"] == halted_task["id"])
        assert "Venue contact" in halted_notification["body"]
        completed_notification = next(row for row in creator_notifications if row["notification_type"] == "task_completed" and row["target_id"] == multi_task["id"])
        assert completed_notification["target_url"] == f"#tasks/{multi_task['id']}"

        manual_notification = client.post(
            "/api/notifications",
            headers=member_headers,
            json={"user_id": other_user["id"], "title": "Not allowed"},
        )
        assert manual_notification.status_code == 403

        project_manager_tag = next(row for row in get("/api/org/permissions") if row["name"] == "Project Manager")
        group_task = post(
            "/api/tasks",
            {
                "title": "Project manager briefing",
                "assignment_groups": [{"source_type": "permission_tag", "source_id": project_manager_tag["id"]}],
            },
        )
        assert group_task["assignee_ids"] == [created["member"]["id"]]
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
        blocked_finance = client.get("/api/finance/records", headers=headers)
        assert blocked_finance.status_code == 403
        blocked_hr = client.get("/api/hr/records", headers=headers)
        assert blocked_hr.status_code == 403

        created["finance"] = post("/api/finance/records", {"title": "Receipt", "amount": 42.5}, sensitive_headers)
        created["hr"] = post("/api/hr/records", {"user_id": created["member"]["id"], "title": "Private note"}, sensitive_headers)
        created["thread"] = post("/api/messages/threads", {"title": "Production thread", "participant_ids": [created["member"]["id"]]})
        created["message"] = post(f"/api/messages/threads/{created['thread']['id']}/messages", {"body": "Hello"})
        member_message_notifications = get("/api/notifications", member_headers)
        assert any(row["notification_type"] == "message_received" and row["target_id"] == created["thread"]["id"] for row in member_message_notifications)
        member_reply = client.post(
            f"/api/messages/threads/{created['thread']['id']}/messages",
            headers=member_headers,
            json={"body": "Reply from member"},
        )
        assert member_reply.status_code == 200, member_reply.text
        admin_message_notifications = get("/api/notifications")
        assert any(row["notification_type"] == "message_received" and row["target_id"] == created["thread"]["id"] for row in admin_message_notifications)
        created["announcement"] = post("/api/announcements", {"title": "Notice", "body": "Hello crew"})
        created["file"] = post("/api/files/records", {"local_path": "/data/uploads/test.pdf", "original_filename": "test.pdf"})
        upload_response = client.post(
            "/api/files/upload",
            headers=headers,
            data={"label": "Uploaded test", "sensitivity": "Internal"},
            files={"upload": ("upload.txt", b"hello crewops", "text/plain")},
        )
        assert upload_response.status_code < 300, upload_response.text
        created["upload"] = upload_response.json()
        assert os.path.exists(created["upload"]["local_path"])
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
            "/api/org/sensitivity-levels",
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

        for path in ["/api/finance/budget-requests", "/api/finance/records", "/api/hr/records"]:
            get(path, sensitive_headers)

        audit_entries = get("/api/audit")
        assert len(audit_entries) >= 20
