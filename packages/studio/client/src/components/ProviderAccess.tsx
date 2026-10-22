import { useCallback, useEffect, useState } from "react";
import { LogIn, RefreshCw } from "lucide-react";
import { api, loginProvider, type CliAuthStatus } from "../api";
import { fetchModels, PROVIDER_LABEL } from "../providers";

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
    } catch { setError("ตรวจบัญชีไม่สำเร็จ กรุณาลองใหม่หรือเปิด Terminal เพื่อตรวจสอบ"); }
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

export function ProviderAccess({ provider, wsId, sessionId, onStatus }: {
  provider: string; wsId?: string; sessionId?: string; onStatus?: (status: CliAuthStatus) => void;
}) {
  const { auth, checking, error, check } = useProviderAccess(provider);
  const [opening, setOpening] = useState(false);
  const [problem, setProblem] = useState("");
  useEffect(() => { if (auth) onStatus?.(auth); }, [auth, onStatus]);
  return <div className={`provider-access ${auth?.status || "checking"}`}>
    <div><strong>{PROVIDER_LABEL[provider] || provider}</strong><small>{error || auth?.note || "กำลังตรวจบัญชี…"}</small></div>
    <button type="button" className="text-button" disabled={checking || opening} onClick={() => void check(true)}><RefreshCw size={12} className={checking ? "spin" : ""} /> ตรวจอีกครั้ง</button>
    {auth?.status !== "not-installed" && <button type="button" className="secondary" disabled={opening || (!wsId && !sessionId)} onClick={async () => {
      setOpening(true); setProblem("");
      try { await loginProvider(provider, { wsId, sessionId }); }
      catch { setProblem("เปิดขั้นตอนเข้าสู่ระบบไม่สำเร็จ กรุณาตรวจโปรเจกต์และ CLI แล้วลองใหม่"); }
      finally { setOpening(false); }
    }}><LogIn size={13} /> {auth?.status === "authenticated" ? "จัดการบัญชี" : "เข้าสู่ระบบใน Terminal"}</button>}
    {problem && <small role="alert">{problem}</small>}
  </div>;
}
