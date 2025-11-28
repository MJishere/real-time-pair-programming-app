// src/store/slices/roomSlice.ts
import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

type Status = "connecting" | "connected" | "closed";

interface RoomState {
  id: string | null;
  status: Status;
}

const initialState: RoomState = {
  id: null,
  status: "connecting",
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
  },
});

export const { setRoomId, setStatus } = roomSlice.actions;
export default roomSlice.reducer;
