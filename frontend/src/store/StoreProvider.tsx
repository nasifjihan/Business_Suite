/**
 * 'use client' StoreProvider wrapper.
 *
 * Next.js App Router rule: app/layout.tsx is a SERVER component by default,
 * but <Provider> from react-redux REQUIRES hooks/context = ONLY.
 * Wrap <StoreProvider> as a thin 'use client' component so the root Server
 * Component can import and render it safely without turning the whole tree client-side.
 */
"use client";

import { useRef, type ReactNode } from "react";
import { Provider } from "react-redux";
import { makeStore, type AppStore } from "./store";
import { apiSlice } from "@/lib/api/apiSlice";

export default function StoreProvider({ children }: { children: ReactNode }) {
  // Per-request store instance (Next.js SSR safety — never reuse store across requests!)
  const storeRef = useRef<AppStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = makeStore();
    // Prime the apiSlice reducer once (RTK injectEndpoints listeners)
    if ((storeRef.current as AppStore)[apiSlice.reducerPath] !== undefined) {
      // Already mounted by makeStore above.
    }
  }
  return <Provider store={storeRef.current}>{children}</Provider>;
}
