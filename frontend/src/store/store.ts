/**
 * Redux Toolkit root store.
 *
 * PHASE 1: 2 reducers — api.reducer (RTK query cache) + auth (skeleton).
 * PHASE 2-9: UI slices (theme, sidebar collapsed, etc.) added here as needed.
 */
import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query/react";
import { apiSlice } from "@/lib/api/apiSlice";
import rtkToastMiddleware from "@/lib/api/rtkToastMiddleware";
import authReducer from "@/store/slices/authSlice";

export const makeStore = () =>
  configureStore({
    reducer: {
      [apiSlice.reducerPath]: apiSlice.reducer,
      auth: authReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ serializableCheck: false }).concat(apiSlice.middleware, rtkToastMiddleware),
    devTools: process.env.NODE_ENV !== "production",
  });

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];

// Client-side singleton. For module-level use (outside React tree) call getStoreSingleton().
// This avoids SSR issues (each server request gets its own makeStore via StoreProvider context),
// while still giving us a stable shared store reference in the browser for things like
// the refreshAccessToken helper that runs outside RTK middleware.
let clientSingleton: AppStore | undefined;

export function getStoreSingleton(): AppStore {
  if (typeof window === "undefined") {
    return makeStore();
  }
  if (!clientSingleton) {
    clientSingleton = makeStore();
    setupListeners(clientSingleton.dispatch);
  }
  return clientSingleton;
}

// One-time listener bootstrap using the FIRST created store on client
// (StoreProvider may override with its own instance; listeners are idempotent).
setupListeners(makeStore().dispatch);
