// The AI's ```superai-questions block becomes a choice card when the turn ends (server/Questions.ts);
// while the reply is still streaming, the raw JSON is not shown.
const FENCE = /```superai-questions[^\n]*\n[\s\S]*?```/i;
const OPEN_FENCE = /```superai-questions[\s\S]*$/i;

export function hideQuestionBlock(text: string): string {
  return text.replace(FENCE, '').replace(OPEN_FENCE, '').trimEnd();
}
