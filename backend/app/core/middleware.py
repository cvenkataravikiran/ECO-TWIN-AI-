from typing import Any


class NormalizeApiPathMiddleware:
    def __init__(self, app: Any):
        self.app = app

    async def __call__(self, scope: dict[str, Any], receive: Any, send: Any) -> None:
        if scope["type"] == "http" and scope["path"].startswith("/api/"):
            path = scope["path"]
            while "//" in path:
                path = path.replace("//", "/")

            if path != scope["path"]:
                scope = dict(scope)
                scope["path"] = path
                raw_path = scope.get("raw_path")
                if raw_path is not None:
                    while b"//" in raw_path:
                        raw_path = raw_path.replace(b"//", b"/")
                    scope["raw_path"] = raw_path

        await self.app(scope, receive, send)
