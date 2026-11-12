import { useCallback, useEffect, useRef, useState } from "react";
import { Key, LogIn, RefreshCw } from "lucide-react";
import { api, loginProvider, type CliAuthStatus } from "../api";
import { fetchModels, PROVIDER_LABEL } from "../providers";
import { isCloud } from '../providers';
import { tr } from '../i18n';

export const CLOUD_BYOK_PROVIDERS = ["deepseek", "groq", "openrouter", "openai_compatible"] as const;
export function isCloudByok(provider: string): boolean {
  return isCloud(provider) || (CLOUD_BYOK_PROVIDERS as readonly string[]).includes(provider);
}

export function useProviderAccess(provider: string, accountId?: string) {
  const identity = `${provider}:${accountId || ''}`;
  const activeIdentity = useRef(identity);
  activeIdentity.current = identity;
  const generation = useRef(0);
  const [auth, setAuth] = useState<CliAuthStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const check = useCallback(async (refresh = false) => {
    if (!provider) return;
    const request = ++generation.current;
    const current = () => activeIdentity.current === identity && generation.current === request;
    setChecking(true);
    try {
      const result = await api<CliAuthStatus>(`/api/clis/${provider}/auth?refresh=${refresh ? "1" : "0"}${accountId ? `&accountId=${encodeURIComponent(accountId)}` : ""}`);
      if (!current()) return;
      setAuth(result);
      setError("");
      if (refresh) void fetchModels(provider, true, accountId).catch(() => {});
    } catch {
      if (!current()) return;
      if (isCloudByok(provider)) {
        setError(tr("ตรวจสถานะ API Key ไม่สำเร็จ เปิด การตั้งค่า > API Key เพื่อตรวจสอบ"));
      } else {
        setError(tr("ตรวจบัญชีไม่สำเร็จ กรุณาลองใหม่หรือเปิด Terminal เพื่อตรวจสอบ"));
      }
    }
    finally { if (current()) setChecking(false); }
  }, [provider, accountId, identity]);
  useEffect(() => {
    setAuth(null);
    void check();
    const focused = () => void check(true);
    window.addEventListener("focus", focused);
    window.addEventListener("superai:accounts-changed", focused);
    return () => { generation.current++; window.removeEventListener("focus", focused); window.removeEventListener("superai:accounts-changed", focused); };
  }, [check]);
  return { auth, checking, error, check };
}

export function ProviderAccess({ provider, wsId, sessionId, accountId, onStatus, compact = false, onInstall, friendly = false }: {
  provider: string; wsId?: string; sessionId?: string; accountId?: string; onStatus?: (status: CliAuthStatus) => void; compact?: boolean; onInstall?: () => void; friendly?: boolean;
}) {
  const { auth, checking, error, check } = useProviderAccess(provider, accountId);
  const [opening, setOpening] = useState(false);
  const [problem, setProblem] = useState("");
  useEffect(() => { if (auth) onStatus?.(auth); }, [auth, onStatus]);
  if (compact && !error && !problem && (!auth || auth.status === "authenticated")) return null;

  const isCloud = isCloudByok(provider);

  return <div className={`provider-access ${auth?.status || "checking"}`}>
    <div>
      <strong>{PROVIDER_LABEL[provider] || provider}</strong>
      <small>{error || (friendly && auth?.status === "unknown" ? tr("แอปตรวจบัญชีนี้อัตโนมัติไม่ได้ เปิดหน้าเข้าสู่ระบบแล้วทำตามคำแนะนำ") : auth?.note) || (isCloud ? tr("กำลังตรวจ API Key…") : tr("กำลังตรวจบัญชี…"))}</small>
    </div>
    <button type="button" className="text-button" disabled={checking || opening} onClick={() => void check(true)}>
      <RefreshCw size={12} className={checking ? "spin" : ""} /> {tr("ตรวจอีกครั้ง")}
    </button>
    {!isCloud && auth?.status !== "not-installed" && (
      <button type="button" className="secondary" disabled={opening || (!wsId && !sessionId)} onClick={async () => {
        setOpening(true); setProblem("");
        try { await loginProvider(provider, { wsId, sessionId, accountId }); }
        catch { setProblem(tr("เปิดขั้นตอนเข้าสู่ระบบไม่สำเร็จ กรุณาตรวจโปรเจกต์และ CLI แล้วลองใหม่")); }
        finally { setOpening(false); }
      }}>
        <LogIn size={13} /> {auth?.status === "authenticated" ? tr("จัดการบัญชี") : friendly ? tr("เข้าสู่ระบบ") : tr("เข้าสู่ระบบใน Terminal")}
      </button>
    )}
    {isCloud && (
      <span className={`byok-badge ${auth?.status === "authenticated" ? "authenticated" : "pending"}`} title={tr("ใส่ key ได้ที่ การตั้งค่า > API Key")}>
        <Key size={12} /> {auth?.status === "authenticated" ? tr("API Key พร้อมใช้งาน") : tr("ใส่ key ที่ การตั้งค่า > API Key")}
      </span>
    )}
    {!isCloud && auth?.status === "not-installed" && onInstall && (
      <button className="secondary" onClick={onInstall}>{tr("ตรวจและติดตั้งเครื่องมือ")}</button>
    )}
    {problem && <small role="alert">{problem}</small>}
  </div>;
}
