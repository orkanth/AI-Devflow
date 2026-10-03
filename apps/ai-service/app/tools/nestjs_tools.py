import os
import httpx
from typing import Optional, Dict, Any

NEST_BASE_URL = os.getenv("NESTJS_API_URL", "http://localhost:3333").rstrip("/")
INTERNAL_KEY = os.getenv("INTERNAL_SERVICE_KEY", "dev-secret-key")


class NestJSClient:
    def __init__(self, base_url: Optional[str] = None):
        self.base_url = (base_url or NEST_BASE_URL).rstrip("/")
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
        clean_id = identifier.strip().strip('"').strip("'")
        url = f"{self.base_url}/users/search"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(url, params={"query": clean_id}, headers=self.headers)
                if res.status_code == 200:
                    return await self._safe_parse_json(res)
                return None
        except httpx.RequestError as e:
            print(f"[ERROR] find_user connection error: {e}")
            return None

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
        except httpx.RequestError as e:
            return {"success": False, "error": f"Could not connect to NestJS backend at {url}: {e}"}

    async def update_user_by_identifier(
        self,
        identifier: str,
        name: Optional[str] = None,
        email: Optional[str] = None,
        role: Optional[str] = None,
    ) -> Dict[str, Any]:
        url = f"{self.base_url}/users/by-identifier/{identifier.strip()}"
        payload = {}
        if name:
            payload["name"] = name.strip()
        if email:
            payload["email"] = email.strip()
        if role:
            payload["role"] = role.strip()

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.patch(url, json=payload, headers=self.headers)
                data = await self._safe_parse_json(res)

                if res.status_code == 409:
                    detail = data.get("message") or "The identifier is already associated with another user."
                    return {"success": False, "error": detail}
                if res.status_code == 404:
                    detail = data.get("message") or f"User with identifier '{identifier}' was not found."
                    return {"success": False, "error": detail}
                if res.status_code >= 400:
                    detail = data.get("message") or res.text
                    return {"success": False, "error": f"NestJS Error ({res.status_code}): {detail}"}

                return {"success": True, "data": data}
        except httpx.RequestError as e:
            return {"success": False, "error": f"Could not connect to NestJS backend at {url}: {e}"}

    async def delete_user(self, user_id: str) -> Dict[str, Any]:
        url = f"{self.base_url}/users/{user_id}"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.delete(url, headers=self.headers)
                if res.status_code >= 400:
                    data = await self._safe_parse_json(res)
                    return {"success": False, "error": data.get("message", "Failed to delete user.")}
                return {"success": True}
        except httpx.RequestError as e:
            return {"success": False, "error": f"Could not connect to NestJS backend at {url}: {e}"}

    async def lookup_user(self, identifier: str) -> Optional[Dict[str, Any]]:
        url = f"{self.base_url}/users/{identifier}"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(url, headers=self.headers)
                if res.status_code == 200:
                    return await self._safe_parse_json(res)
                return None
        except httpx.RequestError as e:
            print(f"[ERROR] lookup_user connection error: {e}")
            return None


nest_client = NestJSClient()