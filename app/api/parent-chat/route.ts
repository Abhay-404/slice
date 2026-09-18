import { NextResponse } from "next/server";

/**
 * A parent asks about their child; the model answers from the child's actual
 * record — which topics, how many stars, what they said when they slipped.
 * Nothing is stored server-side: the page sends the record with each turn.
 */
const MODEL = process.env.PARENT_CHAT_MODEL ?? "gemini-3.8-flash";

type Msg = { role: "parent" | "tutor"; text: string };

type Summary = {
  name: string;
  grade: string;
  xp: number;
  streak: number;
  topics: {
    title: string;
    ccss: string;
    done: boolean;
    stars: number;
    hints: number;
    minutes: number;
    reviewBest: number | null;
    answers: { asked: string; said: string; correct: boolean }[];
  }[];
};

function system(s: Summary): string {
  const lines = s.topics.map((t) => {
    const right = t.answers.filter((a) => a.correct).length;
    const wrong = t.answers.filter((a) => !a.correct);
    return [
      `- ${t.title} (${t.ccss}): ${t.done ? `done, ${t.stars}/3 stars, ${t.hints} hint${t.hints === 1 ? "" : "s"}, ${right}/${t.answers.length} answers right, ~${t.minutes} min` : "not started"}` +
        (t.reviewBest !== null ? `, review ${Math.round(t.reviewBest * 100)}%` : ""),
      ...wrong.slice(-3).map((a) => `    slipped on "${a.asked}" — said "${a.said}"`),
    ].join("\n");
  });

  return [
    `You are the maths tutor from a children's app, talking to a PARENT about their child, ${s.name} (Grade ${s.grade}).`,
    "Be warm, specific and short — two or three sentences unless they ask for detail. Talk about what the",
    "child actually did and said; quote their words when useful. Never invent things not in the record.",
    "If asked what to practise, give ONE concrete thing to do at home, with real objects (food, coins, toys).",
    "Never diagnose or label the child. Never mention being an AI.",
    "",
    `THE RECORD (${s.xp} XP, ${s.streak}-day streak):`,
    ...lines,
    "",
    "If the record is empty, say so plainly and suggest they let the child try the first topic.",
  ].join("\n");
}

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "GEMINI_API_KEY is not set." }, { status: 500 });

  let body: { messages?: Msg[]; summary?: Summary };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }
  const messages = (body.messages ?? []).slice(-12);
  const summary = body.summary;
  if (!summary || !messages.length) return NextResponse.json({ error: "Nothing to answer." }, { status: 400 });

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system(summary) }] },
      contents: messages.map((m) => ({ role: m.role === "parent" ? "user" : "model", parts: [{ text: m.text }] })),
      generationConfig: { temperature: 0.4, maxOutputTokens: 400 },
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return NextResponse.json({ error: "Couldn't reach the tutor.", detail: detail.slice(0, 300) }, { status: 502 });
  }
  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  return NextResponse.json({ text: text.trim() || "I don't have anything on that yet." });
}
