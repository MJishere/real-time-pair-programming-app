// Create the Redux store with room + user slices
import { configureStore } from "@reduxjs/toolkit";
import roomReducer from "./slices/roomSlice";
import userReducer from "./slices/userSlice";

export const store = configureStore({
  reducer: {
    room: roomReducer,
    user: userReducer,
  },
});


// Typed helpers for useSelector and useDispatch
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
