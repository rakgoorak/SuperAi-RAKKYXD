/** Structured CLI events used by team runs. Missing fields remain unknown. */
export interface TokenUsage {
  input?: number;
  cachedInput?: number;
  cacheWrite?: number;
  output?: number;
  /** Claude reports uncached input separately; Codex includes cached input in input. */
  inputIncludesCache?: boolean;
}

const count = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;

export function createCliRunStream(id: string, onChunk: (text: string) => void) {
  let output = '', usage: TokenUsage | undefined, error: string | undefined, finished = false;
  const seen = new Set<string>();
  const emit = (text: unknown, key: string) => {
    if (typeof text !== 'string' || !text || seen.has(key)) return;
    seen.add(key); output += text; onChunk(text);
  };
  const line = (raw: string) => {
    let event: any;
    try { event = JSON.parse(raw); } catch { return; }
    if (id === 'codex') {
      if (event.type === 'item.completed' && event.item?.type === 'agent_message') emit(event.item.text, String(event.item.id));
      if (event.type === 'turn.failed' || event.type === 'error') error = String(event.error?.message || event.message || 'Codex ทำงานไม่สำเร็จ');
      if (event.type === 'turn.completed' && event.usage && typeof event.usage === 'object') {
        const u = event.usage;
        const values = { input: count(u.input_tokens), cachedInput: count(u.cached_input_tokens), output: count(u.output_tokens), inputIncludesCache: true };
        if (values.input !== undefined || values.cachedInput !== undefined || values.output !== undefined) usage = values;
      }
      if (event.type === 'turn.completed') finished = true;
    } else if (id === 'claude-code') {
      if (event.parent_tool_use_id) return;
      if (event.type === 'assistant') (Array.isArray(event.message?.content) ? event.message.content : []).forEach((block: any, i: number) => {
        if (block.type === 'text') emit(block.text, `${event.message?.id}:${i}`);
      });
      if (event.type === 'result') {
        finished = true;
        if (event.is_error || event.subtype !== 'success') error = String(event.result || event.subtype || 'Claude ทำงานไม่สำเร็จ');
        if (!error && !output) emit(event.result, 'result');
        const u = event.usage;
        if (u && typeof u === 'object') {
          const values = { input: count(u.input_tokens), cachedInput: count(u.cache_read_input_tokens), cacheWrite: count(u.cache_creation_input_tokens), output: count(u.output_tokens), inputIncludesCache: false };
          if (values.input !== undefined || values.cachedInput !== undefined || values.cacheWrite !== undefined || values.output !== undefined) usage = values;
        }
      }
    }
  };
  return { line, result: () => ({ text: output.trim(), usage, error, finished }) };
}
