# app/clients/tasks_client.py
from typing import Any, Optional
from app.clients.base_client import BaseNestClient

class TasksClient(BaseNestClient):
    def __init__(self):
        super().__init__("tasks")

    async def create_task(self, title: str, project_id: str, description: Optional[str] = None) -> dict[str, Any]:
        payload = {"title": title.strip(), "projectId": project_id.strip()}
        if description:
            payload["description"] = description.strip()
        return await self.request("POST", json=payload)

tasks_client = TasksClient()