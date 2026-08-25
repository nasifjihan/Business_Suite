/**
 * Auth Redux slice: holds user + access token in MEMORY (NOT persisted anywhere!).
 *
 * CRITICAL RULE: access token lives ONLY in Redux (volatile memory).
 *   - Closing browser tab = token gone.
 *   - Page reload → /auth/me endpoint hydrates this state if refresh cookie is still valid.
 *   - XSS can read Redux via hooks but only within the 15-minute access TTL.
 *   - Refresh token lives in HttpOnly cookie (see backend utils/cookies.ts);
 *     Redux never touches it.
 */
import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

export type RoleType =
  | "SUPER_ADMIN" | "ADMIN" | "MANAGER"
  | "SALES" | "CASHIER" | "HR" | "VIEWER";

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  avatarUrl: string | null;
  role: RoleType;
  roleId: string | null;
  status: "ACTIVE" | "INACTIVE";
  mustChangePassword: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  permissions: string[];
  isAuthenticated: boolean;
  loading: boolean;          // Login/logout/refresh in progress
  hydrating: boolean;        // True while /auth/me hydration runs on first mount
  forceChangePassword: boolean;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  permissions: [],
  isAuthenticated: false,
  loading: false,
  hydrating: true,
  forceChangePassword: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    /** Called after login OR refresh success. accessToken short-lived. */
    setCredentials(
      state,
      action: PayloadAction<{
        accessToken: string;
        user: AuthUser;
        permissions?: string[];
      }>,
    ) {
      state.accessToken = action.payload.accessToken;
      state.user = action.payload.user;
      state.permissions = action.payload.permissions ?? state.permissions;
      state.isAuthenticated = true;
      state.forceChangePassword = action.payload.user.mustChangePassword;
      state.loading = false;
      state.hydrating = false;
    },
    /** Used after /auth/me (page refresh hydrate) — we may or may not get user back. */
    setHydratedUser(
      state,
      action: PayloadAction<{ user: AuthUser | null; permissions?: string[] }>,
    ) {
      state.user = action.payload.user;
      state.permissions = action.payload.permissions ?? state.permissions;
      state.isAuthenticated = action.payload.user !== null;
      state.forceChangePassword = action.payload.user?.mustChangePassword ?? false;
      state.hydrating = false;
    },
    /** baseQueryWithReauth updates only the access token after a transparent refresh. */
    updateAccessToken(state, action: PayloadAction<string>) {
      state.accessToken = action.payload;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setHydrating(state, action: PayloadAction<boolean>) {
      state.hydrating = action.payload;
    },
    setForceChangePassword(state, action: PayloadAction<boolean>) {
      state.forceChangePassword = action.payload;
    },
    setPermissions(state, action: PayloadAction<string[]>) {
      state.permissions = action.payload;
    },
    /** Logout: wipe EVERYTHING. Backend clears the cookie separately; this is UX cleanup. */
    clearCredentials(state) {
      state.user = null;
      state.accessToken = null;
      state.permissions = [];
      state.isAuthenticated = false;
      state.loading = false;
      state.hydrating = false;
      state.forceChangePassword = false;
    },
  },
});

export const {
  setCredentials,
  setHydratedUser,
  updateAccessToken,
  setLoading,
  setHydrating,
  setForceChangePassword,
  setPermissions,
  clearCredentials,
} = authSlice.actions;

export default authSlice.reducer;
