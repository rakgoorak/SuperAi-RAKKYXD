import type { ChatItem } from "./CliChat.js";

/** Cheap, fast settings per CLI for guessing the user's next message (shown as grey text in the composer). */
export function predictionSeat(agent: string, sessionModel = ""): { model: string; effort: string } {
  if (agent === "claude-code") return { model: "haiku", effort: "" };
  if (agent === "codex") return { model: sessionModel, effort: "low" };
  return { model: sessionModel, effort: "" };
}

/** The prompt for the last finished turn, or null when there is nothing to continue from. */
export function nextPromptRequest(items: ChatItem[]): string | null {
  const userIndex = items.map(item => item.kind).lastIndexOf("user");
  if (userIndex < 0) return null;
  const turn = items.slice(userIndex + 1);
  if (turn.some(item => item.kind === "error")) return null;
  const reply = turn.filter((item): item is Extract<ChatItem, { kind: "assistant" }> => item.kind === "assistant").map(item => item.text).join("\n\n").trim();
  if (!reply) return null;
  const user = (items[userIndex] as Extract<ChatItem, { kind: "user" }>).text.trim();
  return [
    "You predict what the user will type next to their AI coding assistant.",
    "Reply with ONLY that next message: one short line (under 100 characters), written as the user, in the same language the user writes in.",
    "Prefer a concrete next step the assistant offered or asked about. If there is no clear next step, reply with exactly NONE.",
    "",
    `<user>${user.slice(-1500)}</user>`,
    `<assistant>${reply.slice(-4000)}</assistant>`,
  ].join("\n");
}

/** First usable line of the model's reply, without quotes or labels; "" when it declined. */
export function cleanPrediction(text: string): string {
  const line = text.split(/\r?\n/).map(l => l.trim()).find(Boolean) || "";
  const cleaned = line.replace(/^(?:user|ผู้ใช้)\s*[:：]\s*/i, "").replace(/^["'“”「」]+|["'“”「」]+$/g, "").trim();
  if (!cleaned || /^none\.?$/i.test(cleaned) || cleaned.length > 160) return "";
  return cleaned;
}
