from __future__ import annotations

ROLE_PERMISSIONS = {
    "Admin": {
        "chat": True,
        "history": True,
        "metrics": True,
        "kb_visibility": ["public", "employee", "admin"],
    },
    "Employee": {
        "chat": True,
        "history": True,
        "metrics": False,
        "kb_visibility": ["public", "employee"],
    },
    "Guest": {
        "chat": True,
        "history": False,
        "metrics": False,
        "kb_visibility": ["public"],
    },
}


def get_permissions(role: str | None):
    if role in ROLE_PERMISSIONS:
        return ROLE_PERMISSIONS[role]
    return {
        "chat": True,
        "history": True,
        "metrics": True,
        "kb_visibility": ["public", "employee", "admin"],
    }


def can_access_metrics(role: str | None) -> bool:
    perms = get_permissions(role)
    return bool(perms and perms.get("metrics"))


def can_access_history(role: str | None) -> bool:
    perms = get_permissions(role)
    return bool(perms and perms.get("history"))


def allowed_kb_visibility(role: str | None) -> list[str]:
    perms = get_permissions(role)
    return list(perms["kb_visibility"]) if perms else ["public", "employee", "admin"]
