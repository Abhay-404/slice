/**
 * lib/live/tools.ts
 *
 * Typed tool registry.
 *
 * Contract, in order of importance:
 *
 *  1. Handlers are SYNCHRONOUS. A tool call is applied to React state in the
 *     same tick it arrives off the socket, before we acknowledge the model.
 *     Nothing here may await a network round trip -- that is the entire reason
 *     the UI feels like it is reacting to speech rather than to a request.
 *
 *  2. Every spec validates its own arguments. The model WILL eventually send
 *     `{ partIndex: "the second one" }` or `{ denominator: 0 }`. `parse()` is
 *     the trust boundary; a throw becomes a structured error handed back to the
 *     model ("you passed a bad value, try again") instead of NaN in the DOM.
 *
 *  3. Declarations are plain JSON. No `@google/genai` runtime import, so this
 *     file is safe to load anywhere.
 */

import type {
  ToolCallRecord,
  ToolHandlers,
  ToolRegistry,
  ToolSpec,
  ToolSpecMap,
} from "./types";

/** Identity helper that pins the arg type while keeping inference on the map. */
export function defineTool<TArgs>(spec: ToolSpec<TArgs>): ToolSpec<TArgs> {
  return spec;
}

// ---------------------------------------------------------------------------
// arg validation
// ---------------------------------------------------------------------------

function num(raw: Record<string, unknown>, key: string): number {
  const v = raw[key];
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) {
    throw new Error(`\`${key}\` must be a number, got ${JSON.stringify(v)}`);
  }
  return n;
}

function int(raw: Record<string, unknown>, key: string, min: number, max: number): number {
  const n = Math.round(num(raw, key));
  if (n < min || n > max) {
    throw new Error(`\`${key}\` must be between ${min} and ${max}, got ${n}`);
  }
  return n;
}

// ---------------------------------------------------------------------------
// the four tools the UI wires up
// ---------------------------------------------------------------------------

export interface HighlightPartArgs {
  partIndex: number;
}
export interface ShadePartsArgs {
  count: number;
}
export interface SetFractionArgs {
  numerator: number;
  denominator: number;
}
export type CelebrateArgs = Record<string, never>;

/** Upper bounds exist so a hallucinated `denominator: 10000` can't lock the browser. */
export const TOOL_LIMITS = {
  maxDenominator: 24,
  maxPartIndex: 23,
} as const;

export const monsterTools = {
  highlightPart: defineTool<HighlightPartArgs>({
    name: "highlightPart",
    description:
      "Point at one single piece of the shape on screen so the child can see exactly which piece you mean. " +
      "partIndex is zero-based: 0 is the first piece. Call this whenever you say 'this piece' or 'that one'.",
    parameters: {
      type: "OBJECT",
      properties: {
        partIndex: {
          type: "INTEGER",
          description: `Zero-based index of the piece to point at (0 to ${TOOL_LIMITS.maxPartIndex}).`,
        },
      },
      required: ["partIndex"],
    },
    parse: (raw) => ({ partIndex: int(raw, "partIndex", 0, TOOL_LIMITS.maxPartIndex) }),
  }),

  shadeParts: defineTool<ShadePartsArgs>({
    name: "shadeParts",
    description:
      "Colour in the first N pieces of the shape on screen. Use this while you count pieces out loud, " +
      "so the child sees the number you are saying. Pass 0 to clear the colouring.",
    parameters: {
      type: "OBJECT",
      properties: {
        count: {
          type: "INTEGER",
          description: `How many pieces to colour in, starting from the first (0 to ${TOOL_LIMITS.maxDenominator}).`,
        },
      },
      required: ["count"],
    },
    parse: (raw) => ({ count: int(raw, "count", 0, TOOL_LIMITS.maxDenominator) }),
  }),

  setFraction: defineTool<SetFractionArgs>({
    name: "setFraction",
    description:
      "Change the fraction shown on screen. The denominator is how many equal pieces the shape is cut into, " +
      "the numerator is how many are coloured in. ALWAYS call this before you talk about a new fraction.",
    parameters: {
      type: "OBJECT",
      properties: {
        numerator: {
          type: "INTEGER",
          description: "The top number: how many pieces are coloured in.",
        },
        denominator: {
          type: "INTEGER",
          description: `The bottom number: how many equal pieces in total (1 to ${TOOL_LIMITS.maxDenominator}).`,
        },
      },
      required: ["numerator", "denominator"],
    },
    parse: (raw) => {
      const denominator = int(raw, "denominator", 1, TOOL_LIMITS.maxDenominator);
      const numerator = int(raw, "numerator", 0, denominator);
      return { numerator, denominator };
    },
  }),

  celebrate: defineTool<CelebrateArgs>({
    name: "celebrate",
    description:
      "Throw confetti and make the monster cheer. Call this the moment the child explains something correctly " +
      "or fixes one of your mistakes. Do not overuse it -- it should feel earned.",
    // No parameters. Deliberately omitted rather than sent as an empty OBJECT:
    // some model versions get confused by a required-less empty object schema.
    parse: () => ({}) as CelebrateArgs,
  }),
} as const;

export type MonsterToolMap = typeof monsterTools;
export type MonsterToolHandlers = ToolHandlers<MonsterToolMap>;

// ---------------------------------------------------------------------------
// registry
// ---------------------------------------------------------------------------

/**
 * Binds specs to handlers. `dispatch` is deliberately synchronous and total:
 * it never throws, it returns a record describing what happened, so a bad tool
 * call degrades into a message to the model rather than a dead socket.
 */
export function createToolRegistry<M extends ToolSpecMap>(
  specs: M,
  handlers: ToolHandlers<M>,
): ToolRegistry {
  const byName = new Map<string, { spec: ToolSpec<unknown>; handler: (args: unknown) => unknown }>();
  for (const key of Object.keys(specs) as Array<keyof M & string>) {
    const spec = specs[key];
    byName.set(spec.name, {
      spec,
      handler: handlers[key] as unknown as (args: unknown) => unknown,
    });
  }

  return {
    declarations: Array.from(byName.values()).map(({ spec }) => ({
      name: spec.name,
      description: spec.description,
      ...(spec.parameters ? { parameters: spec.parameters } : {}),
    })),

    dispatch(call): ToolCallRecord {
      const name = call.name ?? "";
      const args = call.args ?? {};
      const entry = byName.get(name);

      if (!entry) {
        return {
          id: call.id,
          name,
          args,
          result: { error: `Unknown tool "${name}".` },
          error: `Unknown tool "${name}".`,
        };
      }

      let parsed: unknown;
      try {
        parsed = entry.spec.parse(args);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          id: call.id,
          name,
          args,
          result: { error: `Invalid arguments: ${message}` },
          error: message,
        };
      }

      try {
        const result = entry.handler(parsed);
        return {
          id: call.id,
          name,
          args: parsed as unknown as Record<string, unknown>,
          result: result ?? { ok: true },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          id: call.id,
          name,
          args: parsed as unknown as Record<string, unknown>,
          result: { error: `Tool failed: ${message}` },
          error: message,
        };
      }
    },
  };
}

/** Convenience for the common case. */
export function createMonsterToolRegistry(handlers: MonsterToolHandlers): ToolRegistry {
  return createToolRegistry(monsterTools, handlers);
}
