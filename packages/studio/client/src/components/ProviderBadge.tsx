import { Bot, Code2, Cpu, Orbit, Terminal } from 'lucide-react';
import { providerIdentity } from '../providerIdentity';

const ICONS = { 'claude-code': Bot, codex: Cpu, antigravity: Orbit, opencode: Code2, freebuff: Terminal, terminal: Terminal };

/** Provider identity is independent of the conversation's editable title. */
export function ProviderBadge({ provider, compact = false }: { provider: string; compact?: boolean }) {
  const id = provider.replace(/^cli:/, '');
  const identity = providerIdentity(provider);
  const Icon = ICONS[id as keyof typeof ICONS] || Bot;
  return <span className={`provider-badge provider-${id.replace(/[^a-z-]/g, '')}`} title={`${identity.label} · ${identity.connection}`} aria-label={identity.label}>
    <Icon size={14} aria-hidden="true" />{!compact && <span>{identity.short}</span>}
  </span>;
}
