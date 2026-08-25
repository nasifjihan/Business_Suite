/**
 * Lightweight date-stamped console logger (no Winston).
 * ------------------------------------------------------------------
 * For a project of this size, a 20-line logger is enough and avoids
 * pulling in Winston/Pino's dependencies. We use ANSI colors if
 * attached to a TTY. All timestamps are UTC ISO 8601.
 */
type LogFn = (message: string, meta?: unknown) => void;

const LEVEL = {
  debug: "\x1b[36m",
  info: "\x1b[32m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
} as const;

const RESET = "\x1b[0m";

function format(level: keyof typeof LEVEL, message: string, meta?: unknown): string {
  const color = LEVEL[level];
  const now = new Date().toISOString();
  const paddedLevel = level.toUpperCase().padEnd(5, " ");
  const prefix = `${color}${now} [${paddedLevel}]${RESET}`;
  const metaStr = meta !== undefined ? ` ${JSON.stringify(meta)}` : "";
  return `${prefix} ${message}${metaStr}`;
}

const write = (level: keyof typeof LEVEL): LogFn =>
  (message, meta) => {
    const line = format(level, message, meta);
    if (level === "error") {
      console.error(line);
    } else if (level === "warn") {
      console.warn(line);
    } else {
      console.log(line);
    }
  };

export const logger = {
  debug: write("debug"),
  info: write("info"),
  warn: write("warn"),
  error: write("error"),
};
