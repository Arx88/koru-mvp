// @ts-nocheck
/**
 * File logger for backend diagnostics.
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
  const extraStr = extra ? JSON.stringify(extra).slice(0, 500) : "";
  if (level === "ERROR") console.error(prefix, message, extraStr);
  else if (level === "WARN") console.warn(prefix, message, extraStr);
  else console.log(prefix, message, extraStr);
}

/** Serialize any value to string, truncating if too large. */
export function dump(value: unknown, maxLen = 1500): string {
  let s: string;
  try {
    if (typeof value === "string") s = value;
    else if (value === undefined) s = "undefined";
    else if (value === null) s = "null";
    else s = JSON.stringify(value);
  } catch {
    s = String(value);
  }
  if (s.length > maxLen) return s.slice(0, maxLen) + " …[truncated]";
  return s;
}

export const logger = {
  debug: (tag: string, message: string, extra?: Record<string, unknown>) => write("DEBUG", tag, message, extra),
  info: (tag: string, message: string, extra?: Record<string, unknown>) => write("INFO", tag, message, extra),
  warn: (tag: string, message: string, extra?: Record<string, unknown>) => write("WARN", tag, message, extra),
  error: (tag: string, message: string, extra?: Record<string, unknown>) => write("ERROR", tag, message, extra),
};
