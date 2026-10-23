/**
 * Product image uploads.
 * ------------------------------------------------------------------
 * Flow: multer buffers the multipart body in memory (capped at
 * CONFIG.uploads.maxBytes) → the buffer is sniffed for a real image signature
 * → only then is it written to disk under a server-generated UUID name.
 *
 * Two deliberate choices worth knowing before you change anything here:
 *
 * 1. memoryStorage, not diskStorage. With diskStorage multer writes the file
 *    FIRST and you inspect it afterwards, so a rejected upload has already
 *    touched the disk and must be unlinked. Since the cap is a couple of MB,
 *    buffering first and writing once is simpler and leaves no orphans.
 *
 * 2. The stored extension comes from the SNIFFED bytes, never from the client
 *    filename or Content-Type. `evil.png` containing a JPEG is stored as
 *    `.jpg` with an image/jpeg Content-Type, so a spoofed extension cannot
 *    produce a file that lies about what it is.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { StatusCodes } from "http-status-codes";
import type { NextFunction, Request, Response } from "express";
import { CONFIG } from "@/config/env";
import { AppError, BadRequestError } from "@/lib/errors";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Every format we accept, in the order they are tested. */
const IMAGE_TYPES = [
  {
    ext: ".png",
    mime: "image/png",
    matches: (b: Buffer) => b.subarray(0, 8).equals(PNG_SIGNATURE),
  },
  {
    ext: ".jpg",
    mime: "image/jpeg",
    // Every JPEG starts with the Start-Of-Image marker FF D8 FF.
    matches: (b: Buffer) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    ext: ".webp",
    mime: "image/webp",
    // RIFF container: "RIFF" + 4 size bytes + "WEBP".
    matches: (b: Buffer) =>
      b.subarray(0, 4).toString("ascii") === "RIFF" &&
      b.subarray(8, 12).toString("ascii") === "WEBP",
  },
] as const;

/** Human-readable list for error messages. */
export const ACCEPTED_IMAGE_TYPES = "PNG, JPEG or WebP";

/**
 * Identify a buffer by its magic bytes. Returns null when the bytes are not a
 * format we accept — including when the client claimed an image mimetype.
 */
export function detectImageType(buffer: Buffer): { ext: string; mime: string } | null {
  if (buffer.length < 12) return null;
  const match = IMAGE_TYPES.find((t) => t.matches(buffer));
  return match ? { ext: match.ext, mime: match.mime } : null;
}

/** The upload directory, created on demand. */
async function ensureUploadDir(): Promise<string> {
  await fs.mkdir(CONFIG.uploads.dir, { recursive: true });
  return CONFIG.uploads.dir;
}

/**
 * Validate and persist an image buffer. Returns the public URL to store in
 * `Product.imageUrl`.
 */
export async function saveImage(buffer: Buffer): Promise<{ url: string; filename: string }> {
  const type = detectImageType(buffer);
  if (!type) {
    throw new BadRequestError(
      `That file is not a valid image. Upload a ${ACCEPTED_IMAGE_TYPES} file.`,
    );
  }

  const dir = await ensureUploadDir();
  const filename = `${randomUUID()}${type.ext}`;
  await fs.writeFile(path.join(dir, filename), buffer);

  return { url: `${CONFIG.uploads.publicPath}/${filename}`, filename };
}

/**
 * Delete a previously saved image. Best-effort: a missing file is not an error,
 * because the goal is "the old image is gone", not "a delete syscall ran".
 */
export async function deleteImageByUrl(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const filename = path.basename(url);
  // basename() already strips any directory component, so a tampered value
  // such as "../../.env" resolves to a name inside the upload dir. The
  // resolve() below is a second, explicit guard.
  const target = path.resolve(CONFIG.uploads.dir, filename);
  if (!target.startsWith(path.resolve(CONFIG.uploads.dir) + path.sep)) return;
  await fs.rm(target, { force: true });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CONFIG.uploads.maxBytes, files: 1 },
});

/**
 * `upload.single(field)` with multer's errors translated into our AppError
 * hierarchy. Without this an oversize file surfaces as a raw MulterError and
 * the central handler reports a 500 for what is really a client mistake.
 */
export function uploadSingleImage(field: string) {
  const middleware = upload.single(field);
  return (req: Request, res: Response, next: NextFunction) => {
    middleware(req, res, (err: unknown) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          const mb = (CONFIG.uploads.maxBytes / (1024 * 1024)).toFixed(1);
          // StatusCodes names 413 REQUEST_TOO_LONG; it is HTTP "Content Too Large".
          return next(new AppError(StatusCodes.REQUEST_TOO_LONG, `Image must be ${mb} MB or smaller.`));
        }
        return next(new BadRequestError(`Upload rejected (${err.code}).`));
      }
      return next(err);
    });
  };
}
