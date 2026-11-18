/**
 * Every message makes the AI read the whole conversation again, so a long chat costs more
 * tokens on every turn. This estimates how much the CLI has to re-read: the text since the last
 * /compact (user and assistant messages and tool output). Thai is about one token per
 * character; other text about four characters per token. An estimate, not the provider's count.
 */
export const LONG_CHAT_TOKENS = 60_000;

interface Item { kind: string; text?: string; output?: string }

export function estimateTokens(text: string): number {
  const thai = (text.match(/[฀-๿]/g) || []).length;
  return Math.round(thai + (text.length - thai) / 4);
}

export function conversationTokens(items: Item[]): number {
  let start = 0;
  items.forEach((item, index) => { if (item.kind === 'user' && /^\/compact\b/i.test((item.text || '').trim())) start = index + 1; });
  return items.slice(start).reduce((sum, item) => sum + estimateTokens(`${item.text || ''}${item.output || ''}`), 0);
}
