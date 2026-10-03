from typing import Any, Optional
from app.clients.base_client import BaseNestClient


class ProjectsClient(BaseNestClient):
    def __init__(self):
        super().__init__("projects")

    async def list_projects(self) -> dict[str, Any]:
        """Fetch all projects."""
        return await self.request("GET")

    async def get_project(self, project_id: str) -> dict[str, Any]:
        """Fetch a single project by ID."""
        return await self.request("GET", path=project_id)

    async def create_project(self, name: str, description: Optional[str] = None) -> dict[str, Any]:
        """Create a new project."""
        payload = {"name": name.strip()}
        if description:
            payload["description"] = description.strip()
        return await self.request("POST", json=payload)

    async def get_project_analytics(self, project_id: str) -> dict[str, Any]:
        """Retrieve analytics and metrics for a specific project."""
        return await self.request("GET", path=f"{project_id}/analytics")


projects_client = ProjectsClient()