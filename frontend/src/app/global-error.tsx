"use client";

import { Button } from "@/components/ui/button";
import { AlertCircle, RotateCcw, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isDev =
    typeof window !== "undefined" &&
    process.env.NODE_ENV === "development";

  const handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  return (
    <html>
      <body>
        <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center bg-slate-50 dark:bg-slate-950">
          <div className="rounded-xl border border-border bg-card p-8 max-w-lg w-full shadow-sm">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-rose-500/10 text-rose-500 p-4">
                <AlertCircle className="h-12 w-12" />
              </div>
            </div>
            <h2 className="text-3xl font-semibold mt-2">Application error</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Something went wrong while loading Business Suite.
            </p>
            {isDev && error?.message && (
              <p className="text-xs text-muted-foreground italic mt-2 text-left break-words bg-slate-100 dark:bg-slate-900 p-3 rounded-md">
                Details: {error.message}
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6 w-full">
              <Button
                onClick={reset}
                variant="default"
                className="w-full sm:w-auto"
              >
                <RotateCcw className="w-4 h-4 mr-1" /> Reset
              </Button>
              <Button
                onClick={handleReload}
                variant="secondary"
                className="w-full sm:w-auto"
              >
                <RefreshCw className="w-4 h-4 mr-1" /> Reload
              </Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
