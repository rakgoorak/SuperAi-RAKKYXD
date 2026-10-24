import { useCallback, useEffect, useState } from "react";
import { Key, LogIn, RefreshCw } from "lucide-react";
import { api, loginProvider, type CliAuthStatus } from "../api";
import { fetchModels, PROVIDER_LABEL } from "../providers";

export const CLOUD_BYOK_PROVIDERS = ["deepseek", "groq", "openrouter", "openai_compatible"] as const;
export function isCloudByok(provider: string): boolean {
  return (CLOUD_BYOK_PROVIDERS as readonly string[]).includes(provider);
}

const CLOUD_ENV_MAP: Record<string, string> = {
  deepseek: "DEEPSEEK_API_KEY",
  groq: "GROQ_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  openai_compatible: "OPENAI_API_KEY",
};

export function useProviderAccess(provider: string) {
  const [auth, setAuth] = useState<CliAuthStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const check = useCallback(async (refresh = false) => {
    if (!provider) return;
    setChecking(true);
    try {
      setAuth(await api<CliAuthStatus>(`/api/clis/${provider}/auth${refresh ? "?refresh=1" : ""}`));
      setError("");
      if (refresh) void fetchModels(provider, true).catch(() => {});
    } catch {
      if (isCloudByok(provider)) {
        const envKey = CLOUD_ENV_MAP[provider] || "API Key";
        setError(`ตรวจสถานะ API Key ไม่สำเร็จ กรุณาตั้งค่า ${envKey} ใน .env`);
      } else {
        setError("ตรวจบัญชีไม่สำเร็จ กรุณาลองใหม่หรือเปิด Terminal เพื่อตรวจสอบ");
      }
    }
    finally { setChecking(false); }
  }, [provider]);
  useEffect(() => {
    setAuth(null);
    void check();
    const focused = () => void check(true);
    window.addEventListener("focus", focused);
    return () => window.removeEventListener("focus", focused);
  }, [check]);
  return { auth, checking, error, check };
}

export function ProviderAccess({ provider, wsId, sessionId, onStatus, compact = false, onInstall, friendly = false }: {
  provider: string; wsId?: string; sessionId?: string; onStatus?: (status: CliAuthStatus) => void; compact?: boolean; onInstall?: () => void; friendly?: boolean;
}) {
  const { auth, checking, error, check } = useProviderAccess(provider);
  const [opening, setOpening] = useState(false);
  const [problem, setProblem] = useState("");
  useEffect(() => { if (auth) onStatus?.(auth); }, [auth, onStatus]);
  if (compact && !error && !problem && (!auth || auth.status === "authenticated")) return null;

  const isCloud = isCloudByok(provider);
  const envKey = CLOUD_ENV_MAP[provider] || "API Key";

  return <div className={`provider-access ${auth?.status || "checking"}`}>
    <div>
      <strong>{PROVIDER_LABEL[provider] || provider}</strong>
      <small>{error || (friendly && auth?.status === "unknown" ? "แอปตรวจบัญชีนี้อัตโนมัติไม่ได้ เปิดหน้าเข้าสู่ระบบแล้วทำตามคำแนะนำ" : auth?.note) || (isCloud ? "กำลังตรวจ API Key…" : "กำลังตรวจบัญชี…")}</small>
    </div>
    <button type="button" className="text-button" disabled={checking || opening} onClick={() => void check(true)}>
      <RefreshCw size={12} className={checking ? "spin" : ""} /> ตรวจอีกครั้ง
    </button>
    {!isCloud && auth?.status !== "not-installed" && (
      <button type="button" className="secondary" disabled={opening || (!wsId && !sessionId)} onClick={async () => {
        setOpening(true); setProblem("");
        try { await loginProvider(provider, { wsId, sessionId }); }
        catch { setProblem("เปิดขั้นตอนเข้าสู่ระบบไม่สำเร็จ กรุณาตรวจโปรเจกต์และ CLI แล้วลองใหม่"); }
        finally { setOpening(false); }
      }}>
        <LogIn size={13} /> {auth?.status === "authenticated" ? "จัดการบัญชี" : friendly ? "เข้าสู่ระบบ" : "เข้าสู่ระบบใน Terminal"}
      </button>
    )}
    {isCloud && (
      <span className={`byok-badge ${auth?.status === "authenticated" ? "authenticated" : "pending"}`} title={`ตั้งค่า ${envKey} ใน .env หรือ environment variable`}>
        <Key size={12} /> {auth?.status === "authenticated" ? "BYOK พร้อมใช้งาน" : `ระบุ ${envKey} ใน .env`}
      </span>
    )}
    {!isCloud && auth?.status === "not-installed" && onInstall && (
      <button className="secondary" onClick={onInstall}>ตรวจและติดตั้งเครื่องมือ</button>
    )}
    {problem && <small role="alert">{problem}</small>}
  </div>;
}
