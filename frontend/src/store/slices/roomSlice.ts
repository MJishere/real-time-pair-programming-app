// Redux slice for managing room state (id, status, code, remote updates)

import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

type Status = "connecting" | "connected" | "closed";

interface RoomState {
  id: string | null;
  status: Status;
  code: string;
  lastRemoteUpdateAt: number | null;
}

const initialState: RoomState = {
  id: null,
  status: "connecting",
  code: "",
  lastRemoteUpdateAt: null,
};

const roomSlice = createSlice({
  name: "room",
  initialState,
  reducers: {
    setRoomId(state, action: PayloadAction<string | null>) {
      state.id = action.payload;
    },
    setStatus(state, action: PayloadAction<Status>) {
      state.status = action.payload;
    },
    // initial code delivered by server when joining — also set timestamp
    setInitialCode(state, action: PayloadAction<string>) {
      state.code = action.payload ?? "";
      state.lastRemoteUpdateAt = Date.now();   // <-- important: mark when initial arrived
    },
    // remote update broadcast from server
    setRemoteCodeUpdate(state, action: PayloadAction<string>) {
      state.code = action.payload ?? "";
      state.lastRemoteUpdateAt = Date.now();
    },
  },
});

export const { setRoomId, setStatus, setInitialCode, setRemoteCodeUpdate } = roomSlice.actions;
export default roomSlice.reducer;
