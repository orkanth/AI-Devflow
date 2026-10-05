# app/clients/tasks_client.py
from typing import Any, Dict, Optional
from app.clients.base_client import BaseNestClient

class TasksClient(BaseNestClient):
    def __init__(self):
        super().__init__(resource_prefix="tasks")

    async def list_tasks(self, project_id: Optional[str] = None) -> Dict[str, Any]:
        """Fetch tasks, optionally filtered by project_id."""
        params = {}
        if project_id:
            # Match the query param key expected by your NestJS controller
            params["projectId"] = str(project_id).strip()

        return await self.request(
            method="GET",
            path="",
            params=params,
        )

tasks_client = TasksClient()