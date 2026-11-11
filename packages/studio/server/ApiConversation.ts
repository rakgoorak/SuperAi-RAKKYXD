import { createDefaultTools, type LLMProvider, type LLMMessage } from '@superai-rakkyxd/core';
import type { NewItem } from './CliChat.js';

export async function runApiConversation(options: {
  provider: LLMProvider; cwd: string; signal: AbortSignal; prefix: string; permission: string;
  history: { kind: string; text?: string }[]; system?: string; onItem: (item: NewItem) => void;
}) {
  const { provider, cwd, signal, prefix, onItem } = options;
  const tools = createDefaultTools().filter(tool => options.permission === 'auto' ||
    (options.permission === 'edit' ? tool.name !== 'bash' && tool.name !== 'git' : ['view_file', 'glob_search', 'grep_search'].includes(tool.name)));
  const messages: LLMMessage[] = [
    { role: 'system', content: `คุณคือผู้ช่วยใน SuperAi ตอบตามภาษาของผู้ใช้ ใช้เครื่องมือที่มีจริงเท่านั้น ตรวจผลก่อนรายงานว่าเสร็จ\n${options.system || ''}` },
    ...options.history.filter(item => ['user', 'assistant'].includes(item.kind) && item.text?.trim()).slice(-40)
      .map(item => ({ role: item.kind as 'user' | 'assistant', content: item.text! })),
  ];
  const emit = (item: NewItem) => { if (!signal.aborted) onItem(item); };
  for (let step = 0; step < 20; step++) {
    signal.throwIfAborted();
    let text = '';
    const response = await provider.stream(messages, chunk => {
      text += chunk;
      emit({ id: `${prefix}-api-${step}`, kind: 'assistant', text });
    }, tools);
    signal.throwIfAborted();
    if (response.text) emit({ id: `${prefix}-api-${step}`, kind: 'assistant', text: response.text });
    if (response.usage) emit({ id: `${prefix}-api-usage-${step}`, kind: 'notice', text: `Token จาก provider: input ${response.usage.promptTokens} · output ${response.usage.completionTokens}` });
    if (!response.toolCalls?.length) {
      if (!response.text.trim()) throw new Error('ผู้ให้บริการส่งคำตอบว่างกลับมา ลองเลือกโมเดลอื่น');
      return;
    }
    messages.push({ role: 'assistant', content: response.text, toolCalls: response.toolCalls });
    for (const call of response.toolCalls) {
      signal.throwIfAborted();
      const tool = tools.find(candidate => candidate.name === call.name);
      const kind = call.name === 'bash' || call.name === 'git' ? 'command' : /write|replace/.test(call.name) ? 'edit' : /search/.test(call.name) ? 'search' : 'read';
      const id = `${prefix}-api-tool-${step}-${call.id}`;
      const title = String(call.arguments?.filePath || call.arguments?.path || call.arguments?.file_path || call.arguments?.command || call.name).slice(0, 400);
      emit({ id, kind: 'tool', tool: kind, title, status: 'running' });
      let output: string, success = false;
      try {
        if (!tool) throw new Error('เครื่องมือนี้ไม่ได้รับอนุญาตในโหมดที่เลือก');
        const result = await tool.execute(call.arguments, { cwd, signal });
        success = result.success;
        output = result.success ? result.output : `${result.error || 'เครื่องมือทำงานไม่สำเร็จ'}\n${result.output}`;
      } catch (error) { output = (error as Error).message; }
      signal.throwIfAborted();
      emit({ id, kind: 'tool', tool: kind, title, status: success ? 'done' : 'failed', output });
      messages.push({ role: 'tool', content: output.slice(0, 60000), toolCallId: call.id });
    }
  }
  throw new Error('ทำงานครบขีดจำกัด 20 ขั้นตอนแล้ว กรุณาตรวจผลและส่งข้อความเพื่อทำต่อ');
}
