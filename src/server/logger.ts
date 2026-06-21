// @ts-nocheck
/**
 * Simple file logger for backend diagnostics.
 * Writes append-only JSON lines to logs/koru-backend.log
 */
import { appendFileSync, mkdirSync } from "node:fs";

const LOG_DIR = "./logs";
const LOG_FILE = "./logs/koru-backend.log";

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

function write(level: LogLevel, tag: string, message: string, extra?: Record<string, unknown>) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    tag,
    message,
    ...(extra ?? {}),
  };
  const line = JSON.stringify(entry) + "\n";
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(LOG_FILE, line);
  } catch {
    // ignore logging failures
  }
  const prefix = `[${level}] ${tag}:`;
  if (level === "ERROR") console.error(prefix, message, extra ? JSON.stringify(extra).slice(0, 300) : "");
  else if (level === "WARN") console.warn(prefix, message);
  else console.log(prefix, message);
}

export const logger = {
  debug: (tag: string, message: string, extra?: Record<string, unknown>) => write("DEBUG", tag, message, extra),
  info: (tag: string, message: string, extra?: Record<string, unknown>) => write("INFO", tag, message, extra),
  warn: (tag: string, message: string, extra?: Record<string, unknown>) => write("WARN", tag, message, extra),
  error: (tag: string, message: string, extra?: Record<string, unknown>) => write("ERROR", tag, message, extra),
};
