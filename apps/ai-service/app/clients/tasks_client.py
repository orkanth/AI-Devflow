# app/clients/tasks_client.py
import re
from typing import Any, Dict, List, Optional
from app.clients.base_client import BaseNestClient

UUID_REGEX = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I
)


class TasksClient(BaseNestClient):
    def __init__(self):
        super().__init__(resource_prefix="tasks")

    async def list_tasks(self, project_id: Optional[str] = None) -> Dict[str, Any]:
        """GET /tasks?projectId=...
        Fetch tasks, optionally filtered by project_id.
        """
        params = {}
        if project_id:
            params["projectId"] = str(project_id).strip()

        return await self.request(
            method="GET",
            path="",
            params=params,
        )

    async def get_task(self, task_id: str) -> Dict[str, Any]:
        """GET /tasks/:id
        Retrieve a single task by its UUID.
        """
        clean_id = str(task_id).strip()
        return await self.request(
            method="GET",
            path=f"/{clean_id}",
        )

    async def create_task(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """POST /tasks
        Create a new task using CreateTaskDto payload.
        """
        return await self.request(
            method="POST",
            path="",
            json=payload,
        )

    async def update_task(self, task_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """PATCH /tasks/:id
        Update an existing task with UpdateTaskDto payload.
        """
        clean_id = str(task_id).strip()
        return await self.request(
            method="PATCH",
            path=f"/{clean_id}",
            json=payload,
        )

    async def delete_task(self, task_id: str) -> Dict[str, Any]:
        """DELETE /tasks/:id
        Permanently remove a task by its UUID.
        """
        clean_id = str(task_id).strip()
        return await self.request(
            method="DELETE",
            path=f"/{clean_id}",
        )

    async def lookup_task(self, identifier: str) -> Dict[str, Any]:
        """Helper for AI tools:
        Finds a task by exact UUID (GET /tasks/:id) or by matching
        title case-insensitively across task records (GET /tasks).
        """
        clean_id = str(identifier).strip()
        if not clean_id:
            return {"success": False, "error": "Identifier cannot be empty"}

        # 1. Direct fetch if identifier is a UUID
        if UUID_REGEX.match(clean_id):
            direct_res = await self.get_task(clean_id)
            if direct_res.get("success") and direct_res.get("data"):
                return direct_res

        # 2. Search by title across all tasks
        list_res = await self.list_tasks()
        if not list_res.get("success"):
            return list_res

        tasks_list: List[Dict[str, Any]] = list_res.get("data", [])
        if not isinstance(tasks_list, list):
            return {"success": False, "error": "Invalid tasks response format"}

        target_lower = clean_id.lower()

        # Exact title match
        for item in tasks_list:
            if str(item.get("title", "")).strip().lower() == target_lower:
                return {"success": True, "data": item}

        # Partial/contains match fallback
        for item in tasks_list:
            if target_lower in str(item.get("title", "")).strip().lower():
                return {"success": True, "data": item}

        return {
            "success": False,
            "status_code": 404,
            "error": f"Task '{clean_id}' not found",
        }


tasks_client = TasksClient()