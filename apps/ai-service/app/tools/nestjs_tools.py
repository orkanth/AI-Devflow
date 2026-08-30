from __future__ import annotations

import os
from typing import Any

import httpx

NESTJS_URL = os.getenv("NESTJS_URL", "http://localhost:3333")


class NestJsTools:
    """Task agent side-effects go through NestJS, never through Python state."""

    def __init__(self, base_url: str = NESTJS_URL) -> None:
        self.base_url = base_url.rstrip("/")

    def list_projects(self) -> list[dict[str, Any]]:
        try:
            response = httpx.get(f"{self.base_url}/api/projects", timeout=4.0)
            response.raise_for_status()
            data = response.json()
            return data if isinstance(data, list) else []
        except httpx.HTTPError:
            return []

    def create_task(self, project_id: str, title: str, description: str) -> dict[str, Any]:
        payload = {
            "projectId": project_id,
            "title": title,
            "description": description,
            "status": "todo",
            "priority": "medium",
        }
        try:
            response = httpx.post(f"{self.base_url}/api/tasks", json=payload, timeout=4.0)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as error:
            return {"error": str(error), "local": True, **payload}

    def analytics(self) -> dict[str, Any]:
        try:
            response = httpx.get(f"{self.base_url}/api/ai/analytics", timeout=4.0)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as error:
            return {"error": str(error), "source": "unavailable"}
