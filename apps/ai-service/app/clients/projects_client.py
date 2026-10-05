# apps/ai-service/app/clients/projects_client.py
from typing import Dict, Any, Optional
from app.clients.base_client import BaseNestClient

class ProjectsClient(BaseNestClient):
    def __init__(self):
        super().__init__(resource_prefix="projects")

    async def create_project(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return await self.request("POST", json=payload)
    
    async def update_project(self, identifier: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        return await self.request("PATCH", path=identifier, json=payload)

    async def get_project(self, identifier: str) -> Dict[str, Any]:
        return await self.request("GET", path=identifier)
    
    async def lookup_project(self, identifier: str) -> dict:
        """Finds a project by ID or Name."""
        return await self.request(
            method="GET",
            path=f"by-identifier/{identifier.strip()}",
        )
        
    async def delete_project(self, project_id: str) -> Dict[str, Any]:
        """Calls DELETE /projects/:id"""
        return await self.request(
            method="DELETE",
            path=project_id.strip(),
        )
projects_client = ProjectsClient()