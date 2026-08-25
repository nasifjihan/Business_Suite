/**
 * Auth Redux slice — Phase 2 implements login/logout/refresh actions.
 * Phase 1: empty skeleton with unauthenticated. Presence is required by store.ts
 * so <StoreProvider /> can ship today.
 */
import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type AuthState = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
};

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  loading: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<AuthUser | null>) {
      state.user = action.payload;
      state.isAuthenticated = action.payload !== null;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    logout(state) {
      state.user = null;
      state.isAuthenticated = false;
      state.loading = false;
    },
  },
});

export const { setUser, setLoading, logout } = authSlice.actions;
export default authSlice.reducer;
