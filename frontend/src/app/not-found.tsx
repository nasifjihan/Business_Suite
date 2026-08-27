"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-slate-50 dark:bg-slate-950">
      <div className="text-center max-w-md w-full">
        <div className="text-7xl md:text-8xl font-bold text-slate-700 dark:text-slate-300 tracking-tight">
          404
        </div>
        <h1 className="text-2xl font-semibold mt-4 text-foreground">
          Page not found
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button variant="default" className="w-full">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to dashboard
            </Button>
          </Link>
          <Link href="/" className="w-full sm:w-auto">
            <Button variant="secondary" className="w-full">
              <Home className="w-4 h-4 mr-1" /> Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
