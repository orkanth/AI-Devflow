import os
import httpx
from typing import Optional, Dict, Any

NEST_BASE_URL = os.getenv("NESTJS_API_URL", "http://localhost:3333/api").rstrip("/")
INTERNAL_KEY = os.getenv("INTERNAL_SERVICE_KEY", "dev-secret-key")

class NestJSClient:
    def __init__(self):
        self.base_url = NEST_BASE_URL
        self.headers = {
            "x-internal-token": INTERNAL_KEY,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    async def _safe_parse_json(self, res: httpx.Response) -> Dict[str, Any]:
        """Safely parses JSON without crashing if response is HTML or text."""
        try:
            return res.json()
        except Exception:
            return {"message": res.text or f"HTTP {res.status_code}"}

    # --- User Endpoints ---
    async def find_user(self, identifier: str) -> Optional[Dict[str, Any]]:
        async with httpx.AsyncClient(base_url=self.base_url) as client:
            res = await client.get("/users/search", params={"query": identifier}, headers=self.headers)
            return res.json() if res.status_code == 200 else None

    async def create_user(self, name: str, email: str, role: str) -> Dict[str, Any]:
        url = f"{self.base_url}/users"
        payload = {"name": name.strip(), "email": email.strip(), "role": role.strip()}

        print(f"\n--- [DEBUG] Outgoing to NestJS ---")
        print(f"URL: {url}")
        print(f"Headers: {self.headers}")
        print(f"Payload: {payload}")

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, json=payload, headers=self.headers)
                print(f"NestJS Status Code: {res.status_code}")
                print(f"NestJS Raw Response: {res.text}")

                data = await self._safe_parse_json(res)

                if res.status_code == 409:
                    detail = data.get("message") or "User or email already exists."
                    return {"success": False, "error": detail}

                if res.status_code >= 400:
                    detail = data.get("message") or res.text
                    return {"success": False, "error": f"NestJS Error ({res.status_code}): {detail}"}

                return {"success": True, "data": data}

        except httpx.ConnectError:
            err = f"Could not connect to NestJS backend at {url}. Make sure NestJS is running."
            print(f"[ERROR] {err}")
            return {"success": False, "error": err}
        except Exception as e:
            print(f"[ERROR] Exception: {str(e)}")
            return {"success": False, "error": f"HTTP request failed: {str(e)}"}

    async def update_user(self, user_id: str, payload: dict) -> Dict[str, Any]:
        async with httpx.AsyncClient(base_url=self.base_url) as client:
            res = await client.patch(f"/users/{user_id}", json=payload, headers=self.headers)
            if res.status_code == 409:
                conflicting = payload.get("email") or payload.get("name")
                return {"success": False, "error": f"The identifier {conflicting} is already associated with another user. The update was not performed."}
            if res.status_code >= 400:
                data = await self._safe_parse_json(res)
                return {"success": False, "error": data.get("message", "User update failed.")}
            return {"success": True, "data": res.json()}

    async def delete_user(self, user_id: str) -> Dict[str, Any]:
        async with httpx.AsyncClient(base_url=self.base_url) as client:
            res = await client.delete(f"/users/{user_id}", headers=self.headers)
            if res.status_code >= 400:
                data = await self._safe_parse_json(res)
                return {"success": False, "error": data.get("message", "Failed to delete user.")}
            return {"success": True}

    # --- Task & Analytics Endpoints ---
    async def get_tasks(self, project_id: Optional[str] = None) -> list[dict]:
        params = {"projectId": project_id} if project_id else {}
        async with httpx.AsyncClient(base_url=self.base_url) as client:
            res = await client.get("/tasks", params=params, headers=self.headers)
            res.raise_for_status()
            return res.json()

    async def create_task(self, title: str, description: str, project_id: str) -> dict:
        payload = {"title": title, "description": description, "projectId": project_id}
        async with httpx.AsyncClient(base_url=self.base_url) as client:
            res = await client.post("/tasks", json=payload, headers=self.headers)
            res.raise_for_status()
            return res.json()

    async def get_project_metrics(self, project_id: str) -> dict:
        async with httpx.AsyncClient(base_url=self.base_url) as client:
            res = await client.get(f"/projects/{project_id}/analytics", headers=self.headers)
            res.raise_for_status()
            return res.json()

nest_client = NestJSClient()