import os
import httpx
from typing import Optional, Dict, Any

NEST_BASE_URL = os.getenv("NESTJS_API_URL", "http://localhost:3333/api").rstrip("/")
INTERNAL_KEY = os.getenv("INTERNAL_SERVICE_KEY", "dev-secret-key")


class BaseNestClient:
    def __init__(self, resource_prefix: str = ""):
        root_url = NEST_BASE_URL.rstrip("/")
        
        # Guard: ensure scheme exists
        if not root_url.startswith("http://") and not root_url.startswith("https://"):
            root_url = f"http://{root_url}"
            
        # Guard: ensure /api exists
        if not root_url.endswith("/api") and "/api/" not in root_url:
            root_url = f"{root_url}/api"

        prefix = resource_prefix.strip("/")
        # Result: "http://localhost:3333/api/users"
        self.base_url = f"{root_url}/{prefix}" if prefix else root_url

        self.headers = {
            "x-internal-token": INTERNAL_KEY,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    async def _safe_parse_json(self, res: httpx.Response) -> Any:
        try:
            return res.json()
        except Exception:
            return {"message": res.text or f"HTTP {res.status_code}"}

    async def request(
        self,
        method: str,
        path: str = "",
        params: Optional[Dict[str, Any]] = None,
        json: Optional[Dict[str, Any]] = None,
        timeout: float = 10.0,
    ) -> Dict[str, Any]:
        """Executes an HTTP request against the configured NestJS endpoint.
        
        Args:
            method: HTTP method (GET, POST, PATCH, DELETE, etc.)
            path: Optional subpath (e.g. 'by-identifier/Ravi', 'search')
            params: Optional query parameters
            json: Optional JSON request payload
            timeout: Timeout in seconds
        """
        clean_subpath = path.strip().lstrip("/")
        url = f"{self.base_url}/{clean_subpath}" if clean_subpath else self.base_url

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                res = await client.request(
                    method=method.upper(),
                    url=url,
                    headers=self.headers,
                    params=params,
                    json=json,
                )
                data = await self._safe_parse_json(res)

                if res.status_code >= 400:
                    detail = data.get("message") if isinstance(data, dict) else str(data)
                    return {
                        "success": False,
                        "status_code": res.status_code,
                        "error": detail or f"NestJS Error ({res.status_code})",
                    }

                return {
                    "success": True,
                    "status_code": res.status_code,
                    "data": data,
                }
        except httpx.ConnectError:
            return {
                "success": False,
                "error": f"Could not connect to NestJS backend at {url}. Ensure the service is running.",
            }
        except httpx.TimeoutException:
            return {
                "success": False,
                "error": f"Request to NestJS backend timed out at {url}.",
            }
        except httpx.RequestError as e:
            return {
                "success": False,
                "error": f"HTTP request failed: {str(e)}",
            }