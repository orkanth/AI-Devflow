from __future__ import annotations

import os
from typing import Any

import httpx

NESTJS_URL = os.getenv("NESTJS_URL", "http://localhost:3333")


class NestJsTools:
    """Workspace writes go through NestJS, never through Python state."""

    def __init__(self, base_url: str = NESTJS_URL) -> None:
        self.base_url = base_url.rstrip("/")

    def _get(self, path: str) -> Any:
        try:
            response = httpx.get(f"{self.base_url}{path}", timeout=4.0)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as error:
            return {"error": str(error)}

    def _send(self, method: str, path: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        try:
            response = httpx.request(
                method,
                f"{self.base_url}{path}",
                json=payload,
                timeout=4.0,
            )
            response.raise_for_status()
            data = response.json()
            return data if isinstance(data, dict) else {"result": data}
        except httpx.HTTPError as error:
            return {"error": str(error), "local": True, **(payload or {})}

    def list_users(self) -> list[dict[str, Any]]:
        data = self._get("/api/users")
        return data if isinstance(data, list) else []

    def list_projects(self) -> list[dict[str, Any]]:
        data = self._get("/api/projects")
        return data if isinstance(data, list) else []

    def list_tasks(self) -> list[dict[str, Any]]:
        data = self._get("/api/tasks")
        return data if isinstance(data, list) else []

    def create_user(self, name: str, email: str, role: str = "engineer") -> dict[str, Any]:
        return self._send("POST", "/api/users", {"name": name, "email": email, "role": role})

    def update_user(self, user_id: str, **fields: Any) -> dict[str, Any]:
        return self._send("PATCH", f"/api/users/{user_id}", fields)

    def delete_user(self, user_id: str) -> dict[str, Any]:
        return self._send("DELETE", f"/api/users/{user_id}")

    def create_project(self, name: str, description: str, owner_id: str) -> dict[str, Any]:
        return self._send(
            "POST",
            "/api/projects",
            {"name": name, "description": description, "ownerId": owner_id},
        )

    def update_project(self, project_id: str, **fields: Any) -> dict[str, Any]:
        payload = {}
        if "name" in fields:
            payload["name"] = fields["name"]
        if "description" in fields:
            payload["description"] = fields["description"]
        if "status" in fields:
            payload["status"] = fields["status"]
        return self._send("PATCH", f"/api/projects/{project_id}", payload)

    def delete_project(self, project_id: str) -> dict[str, Any]:
        return self._send("DELETE", f"/api/projects/{project_id}")

    def create_task(
        self,
        project_id: str,
        title: str,
        description: str,
        assignee_id: str | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "projectId": project_id,
            "title": title,
            "description": description,
            "status": "todo",
            "priority": "medium",
        }
        if assignee_id:
            payload["assigneeId"] = assignee_id
        return self._send("POST", "/api/tasks", payload)

    def update_task(self, task_id: str, **fields: Any) -> dict[str, Any]:
        payload: dict[str, Any] = {}
        mapping = {
            "title": "title",
            "description": "description",
            "status": "status",
            "priority": "priority",
            "assignee_id": "assigneeId",
            "project_id": "projectId",
        }
        for key, api_key in mapping.items():
            if key in fields and fields[key] is not None:
                payload[api_key] = fields[key]
        return self._send("PATCH", f"/api/tasks/{task_id}", payload)

    def delete_task(self, task_id: str) -> dict[str, Any]:
        return self._send("DELETE", f"/api/tasks/{task_id}")

    def analytics(self) -> dict[str, Any]:
        data = self._get("/api/ai/analytics")
        return data if isinstance(data, dict) else {"error": "unavailable"}
