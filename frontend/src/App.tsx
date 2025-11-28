import { useEffect, useState } from "react";
import Editor from "./components/EditorMonaco";
import { API_URL } from "./config";

import { useDispatch } from "react-redux";
import type { AppDispatch } from "./store/store";
import { setRoomId } from "./store/slices/roomSlice";

export default function App() {
  const dispatch = useDispatch<AppDispatch>();

  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [joinInput, setJoinInput] = useState("");

  // Auto-join if URL is /room/<id>
  useEffect(() => {
    const match = window.location.pathname.match(/^\/room\/([A-Za-z0-9-]+)$/);
    if (match) {
      const id = match[1];
      dispatch(setRoomId(id));      // <-- global state
      setActiveRoomId(id);          // <-- local state for rendering
    }
  }, []);

  // Create a new room
  async function handleCreateRoom() {
    try {
      const res = await fetch(`${API_URL}/rooms/`, { method: "POST" });
      const data = await res.json();
      const id = data.roomId;

      window.history.replaceState({}, "", `/room/${id}`);

      dispatch(setRoomId(id));   // set global redux state
      setActiveRoomId(id);       // set UI state
    } catch (err) {
      console.error("create room failed", err);
      alert("Failed to create room. Check backend.");
    }
  }

  // Join an existing room
  async function handleJoinRoom(raw: string) {
    const id = raw.trim();
    if (!id) {
      alert("Please enter a room ID.");
      return;
    }

    // Validate room exists
    try {
      const res = await fetch(`${API_URL}/rooms/${id}`);
      const data = await res.json();

      if (!data.valid) {
        alert("Invalid room ID. Please check again.");
        return;
      }
    } catch (err) {
      console.error("Error validating room", err);
      alert("Could not validate room. Backend error?");
      return;
    }

    // Valid → join
    window.history.replaceState({}, "", `/room/${id}`);

    dispatch(setRoomId(id));
    setActiveRoomId(id);
  }

  // Leave and return to landing
  function handleLeave() {
    window.history.replaceState({}, "", `/`);
    dispatch(setRoomId(null));
    setActiveRoomId(null);
    setJoinInput("");
    setShowJoinInput(false);
  }

  // Landing Page
  if (!activeRoomId) {
    return (
      <div className="app-landing">
        <div className="landing-card">
          <h1>Real-time Pair Programming</h1>
          <p className="sub">
            Create a room and share the link, or join an existing room.
          </p>

          <div className="button-row">
            <button className="primary-btn" onClick={handleCreateRoom}>
              Create Room
            </button>

            <div style={{ marginLeft: 12 }}>
              {!showJoinInput ? (
                <button
                  className="secondary-btn"
                  onClick={() => setShowJoinInput(true)}
                >
                  Join Room
                </button>
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <input
                    value={joinInput}
                    onChange={(e) => setJoinInput(e.target.value)}
                    placeholder="Paste room ID"
                    aria-label="room-id"
                  />

                  <button
                    className="primary-btn"
                    onClick={() => handleJoinRoom(joinInput.trim())}
                  >
                    Join
                  </button>

                  <button
                    className="secondary-btn"
                    onClick={() => {
                      setShowJoinInput(false);
                      setJoinInput("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Editor view
  return (
    <div style={{ padding: 16 }}>
      <Editor roomId={activeRoomId} onLeave={handleLeave} />
    </div>
  );
}
