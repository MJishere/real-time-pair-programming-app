// src/store/slices/userSlice.ts
import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

interface UserState {
  name: string | null;
  color: string;
}

const initialState: UserState = {
  name: null,
  color: "#4aa3ff",
};

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setUserName(state, action: PayloadAction<string | null>) {
      state.name = action.payload;
    },
    setUserColor(state, action: PayloadAction<string>) {
      state.color = action.payload;
    },
  },
});

export const { setUserName, setUserColor } = userSlice.actions;
export default userSlice.reducer;
