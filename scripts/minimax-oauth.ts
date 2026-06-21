#!/usr/bin/env node
/**
 * MiniMax OAuth Device Code Flow setup
 *
 * Usage:
 *   npx tsx scripts/minimax-oauth.ts
 *   # or on Windows:
 *   cmd /c "npx tsx scripts\minimax-oauth.ts"
 */

import { randomBytes, createHash } from "node:crypto";
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const MINIMAX_CLIENT_ID = "78257093-7e40-4613-99e0-527b14b39113";
const MINIMAX_OAUTH_SCOPE = "group_id profile model.completion";
const MINIMAX_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";
const OAUTH_BASE = "https://account.minimax.io";
const PROJECT_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const TOKEN_FILE = join(PROJECT_ROOT, "minimax-oauth-token.json");

const LOG_FILE = join(PROJECT_ROOT, "scripts", "minimax-oauth.trace.log");

function trace(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  try {
    writeFileSync(LOG_FILE, line + "\n", { flag: "a" });
  } catch { /* ignore */ }
}

function base64url(buf: Buffer): string {
  return buf.toString("base64url").replace(/=+$/, "");
}

function generatePkce() {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  const state = base64url(randomBytes(16));
  return { verifier, challenge, state };
}

async function requestDeviceCode(challenge: string, state: string) {
  const url = `${OAUTH_BASE}/oauth2/device/code`;
  const body = new URLSearchParams({
    client_id: MINIMAX_CLIENT_ID,
    scope: MINIMAX_OAUTH_SCOPE,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Device code request failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as {
    user_code: string;
    verification_uri: string;
    expired_in: number;
    interval?: number;
    state: string;
    error?: string;
  };

  if (data.error || !data.user_code || !data.verification_uri) {
    throw new Error(`Invalid device code response: ${JSON.stringify(data)}`);
  }

  if (data.state !== state) {
    throw new Error("State mismatch — possible CSRF");
  }

  // MiniMax returns expired_in as relative seconds OR absolute ms.
  const now = Date.now();
  let expiresAtMs: number;
  if (data.expired_in < 1_000_000_000) {
    expiresAtMs = now + data.expired_in * 1000; // relative seconds → add to now
  } else if (data.expired_in < 1_000_000_000_000) {
    expiresAtMs = data.expired_in * 1000; // absolute seconds → convert to ms
  } else {
    expiresAtMs = data.expired_in; // already absolute ms
  }

  return {
    userCode: data.user_code,
    verificationUrl: data.verification_uri,
    expiresAtMs,
    intervalMs: (data.interval ?? 2) * 1000,
  };
}

async function pollToken(
  userCode: string,
  verifier: string,
): Promise<{
  access: string;
  refresh: string;
  expiresAtMs: number;
}> {
  const url = `${OAUTH_BASE}/oauth2/token`;
  const body = new URLSearchParams({
    grant_type: MINIMAX_GRANT_TYPE,
    client_id: MINIMAX_CLIENT_ID,
    user_code: userCode,
    code_verifier: verifier,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  const text = await res.text();
  let payload: any;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`Token endpoint returned non-JSON: ${text}`);
  }

  console.log(`[poll] HTTP ${res.status} — body: ${text.slice(0, 500)}`);
  trace(`poll HTTP=${res.status} body=${text.slice(0, 500)}`);

  if (!res.ok) {
    const msg = payload?.base_resp?.status_msg ?? text;
    throw new Error(`Token request failed: ${msg}`);
  }

  if (payload.status === "error") {
    throw new Error(payload.base_resp?.status_msg || "OAuth error");
  }

  if (payload.status !== "success") {
    console.log(`[poll] status=${payload.status} → still pending`);
    return null as any; // pending
  }

  const access = payload.access_token;
  const refresh = payload.refresh_token;
  const expiredIn = payload.expired_in;

  if (!access || !refresh || expiredIn === undefined) {
    throw new Error("Incomplete token payload");
  }

  // Normalize expiry: MiniMax returns relative seconds (<1B) or absolute ms (>1T)
  const now = Date.now();
  let expiresAtMs: number;
  if (expiredIn < 1_000_000_000) {
    expiresAtMs = now + expiredIn * 1000;
  } else if (expiredIn < 1_000_000_000_000) {
    expiresAtMs = expiredIn * 1000;
  } else {
    expiresAtMs = expiredIn;
  }

  return { access, refresh, expiresAtMs };
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<number> {
  trace("=== MiniMax OAuth Setup ===");
  console.log("=== MiniMax OAuth Setup ===\n");

  if (existsSync(TOKEN_FILE)) {
    const existing = JSON.parse(readFileSync(TOKEN_FILE, "utf-8"));
    if (existing.expiresAtMs > Date.now() + 60_000) {
      console.log("Token already valid until", new Date(existing.expiresAtMs).toISOString());
      console.log("Delete", TOKEN_FILE, "to re-authenticate.");
      return 0;
    }
  }

  const { verifier, challenge, state } = generatePkce();
  trace("requesting device code...");
  const { userCode, verificationUrl, expiresAtMs, intervalMs } = await requestDeviceCode(
    challenge,
    state,
  );
  trace(`device code received, userCode=${userCode} expiresAt=${expiresAtMs}`);

  console.log("1. Open this URL in your browser:");
  console.log("   ", verificationUrl);
  console.log("");
  console.log("2. Log in with your MiniMax account (or Google)");
  console.log("");
  console.log("3. When prompted, enter this code:");
  console.log("   >>>", userCode, "<<<");
  console.log("");
  console.log("4. Authorize Koru to access your MiniMax account.");
  console.log("");
  console.log("Waiting for authorization... (expires at", new Date(expiresAtMs).toISOString() + ")");

  let interval = intervalMs;
  const deadline = expiresAtMs;

  while (Date.now() < deadline) {
    await sleep(interval);
    process.stdout.write(".");

    try {
      const token = await pollToken(userCode, verifier);
      if (token) {
        process.stdout.write("\n");
        const record = {
          accessToken: token.access,
          refreshToken: token.refresh,
          expiresAtMs: token.expiresAtMs,
          obtainedAt: Date.now(),
        };
        writeFileSync(TOKEN_FILE, JSON.stringify(record, null, 2));
        const msg = `✅ OAuth successful! Token saved to: ${TOKEN_FILE}`;
        trace(msg);
        console.log("\n" + msg);
        console.log("   Expires at:", new Date(token.expiresAtMs).toISOString());
        return 0;
      }
      // pending — continue polling
    } catch (err: any) {
      process.stdout.write("\n");
      const msg = `❌ OAuth failed: ${err.message}`;
      trace(msg);
      console.error("\n" + msg);
      return 1;
    }

    interval = Math.max(interval, 2000);
  }

  process.stdout.write("\n");
  const msg = "⏰ OAuth timed out. Please run the script again.";
  trace(msg);
  console.error("\n" + msg);
  return 1;
}

main().then((code) => {
  trace(`script ended with code ${code}`);
  process.exit(code);
}).catch((e) => {
  trace(`Fatal error: ${e.message}`);
  console.error("Fatal error:", e.message);
  process.exit(1);
});
