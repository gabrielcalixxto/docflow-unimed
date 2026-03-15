"""API routers."""

from app.routers import admin_catalog, admin_users, auth, documents, files, search, versions

__all__ = [
    "admin_catalog",
    "admin_users",
    "auth",
    "documents",
    "files",
    "search",
    "versions",
]
