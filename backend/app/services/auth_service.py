from fastapi import HTTPException, Header
from firebase_admin import auth


async def verify_firebase_token(authorization: str = Header(...)) -> str:
    """Verify Firebase ID token from Authorization header.

    Expected format: "Bearer <id_token>"
    Returns the user's UID.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header format")

    token = authorization.replace("Bearer ", "")

    try:
        decoded = auth.verify_id_token(token)
        return decoded["uid"]
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid or expired token: {str(e)}")
