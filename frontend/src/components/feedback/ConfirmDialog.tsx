"use client";

import { Button } from "@/components/ui/button";
import { GlobalModal } from "@/components/feedback/GlobalModal";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ConfirmVariant = "destructive" | "primary" | "secondary";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  icon?: React.ReactNode;
  confirmButtonClassName?: string;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title = "Are you sure?",
  description = "This action cannot be undone.",
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "destructive",
  loading,
  onConfirm,
  icon,
  confirmButtonClassName,
}: ConfirmDialogProps) {
  const variantClass =
    variant === "destructive"
      ? "destructive"
      : variant === "primary"
      ? "default"
      : "secondary";

  const iconToneClass =
    variant === "destructive"
      ? "bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400"
      : variant === "primary"
      ? "bg-primary/10 text-primary"
      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200";

  async function handleConfirm() {
    const res = onConfirm();
    if (res && typeof (res as Promise<void>).then === "function") {
      await res;
    }
    onOpenChange(false);
  }

  return (
    <GlobalModal
      title={title}
      description={description}
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      showCloseButton={false}
      dismissable={!loading}
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelText}
          </Button>
          <Button
            variant={variantClass as any}
            disabled={loading}
            onClick={handleConfirm}
            className={confirmButtonClassName}
          >
            {loading ? "Please wait..." : confirmText}
          </Button>
        </>
      }
    >
      <div className="flex gap-4 items-start">
        <div
          className={cn(
            "flex-shrink-0 flex h-11 w-11 items-center justify-center rounded-full",
            iconToneClass
          )}
        >
          {icon ?? <AlertTriangle className="w-5 h-5" />}
        </div>
        <div className="flex-1 space-y-2">
          <h3 className="text-base font-semibold leading-tight text-foreground">
            {title}
          </h3>
          {description && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>
    </GlobalModal>
  );
}
