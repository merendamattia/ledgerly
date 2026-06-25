// Minimal structured logger. Keeps a single shape across the codebase so logs
// are easy to grep and, later, to ship to an aggregator.
type Level = "debug" | "info" | "warn" | "error";

/**
 * Writes one structured log event to stdout or stderr.
 */
function emit(level: Level, message: string, meta?: Record<string, unknown>) {
  const entry = { ts: new Date().toISOString(), level, message, ...meta };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => emit("debug", message, meta),
  info: (message: string, meta?: Record<string, unknown>) => emit("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => emit("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => emit("error", message, meta),
};
