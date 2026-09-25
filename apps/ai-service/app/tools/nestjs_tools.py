import os
import httpx
from typing import Optional, Dict, Any

NEST_BASE_URL = os.getenv("NESTJS_API_URL", "http://localhost:3333/api")
INTERNAL_KEY = os.getenv("INTERNAL_SERVICE_KEY", "dev-secret-key")

class NestJSClient:
    def __init__(self):
        self.headers = {"x-internal-token": INTERNAL_KEY}

    # --- User Endpoints ---
    async def find_user(self, identifier: str) -> Optional[Dict[str, Any]]:
        async with httpx.AsyncClient(base_url=NEST_BASE_URL) as client:
            res = await client.get("/users/search", params={"query": identifier}, headers=self.headers)
            return res.json() if res.status_code == 200 else None

    async def create_user(self, name: str, email: str, role: str) -> Dict[str, Any]:
        async with httpx.AsyncClient(base_url=NEST_BASE_URL) as client:
            res = await client.post("/users", json={"name": name, "email": email, "role": role}, headers=self.headers)
            if res.status_code == 409:
                detail = res.json().get("message", "")
                if "name" in detail.lower():
                    return {"success": False, "error": f"A user with the name {name} already exists. User creation was not performed."}
                return {"success": False, "error": f"A user with the email {email} already exists. User creation was not performed."}
            if res.status_code >= 400:
                return {"success": False, "error": res.json().get("message", "User creation failed.")}
            return {"success": True, "data": res.json()}

    async def update_user(self, user_id: str, payload: dict) -> Dict[str, Any]:
        async with httpx.AsyncClient(base_url=NEST_BASE_URL) as client:
            res = await client.patch(f"/users/{user_id}", json=payload, headers=self.headers)
            if res.status_code == 409:
                conflicting = payload.get("email") or payload.get("name")
                return {"success": False, "error": f"The identifier {conflicting} is already associated with another user. The update was not performed."}
            if res.status_code >= 400:
                return {"success": False, "error": res.json().get("message", "User update failed.")}
            return {"success": True, "data": res.json()}

    async def delete_user(self, user_id: str) -> Dict[str, Any]:
        async with httpx.AsyncClient(base_url=NEST_BASE_URL) as client:
            res = await client.delete(f"/users/{user_id}", headers=self.headers)
            if res.status_code >= 400:
                return {"success": False, "error": res.json().get("message", "Failed to delete user.")}
            return {"success": True}

    # --- Task & Analytics Endpoints ---
    async def get_tasks(self, project_id: Optional[str] = None) -> list[dict]:
        params = {"projectId": project_id} if project_id else {}
        async with httpx.AsyncClient(base_url=NEST_BASE_URL) as client:
            res = await client.get("/tasks", params=params, headers=self.headers)
            res.raise_for_status()
            return res.json()

    async def create_task(self, title: str, description: str, project_id: str) -> dict:
        payload = {"title": title, "description": description, "projectId": project_id}
        async with httpx.AsyncClient(base_url=NEST_BASE_URL) as client:
            res = await client.post("/tasks", json=payload, headers=self.headers)
            res.raise_for_status()
            return res.json()

    async def get_project_metrics(self, project_id: str) -> dict:
        async with httpx.AsyncClient(base_url=NEST_BASE_URL) as client:
            res = await client.get(f"/projects/{project_id}/analytics", headers=self.headers)
            res.raise_for_status()
            return res.json()

nest_client = NestJSClient()