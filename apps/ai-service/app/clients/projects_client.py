# apps/ai-service/app/clients/projects_client.py
from typing import Dict, Any, Optional
from app.clients.base_client import BaseNestClient

class ProjectsClient(BaseNestClient):
    def __init__(self):
        super().__init__(resource_prefix="projects")

    async def create_project(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return await self.request("POST", json=payload)

    async def get_project(self, identifier: str) -> Dict[str, Any]:
        return await self.request("GET", path=identifier)

projects_client = ProjectsClient()