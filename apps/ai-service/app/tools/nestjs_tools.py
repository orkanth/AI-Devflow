# apps/ai-service/app/tools/nestjs_tools.py
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
        try:
            return res.json()
        except Exception:
            return {"message": res.text or f"HTTP {res.status_code}"}

    async def find_user(self, identifier: str) -> Optional[Dict[str, Any]]:
        async with httpx.AsyncClient(base_url=self.base_url) as client:
            res = await client.get("/users/search", params={"query": identifier}, headers=self.headers)
            return res.json() if res.status_code == 200 else None

    async def create_user(self, name: str, email: str, role: str) -> Dict[str, Any]:
        url = f"{self.base_url}/users"
        payload = {"name": name.strip(), "email": email.strip(), "role": role.strip()}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, json=payload, headers=self.headers)
                data = await self._safe_parse_json(res)
                if res.status_code == 409:
                    detail = data.get("message") or "User or email already exists."
                    return {"success": False, "error": detail}
                if res.status_code >= 400:
                    detail = data.get("message") or res.text
                    return {"success": False, "error": f"NestJS Error ({res.status_code}): {detail}"}
                return {"success": True, "data": data}
        except Exception as e:
            return {"success": False, "error": f"Failed to connect to backend: {str(e)}"}

    async def update_user_by_identifier(
        self,
        identifier: str,
        name: Optional[str] = None,
        email: Optional[str] = None,
        role: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Updates a user looked up by their name or email."""
        url = f"{self.base_url}/users/by-identifier/{identifier.strip()}"
        payload = {}
        if name:
            payload["name"] = name.strip()
        if email:
            payload["email"] = email.strip()
        if role:
            payload["role"] = role.strip()

        print(f"\n--- [DEBUG] Update to NestJS ---")
        print(f"URL: {url}")
        print(f"Payload: {payload}")

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.patch(url, json=payload, headers=self.headers)
                print(f"NestJS Status Code: {res.status_code}")
                print(f"NestJS Response: {res.text}")
                data = await self._safe_parse_json(res)

                # 409 Conflict (duplicate email or name)
                if res.status_code == 409:
                    detail = data.get("message") or "The identifier is already associated with another user."
                    return {"success": False, "error": detail}

                # 404 Not Found
                if res.status_code == 404:
                    detail = data.get("message") or f"User with identifier '{identifier}' was not found."
                    return {"success": False, "error": detail}

                # General errors
                if res.status_code >= 400:
                    detail = data.get("message") or res.text
                    return {"success": False, "error": f"NestJS Error ({res.status_code}): {detail}"}

                return {"success": True, "data": data}
        except httpx.ConnectError:
            return {"success": False, "error": f"Could not connect to NestJS backend at {url}."}
        except Exception as e:
            return {"success": False, "error": f"Failed to connect to backend: {str(e)}"}

    async def update_user(self, user_id: str, payload: dict) -> Dict[str, Any]:
        async with httpx.AsyncClient(base_url=self.base_url) as client:
            res = await client.patch(f"/users/{user_id}", json=payload, headers=self.headers)
            if res.status_code == 409:
                conflicting = payload.get("email") or payload.get("name")
                return {"success": False, "error": f"The identifier {conflicting} is already associated with another user."}
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

nest_client = NestJSClient()