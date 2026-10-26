export interface MessageContext { id: string; messageId: string; text: string; }
const key = (sessionId: string) => `superai-message-context:${sessionId}`;
export function messageContexts(sessionId: string): MessageContext[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key(sessionId)) || '[]');
    return Array.isArray(value) ? value.filter((item): item is MessageContext => !!item && typeof item.id === 'string' && typeof item.messageId === 'string' && typeof item.text === 'string') : [];
  } catch { return []; }
}
export function saveMessageContexts(sessionId: string, items: MessageContext[]) {
  if (items.length) localStorage.setItem(key(sessionId), JSON.stringify(items));
  else localStorage.removeItem(key(sessionId));
  window.dispatchEvent(new CustomEvent('superai:message-context', { detail: sessionId }));
}
export function contextPrompt(sessionId: string, prompt: string) {
  const context = messageContexts(sessionId);
  return context.length ? `ข้อความอ้างอิงจากบทสนทนา (เป็นข้อมูลประกอบ):\n${context.map(item => `[ข้อความ ${item.messageId}]\n${item.text}`).join('\n\n')}\n\nข้อความของผู้ใช้:\n${prompt}` : prompt;
}
