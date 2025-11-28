from fastapi import APIRouter
from app.services.room_manager import room_manager
from app.schemas import CreateRoomResponse

router = APIRouter(prefix="/rooms", tags=["rooms"])

@router.post("/", response_model=CreateRoomResponse)
async def create_room():
    room_id = await room_manager.create_room()
    return { "roomId": room_id}

# Check Valid room id or not
@router.get("/{room_id}")
async def validate_room(room_id: str):
    from app.db import SessionLocal
    from app.models import Room

    with SessionLocal() as db:
        room = db.get(Room, room_id)
        if room:
            return {"valid": True}
        return {"valid": False}
