import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.routers import rooms, autocomplete
from app.services.room_manager import room_manager
from app.db import engine
from app.models import Base


app = FastAPI(title="real-time-pair-programming-app")

# Include routers
app.include_router(rooms.router)
app.include_router(autocomplete.router)

# Allow browser requests from frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    # Simple health check
    return {"status": "ok"}

# Auto create tables on startup
@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)


@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):

    try:
        # Delegate accept + initial JSON logic to RoomManager
        await room_manager.join(room_id, websocket)

        # Keep receiving messages from this socket
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            if msg_type == "code_update":
                code = data.get("code", "")
                # Broadcast update to others and persist state
                await room_manager.broadcast_code_update(room_id, code, source_ws=websocket)

    except WebSocketDisconnect:
        # Clean up connection state
        await room_manager.leave(room_id, websocket)
    
    except Exception:
        # Ensure cleanup on unexpected errors
        await room_manager.leave(room_id, websocket)
        raise

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
