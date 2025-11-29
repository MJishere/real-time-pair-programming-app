// Typed versions of useDispatch and useSelector for the Redux store
import { useDispatch, useSelector } from "react-redux";
import type { TypedUseSelectorHook } from "react-redux";
import type { RootState, AppDispatch } from "./store";

// Dispatch with correct AppDispatch type
export const useAppDispatch = () => useDispatch<AppDispatch>();

// Selector with correct RootState type
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
