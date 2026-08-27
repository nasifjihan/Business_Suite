"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { RotateCcw, ArrowLeft, UserCheck } from "lucide-react";

export default function ModuleErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const Icon = UserCheck;
  const isDev =
    typeof window !== "undefined" &&
    process.env.NODE_ENV === "development";

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="rounded-xl border border-border bg-card p-8 max-w-lg w-full shadow-sm">
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-rose-500/10 text-rose-500 p-4">
            <Icon className="h-12 w-12" />
          </div>
        </div>
        <h2 className="text-xl font-semibold mt-2">
          Something went wrong in the HRM module
        </h2>
        <p className="text-sm text-muted-foreground mt-2">
          An unexpected error occurred while loading this page. Try resetting
          the view, or navigate back to the dashboard.
        </p>
        {isDev && error?.message && (
          <p className="text-xs text-muted-foreground italic mt-1">
            Details: {error.message}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6 w-full">
          <Button
            onClick={reset}
            variant="default"
            className="w-full sm:w-auto"
          >
            <RotateCcw className="w-4 h-4 mr-1" /> Reset view
          </Button>
          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button variant="secondary" className="w-full">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
