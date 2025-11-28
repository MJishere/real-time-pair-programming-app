import uuid
import asyncio
from typing import Dict, Set
from fastapi import WebSocket
from app.db import SessionLocal
from app.models import Room

class RoomManager:
    # Manages WebSocket connections and code state per room

    def __init__(self):
        # room_id -> set of WebSocket connections
        self.connections: Dict[str, Set[WebSocket]] = {}
        # room_id -> last-known code string
        self.code_state: Dict[str, str] = {}
        # room_id -> asyncio.Lock to prevent concurrent writes to same room
        self.locks: Dict[str, asyncio.Lock] = {}

    async def create_room(self) -> str:
        # Create new room_id, initialize in-memory state, and persist initial row
        room_id = str(uuid.uuid4())
        self.connections[room_id] = set()
        self.code_state[room_id] = ""
        self.locks[room_id] = asyncio.Lock()

        # Persist initial room row in DB
        with SessionLocal() as db:
            db_room = Room(room_id=room_id, code="")
            db.add(db_room)
            db.commit()

        return room_id

    async def join(self, room_id: str, websocket: WebSocket):
        # Accept the websocket connection
        await websocket.accept()

        # If not present in memory, try load from DB (survive restarts)
        if room_id not in self.connections:
            with SessionLocal() as db:
                db_room = db.get(Room, room_id)
                if db_room:
                    self.code_state[room_id] = db_room.code or ""
                else:
                    self.code_state[room_id] = ""
            # ensure structures exist
            self.connections.setdefault(room_id, set())
            self.locks.setdefault(room_id, asyncio.Lock())

        # Add the websocket connection to the room
        self.connections[room_id].add(websocket)

        # Send initial state to the newly joined client
        await websocket.send_json({
            "type": "initial_state",
            "code": self.code_state.get(room_id, "")
        })

    async def leave(self, room_id: str, websocket: WebSocket):
        # Remove websocket from connections and cleanup empty rooms from memory
        conns = self.connections.get(room_id)
        if conns and websocket in conns:
            conns.remove(websocket)

        # If no more connections, remove in-memory structures to save memory
        if conns is not None and len(conns) == 0:
            self.connections.pop(room_id, None)
            self.code_state.pop(room_id, None)
            self.locks.pop(room_id, None)

    async def broadcast_code_update(self, room_id: str, code: str, source_ws: WebSocket):
        # Update in-memory state, persist to DB and broadcast to other clients in the room.
        # Uses a per-room asyncio.Lock to serialize updates.

        lock = self.locks.setdefault(room_id, asyncio.Lock())
        async with lock:
            # Update in-memory state
            self.code_state[room_id] = code

            # Persist to DB synchronously in a short transaction
            with SessionLocal() as db:
                db_room = db.get(Room, room_id)
                if db_room:
                    db_room.code = code
                else:
                    db_room = Room(room_id=room_id, code=code)
                    db.add(db_room)
                db.commit()

            # Prepare payload and broadcast to other sockets
            payload = {"type": "code_update", "code": code}
            conns = list(self.connections.get(room_id, set()))
            for ws in conns:
                # skip echoing to the source connection
                if ws is source_ws:
                    continue
                try:
                    await ws.send_json(payload)
                except Exception:
                    # Silent ignore: client may have disconnected unexpectedly
                    pass

# Single shared instance used across imports
room_manager = RoomManager()
