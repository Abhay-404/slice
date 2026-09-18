/**
 * lib/live -- realtime voice layer.
 *
 * Read `lib/live/session.ts` for the architecture decision, and `docs/VOICE.md`
 * for the operational notes.
 *
 *   import { useLiveSession, monsterTools } from "@/lib/live";
 */

export { LIVE_CONFIG, LIVE_MODELS, type LiveConfig } from "./config";
export {
  createMonsterToolRegistry,
  createToolRegistry,
  defineTool,
  monsterTools,
  TOOL_LIMITS,
  type CelebrateArgs,
  type HighlightPartArgs,
  type MonsterToolHandlers,
  type MonsterToolMap,
  type SetFractionArgs,
  type ShadePartsArgs,
} from "./tools";
export { LiveSession, type LiveSessionOptions } from "./session";
export { useLiveSession, type UseLiveSessionArgs, type UseLiveSessionResult } from "./useLiveSession";
export { LiveFailure, toLiveError } from "./errors";
export type {
  ArgsOf,
  LiveError,
  LiveErrorCode,
  LiveEvents,
  LiveStatus,
  LiveTokenErrorResponse,
  LiveTokenResponse,
  LiveTurn,
  ToolCallRecord,
  ToolHandlers,
  ToolParamSchema,
  ToolParamType,
  ToolRegistry,
  ToolResult,
  ToolSpec,
  ToolSpecMap,
} from "./types";
