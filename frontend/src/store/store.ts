/**
 * Redux Toolkit root store.
 *
 * PHASE 1: 2 reducers — api.reducer (RTK query cache) + auth (skeleton).
 * PHASE 2-9: UI slices (theme, sidebar collapsed, etc.) added here as needed.
 */
import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query/react";
import { apiSlice } from "@/lib/api/apiSlice";
import authReducer from "@/store/slices/authSlice";

export const makeStore = () =>
  configureStore({
    reducer: {
      [apiSlice.reducerPath]: apiSlice.reducer,
      auth: authReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ serializableCheck: false }).concat(apiSlice.middleware),
    devTools: process.env.NODE_ENV !== "production",
  });

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];

setupListeners(makeStore().dispatch);
