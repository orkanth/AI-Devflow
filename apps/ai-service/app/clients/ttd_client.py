# app/clients/ttd_client.py
from typing import Optional, Dict, Any
from app.clients.base_client import BaseNestClient

class ttdClient(BaseNestClient):
    def __init__(self):
        super().__init__("ttd") 
        
    async def list_projects(self) -> dict[str, Any]:
        """Fetch all projects."""
        return await self.request("GET")

ttd_client = ttdClient()