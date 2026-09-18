/**
 * app/api/live-token/route.ts
 *
 * Mints a short-lived ephemeral token so the browser can open a WebSocket
 * straight to the Gemini Live API without ever seeing GEMINI_API_KEY.
 *
 * This is a plain HTTP POST that finishes in ~200 ms, so it deploys as an
 * ordinary Vercel serverless function. The long-lived WebSocket is between the
 * phone and Google -- see the header comment in `lib/live/session.ts` for why.
 *
 * SECURITY POSTURE
 *  - GEMINI_API_KEY is read from the server environment and never serialised.
 *  - The returned token is single-use, only works against the Live API, and
 *    expires quickly (2 minutes to open the socket, 30 minutes of session).
 *  - It is NOT locked to a specific model/config by default. See
 *    LIVE_TOKEN_CONSTRAIN below for the stricter mode.
 *
 * There is no rate limiting here. Before this is public on the internet, put
 * something in front of it (Vercel WAF, or a per-IP counter) -- otherwise it is
 * a free Gemini quota faucet.
 */

import { GoogleGenAI } from "@google/genai";

import { LIVE_CONFIG } from "@/lib/live/config";
import type { LiveTokenErrorResponse, LiveTokenResponse } from "@/lib/live/types";

// Node runtime (the default in Next 16; the Edge runtime is deprecated).
export const runtime = "nodejs";

function jsonError(
  status: number,
  code: LiveTokenErrorResponse["error"]["code"],
  message: string,
  hint?: string,
): Response {
  const body: LiveTokenErrorResponse = { error: { code, message, ...(hint ? { hint } : {}) } };
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

async function mint(): Promise<Response> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return jsonError(
      500,
      "MISSING_API_KEY",
      "GEMINI_API_KEY is not set on the server, so no Live API token can be minted.",
      "Create `.env.local` in the project root with `GEMINI_API_KEY=...` (get a key at https://aistudio.google.com/apikey) and restart `npm run dev`. On Vercel, add it under Project Settings -> Environment Variables and redeploy.",
    );
  }

  const model = process.env.GEMINI_LIVE_MODEL || LIVE_CONFIG.model;

  const now = Date.now();
  const newSessionExpireTime = new Date(now + LIVE_CONFIG.token.newSessionWindowSeconds * 1000).toISOString();
  const expireTime = new Date(now + LIVE_CONFIG.token.lifetimeSeconds * 1000).toISOString();

  const ai = new GoogleGenAI({
    apiKey,
    // Ephemeral tokens exist on v1alpha only. Verified against the SDK source,
    // which warns and changes the socket RPC name based on this value.
    httpOptions: { apiVersion: LIVE_CONFIG.apiVersion },
  });

  try {
    // NB: the accessor is `authTokens`, not `tokens`. The published docs and
    // most blog posts say `ai.tokens.create(...)`; in @google/genai 2.x the
    // `Tokens` module is mounted at `GoogleGenAI.authTokens`. Verified against
    // node_modules/@google/genai/dist/web/web.d.ts and at runtime.
    const token = await ai.authTokens.create({
      config: {
        uses: LIVE_CONFIG.token.uses,
        expireTime,
        newSessionExpireTime,

        // Optional hardening. Off by default because locking the config means
        // the browser's LiveConnectConfig must match this one field-for-field
        // or the API silently ignores the client's values -- which is a nasty
        // class of bug to debug at 2am. Turn it on once the config is stable.
        ...(process.env.LIVE_TOKEN_CONSTRAIN === "1" ? { liveConnectConstraints: { model } } : {}),
      },
    });

    if (!token.name) {
      return jsonError(502, "TOKEN_ENDPOINT_FAILED", "Google returned a token with no name field.");
    }

    const body: LiveTokenResponse = {
      token: token.name,
      model,
      expireTime: token.expireTime ?? expireTime,
      newSessionExpireTime: token.newSessionExpireTime ?? newSessionExpireTime,
      apiVersion: LIVE_CONFIG.apiVersion,
    };

    return Response.json(body, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);

    // Never echo the key back, even inside an upstream error string.
    const safe = raw.split(apiKey).join("[redacted]");

    const looksLikeBadKey = /401|403|API_KEY_INVALID|PERMISSION_DENIED|API key not valid/i.test(safe);
    return jsonError(
      looksLikeBadKey ? 401 : 502,
      looksLikeBadKey ? "MISSING_API_KEY" : "TOKEN_ENDPOINT_FAILED",
      looksLikeBadKey
        ? `Google rejected GEMINI_API_KEY: ${safe}`
        : `Could not mint a Live API token: ${safe}`,
      looksLikeBadKey
        ? "Check the key at https://aistudio.google.com/apikey. Ephemeral tokens are Gemini Developer API only -- a Vertex AI key will not work."
        : `Model in use: ${model}. If this model was retired, set GEMINI_LIVE_MODEL or edit LIVE_CONFIG.model.`,
    );
  }
}

export async function POST(): Promise<Response> {
  return mint();
}

/** GET is allowed purely so you can sanity-check the endpoint in a browser tab. */
export async function GET(): Promise<Response> {
  return mint();
}
