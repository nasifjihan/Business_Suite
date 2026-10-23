"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUploadProductImageMutation } from "@/lib/api/inventoryEndpoints";
import { cn, resolveAssetUrl } from "@/lib/utils";

/**
 * Mirrors the checks in backend/src/lib/uploads.ts. These are a courtesy so an
 * obviously wrong file never leaves the browser — the server repeats both
 * checks and is the only one that actually enforces them.
 */
const ACCEPTED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];
const ACCEPT_ATTRIBUTE = ACCEPTED_MIME_TYPES.join(",");
const MAX_BYTES = 2 * 1024 * 1024;

export interface ImageUploadFieldProps {
  /** The product the image belongs to. Uploading requires an existing row. */
  productId: string;
  /** Stored relative path (`/api/v1/uploads/…`) or null when none is set. */
  currentUrl: string | null | undefined;
  disabled?: boolean;
  /** Called with the new stored path once the upload succeeds. */
  onUploaded?: (url: string) => void;
  className?: string;
}

export function ImageUploadField({
  productId,
  currentUrl,
  disabled,
  onUploaded,
  className,
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadImage, { isLoading }] = useUploadProductImageMutation();
  const [error, setError] = useState<string | null>(null);

  const preview = resolveAssetUrl(currentUrl);

  const pick = () => {
    setError(null);
    inputRef.current?.click();
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Cleared straight away so re-picking the same file still fires onChange.
    e.target.value = "";
    if (!file) return;

    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      setError("Upload a PNG, JPEG or WebP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`Image must be ${MAX_BYTES / (1024 * 1024)} MB or smaller.`);
      return;
    }

    try {
      const out = await uploadImage({ id: productId, file }).unwrap();
      onUploaded?.(out.data.imageUrl ?? "");
    } catch (err) {
      setError(
        (err as { data?: { error?: { message?: string } } }).data?.error?.message ??
          "Failed to upload image."
      );
    }
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="block text-sm font-medium text-foreground">Product image</label>

      <div className="flex items-center gap-3">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-slate-50 dark:bg-slate-900/60 flex items-center justify-center">
          {preview ? (
            /* eslint-disable-next-line @next/next/no-img-element -- uploads are
               served by the API on a different origin in dev, which would need
               a remotePatterns entry for every host; a plain img is simpler. */
            <img
              src={preview}
              alt="Product image"
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <ImagePlus className="w-6 h-6 text-slate-400" />
          )}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={pick}
            disabled={disabled || isLoading}
          >
            {isLoading ? "Uploading…" : preview ? "Replace image" : "Upload image"}
          </Button>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            PNG, JPEG or WebP · up to {MAX_BYTES / (1024 * 1024)} MB. Replacing an
            image deletes the previous file.
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        onChange={handleChange}
        className="hidden"
      />

      {error && (
        <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>
      )}
    </div>
  );
}
