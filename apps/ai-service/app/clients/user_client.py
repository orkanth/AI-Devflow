from typing import Optional, Dict, Any 
from app.clients.base_client import NEST_BASE_URL, BaseNestClient
import httpx
import urllib.parse

class UsersClient(BaseNestClient):
    
    def __init__(self):
        super().__init__("users")
 

    async def find_user(self, identifier: str) -> Optional[Dict[str, Any]]:
        clean_id = identifier.strip().strip('"').strip("'")
        if not clean_id:
            return None

        # 1. Search route: /users/search?query=...
        search_url = f"{self.base_url}/search"
        # 2. Fallback route: /users/by-identifier/... (without duplicated '/users')
        encoded_id = urllib.parse.quote(clean_id, safe="")
        ident_url = f"{self.base_url}/by-identifier/{encoded_id}"

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(search_url, params={"query": clean_id}, headers=self.headers)
                if res.status_code == 200:
                    data = await self._safe_parse_json(res)
                    if isinstance(data, list):
                        return data[0] if data else None
                    if isinstance(data, dict):
                        if "data" in data and isinstance(data["data"], list):
                            return data["data"][0] if data["data"] else None
                        return data

                # Fallback
                res_ident = await client.get(ident_url, headers=self.headers)
                if res_ident.status_code == 200:
                    data_ident = await self._safe_parse_json(res_ident)
                    if isinstance(data_ident, dict) and "data" in data_ident:
                        return data_ident["data"]
                    return data_ident

                return None
        except httpx.RequestError as e:
            print(f"[ERROR] find_user connection error: {e}")
            return None
    async def create_user(self, name: str, email: str, role: str) -> Dict[str, Any]:
        url = f"{self.base_url}"
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
        url = f"{self.base_url}/by-identifier/{identifier.strip()}"
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
   
    async def delete_by_identifier(self, identifier: str) -> Dict[str, Any]:
            """Direct delete endpoint called by /api/users/by-identifier/:identifier"""
            clean_id = urllib.parse.quote(identifier.strip().strip('"\''), safe="")
            url = f"{self.base_url}/by-identifier/{clean_id}"

            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    res = await client.delete(url, headers=self.headers)
                    data = await self._safe_parse_json(res)

                    if res.status_code == 400:
                        return {
                            "success": False,
                            "error": data.get("message") or "Cannot delete user.",
                        }
                    if res.status_code == 404:
                        return {
                            "success": False,
                            "error": f"User with identifier '{identifier}' was not found for deletion.",
                        }
                    if res.status_code >= 400:
                        raw_msg = data.get("message")
                        detail = "; ".join(raw_msg) if isinstance(raw_msg, list) else (raw_msg or res.text)
                        return {
                            "success": False,
                            "error": f"NestJS Error ({res.status_code}): {detail}",
                        }

                    return {"success": True, "data": data}
            except httpx.RequestError as e:
                return {
                    "success": False,
                    "error": f"Could not connect to NestJS backend at {url}: {e}",
                }
    async def delete_user(self, identifier: str) -> Dict[str, Any]:
        clean_id = identifier.strip().strip('"').strip("'")
        
        # 1. Resolve user to get their UUID
        user = await self.find_user(clean_id)
        if not user:
            return {
                "success": False,
                "error": f"User '{clean_id}' was not found in the system."
            }

        user_id = user.get("id") or user.get("_id")
        user_name = user.get("name", clean_id)

        if not user_id:
            return {
                "success": False,
                "error": f"Found user record for '{user_name}', but could not extract a valid ID."
            }

        # 2. Call the verified parametric UUID route: DELETE /users/:id
        url = f"{self.base_url}/{user_id}"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.delete(url, headers=self.headers)
                data = await self._safe_parse_json(res)

                if res.status_code == 400:
                    return {
                        "success": False,
                        "error": data.get("message") or "Cannot delete the last user."
                    }
                if res.status_code == 404:
                    return {
                        "success": False,
                        "error": f"User '{user_name}' (ID: {user_id}) was not found for deletion."
                    }
                if res.status_code >= 400:
                    detail = data.get("message") or res.text
                    return {
                        "success": False,
                        "error": f"NestJS Error ({res.status_code}): {detail}"
                    }

                return {
                    "success": True,
                    "data": {"id": user_id, "name": user_name}
                }
        except httpx.RequestError as e:
            return {
                "success": False,
                "error": f"Could not connect to NestJS backend at {url}: {e}"
            }
    
    async def lookup_user(self, identifier: str) -> Optional[Dict[str, Any]]:
        url = f"{self.base_url}/{identifier}"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(url, headers=self.headers)
                if res.status_code == 200:
                    return await self._safe_parse_json(res)
                return None
        except httpx.RequestError as e:
            print(f"[ERROR] lookup_user connection error: {e}")
            return None

         
users_client = UsersClient()