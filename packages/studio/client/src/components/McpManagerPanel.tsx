import { useEffect, useState } from "react";
import { Check, Loader2, Plus, Power, RefreshCw, Server, Trash2, X, Terminal, Globe, Sparkles } from "lucide-react";
import { api, post } from "../api";

export interface McpServerRecord {
  id: string;
  name: string;
  provider: "claude" | "codex";
  scope: "global" | "project";
  type: "stdio" | "http" | "sse" | "websocket";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  enabled: boolean;
  sourceFile: string;
}

interface Props {
  cwd?: string;
  onError: (msg: string) => void;
  onNotice?: (msg: string) => void;
}

const PRESETS = [
  {
    name: "desktop-commander",
    title: "Desktop Commander",
    desc: "ควบคุมหน้าจอและเปิดแอปพลิเคชันบนเครื่อง",
    type: "stdio" as const,
    command: "npx",
    args: "-y @wonderwhy-er/desktop-commander@latest",
  },
  {
    name: "github",
    title: "GitHub MCP",
    desc: "อ่าน/เขียน Issues, Pull Requests และ Repositories",
    type: "stdio" as const,
    command: "npx",
    args: "-y @modelcontextprotocol/server-github",
  },
  {
    name: "sqlite",
    title: "SQLite Server",
    desc: "คิวรีและอ่านฐานข้อมูล SQLite ในเครื่อง",
    type: "stdio" as const,
    command: "npx",
    args: "-y @modelcontextprotocol/server-sqlite --db-path ./database.sqlite",
  },
  {
    name: "fetch",
    title: "Fetch Web Server",
    desc: "ดาวน์โหลดและอ่านหน้าเว็บเพื่อแปลงเป็น Markdown",
    type: "stdio" as const,
    command: "uvx",
    args: "mcp-server-fetch",
  },
];

export function McpManagerPanel({ cwd, onError, onNotice }: Props) {
  const [servers, setServers] = useState<McpServerRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "claude" | "codex">("all");
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyServer, setBusyServer] = useState<string | null>(null);

  // Form state
  const [formProvider, setFormProvider] = useState<"claude" | "codex">("claude");
  const [formScope, setFormScope] = useState<"global" | "project">("global");
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<"stdio" | "http">("stdio");
  const [formCommand, setFormCommand] = useState("");
  const [formArgs, setFormArgs] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formEnv, setFormEnv] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const url = cwd ? `/api/mcp/servers?cwd=${encodeURIComponent(cwd)}` : "/api/mcp/servers";
      const res = await api<{ servers: McpServerRecord[] }>(url);
      setServers(res.servers || []);
    } catch (err: any) {
      onError(err.message || "โหลดรายการ MCP servers ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [cwd]);

  const handleToggle = async (server: McpServerRecord) => {
    setBusyServer(server.id);
    try {
      const url = `/api/mcp/servers/${server.provider}/${encodeURIComponent(server.name)}/toggle`;
      await post(url, { enabled: !server.enabled, cwd });
      setServers((prev) =>
        prev.map((s) => (s.id === server.id ? { ...s, enabled: !server.enabled } : s)),
      );
      onNotice?.(`${server.enabled ? "ปิด" : "เปิด"}การใช้งาน ${server.name} แล้ว`);
    } catch (err: any) {
      onError(err.message || "เปลี่ยนสถานะไม่สำเร็จ");
    } finally {
      setBusyServer(null);
    }
  };

  const handleDelete = async (server: McpServerRecord) => {
    if (!confirm(`คุณต้องการลบ MCP server "${server.name}" ออกจาก ${server.provider === "claude" ? "Claude Code" : "Codex"} ใช่หรือไม่?`)) {
      return;
    }
    setBusyServer(server.id);
    try {
      const queryStr = cwd ? `?cwd=${encodeURIComponent(cwd)}` : "";
      const res = await fetch(`/api/mcp/servers/${server.provider}/${encodeURIComponent(server.name)}${queryStr}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "ลบไม่สำเร็จ");
      }
      setServers((prev) => prev.filter((s) => s.id !== server.id));
      onNotice?.(`ลบ ${server.name} แล้ว`);
    } catch (err: any) {
      onError(err.message || "ลบไม่สำเร็จ");
    } finally {
      setBusyServer(null);
    }
  };

  const handlePresetSelect = (preset: typeof PRESETS[0]) => {
    setFormName(preset.name);
    setFormType(preset.type);
    setFormCommand(preset.command);
    setFormArgs(preset.args);
    setFormUrl("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      onError("กรุณาระบุชื่อ MCP server");
      return;
    }
    if (formType === "stdio" && !formCommand.trim()) {
      onError("กรุณาระบุคำสั่ง Command");
      return;
    }
    if (formType === "http" && !formUrl.trim()) {
      onError("กรุณาระบุ URL");
      return;
    }

    setSubmitting(true);
    try {
      const envObj: Record<string, string> = {};
      if (formEnv.trim()) {
        formEnv.split(/\r?\n/).forEach((line) => {
          const idx = line.indexOf("=");
          if (idx > 0) {
            envObj[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
          }
        });
      }

      const payload = {
        provider: formProvider,
        scope: formScope,
        name: formName.trim(),
        type: formType,
        command: formType === "stdio" ? formCommand.trim() : undefined,
        args: formType === "stdio" && formArgs.trim() ? formArgs.trim() : undefined,
        url: formType === "http" ? formUrl.trim() : undefined,
        env: Object.keys(envObj).length ? envObj : undefined,
        cwd,
      };

      const res = await post<{ success: boolean; server: McpServerRecord }>("/api/mcp/servers", payload);
      if (res.server) {
        setServers((prev) => [...prev.filter((s) => s.id !== res.server.id), res.server]);
      }
      onNotice?.(`เพิ่ม MCP Server "${formName}" ให้ ${formProvider === "claude" ? "Claude Code" : "Codex"} เรียบร้อยแล้ว`);
      setAdding(false);
      // Reset form
      setFormName("");
      setFormCommand("");
      setFormArgs("");
      setFormUrl("");
      setFormEnv("");
    } catch (err: any) {
      onError(err.message || "เพิ่ม MCP Server ไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = servers.filter((s) => {
    if (filter !== "all" && s.provider !== filter) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      const match = s.name.toLowerCase().includes(q) ||
        (s.command && s.command.toLowerCase().includes(q)) ||
        (s.url && s.url.toLowerCase().includes(q)) ||
        (s.args && s.args.join(" ").toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="mcp-manager-panel">
      <div className="settings-section-title">
        <h3>เครื่องมือ MCP (Model Context Protocol)</h3>
        <div style={{ display: "flex", gap: "6px" }}>
          <button className="text-button" disabled={loading} onClick={load} title="รีเฟรช">
            <RefreshCw className={loading ? "spin" : ""} size={13} /> รีเฟรช
          </button>
          <button className="text-button primary" onClick={() => setAdding(true)}>
            <Plus size={13} /> เพิ่ม Server
          </button>
        </div>
      </div>
      <p className="muted">
        Model Context Protocol ช่วยให้ Claude Code และ Codex เข้าถึงเครื่องมือพิเศษ เช่น ค้นหาฐานข้อมูล สั่งการระบบอัตโนมัติ หรือเชื่อมต่อกับบริการภายนอก
      </p>

      {/* Filter and Search Bar */}
      <div style={{ display: "flex", gap: "8px", margin: "12px 0", alignItems: "center" }}>
        <div className="segmented-control" role="group" aria-label="กรองผู้ให้บริการ">
          <button
            type="button"
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            ทั้งหมด ({servers.length})
          </button>
          <button
            type="button"
            className={filter === "claude" ? "active" : ""}
            onClick={() => setFilter("claude")}
          >
            Claude Code ({servers.filter((s) => s.provider === "claude").length})
          </button>
          <button
            type="button"
            className={filter === "codex" ? "active" : ""}
            onClick={() => setFilter("codex")}
          >
            Codex ({servers.filter((s) => s.provider === "codex").length})
          </button>
        </div>
        <input
          type="search"
          placeholder="ค้นหาชื่อหรือคำสั่ง..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            flex: 1,
            padding: "5px 10px",
            borderRadius: "6px",
            border: "1px solid var(--border, #333)",
            background: "var(--input-bg, #1a1a1a)",
            color: "inherit",
            fontSize: "13px",
          }}
        />
      </div>

      {/* Add Modal / Form Dialog */}
      {adding && (
        <div
          style={{
            margin: "12px 0 16px 0",
            padding: "16px",
            background: "var(--card-bg, #222)",
            border: "1px solid var(--accent, #6366f1)",
            borderRadius: "8px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h4 style={{ margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
              <Server size={16} /> เพิ่ม MCP Server ใหม่
            </h4>
            <button className="icon-button" onClick={() => setAdding(false)} title="ปิด">
              <X size={15} />
            </button>
          </div>

          {/* Quick Presets */}
          <div style={{ marginBottom: "12px" }}>
            <span style={{ fontSize: "12px", color: "var(--muted, #888)", display: "flex", alignItems: "center", gap: "4px", marginBottom: "6px" }}>
              <Sparkles size={13} /> แม่แบบยอดนิยม (คลิกเพื่อใส่ข้อมูลอัตโนมัติ):
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  className="preset-chip"
                  style={{
                    fontSize: "12px",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    border: "1px solid var(--border, #444)",
                    background: "var(--chip-bg, #2a2a2a)",
                    cursor: "pointer",
                    color: "inherit",
                  }}
                  onClick={() => handlePresetSelect(p)}
                >
                  {p.title}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
              <label>
                <span style={{ fontSize: "12px", display: "block", marginBottom: "4px" }}>ผู้ให้บริการ AI</span>
                <select
                  value={formProvider}
                  onChange={(e) => setFormProvider(e.target.value as any)}
                  style={{ width: "100%", padding: "6px", borderRadius: "4px", background: "var(--input-bg, #1a1a1a)", color: "inherit", border: "1px solid var(--border, #444)" }}
                >
                  <option value="claude">Claude Code</option>
                  <option value="codex">Codex</option>
                </select>
              </label>

              <label>
                <span style={{ fontSize: "12px", display: "block", marginBottom: "4px" }}>ขอบเขตการใช้งาน</span>
                <select
                  value={formScope}
                  onChange={(e) => setFormScope(e.target.value as any)}
                  style={{ width: "100%", padding: "6px", borderRadius: "4px", background: "var(--input-bg, #1a1a1a)", color: "inherit", border: "1px solid var(--border, #444)" }}
                >
                  <option value="global">ทั้งเครื่อง (Global User)</option>
                  {cwd && <option value="project">เฉพาะโปรเจกต์นี้ (.mcp.json)</option>}
                </select>
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "10px", marginBottom: "10px" }}>
              <label>
                <span style={{ fontSize: "12px", display: "block", marginBottom: "4px" }}>ชื่อ Server (ID ภาษาอังกฤษ) *</span>
                <input
                  type="text"
                  required
                  placeholder="เช่น desktop-commander, github"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  style={{ width: "100%", padding: "6px", borderRadius: "4px", background: "var(--input-bg, #1a1a1a)", color: "inherit", border: "1px solid var(--border, #444)" }}
                />
              </label>

              <label>
                <span style={{ fontSize: "12px", display: "block", marginBottom: "4px" }}>ชนิดการเชื่อมต่อ (Type)</span>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as any)}
                  style={{ width: "100%", padding: "6px", borderRadius: "4px", background: "var(--input-bg, #1a1a1a)", color: "inherit", border: "1px solid var(--border, #444)" }}
                >
                  <option value="stdio">Stdio (คำสั่งโปรแกรม)</option>
                  <option value="http">HTTP / SSE (URL)</option>
                </select>
              </label>
            </div>

            {formType === "stdio" ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "10px", marginBottom: "10px" }}>
                <label>
                  <span style={{ fontSize: "12px", display: "block", marginBottom: "4px" }}>Command *</span>
                  <input
                    type="text"
                    required
                    placeholder="เช่น npx, uvx, node, python"
                    value={formCommand}
                    onChange={(e) => setFormCommand(e.target.value)}
                    style={{ width: "100%", padding: "6px", borderRadius: "4px", background: "var(--input-bg, #1a1a1a)", color: "inherit", border: "1px solid var(--border, #444)" }}
                  />
                </label>
                <label>
                  <span style={{ fontSize: "12px", display: "block", marginBottom: "4px" }}>Arguments</span>
                  <input
                    type="text"
                    placeholder="เช่น -y @wonderwhy-er/desktop-commander@latest"
                    value={formArgs}
                    onChange={(e) => setFormArgs(e.target.value)}
                    style={{ width: "100%", padding: "6px", borderRadius: "4px", background: "var(--input-bg, #1a1a1a)", color: "inherit", border: "1px solid var(--border, #444)" }}
                  />
                </label>
              </div>
            ) : (
              <label style={{ display: "block", marginBottom: "10px" }}>
                <span style={{ fontSize: "12px", display: "block", marginBottom: "4px" }}>Server URL *</span>
                <input
                  type="url"
                  required
                  placeholder="https://example.com/mcp"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  style={{ width: "100%", padding: "6px", borderRadius: "4px", background: "var(--input-bg, #1a1a1a)", color: "inherit", border: "1px solid var(--border, #444)" }}
                />
              </label>
            )}

            <label style={{ display: "block", marginBottom: "12px" }}>
              <span style={{ fontSize: "12px", display: "block", marginBottom: "4px" }}>Environment Variables (บรรทัดละ KEY=VALUE ไม่บังคับ)</span>
              <textarea
                rows={2}
                placeholder="GITHUB_PERSONAL_ACCESS_TOKEN=ghp_...&#10;PORT=8080"
                value={formEnv}
                onChange={(e) => setFormEnv(e.target.value)}
                style={{ width: "100%", padding: "6px", borderRadius: "4px", background: "var(--input-bg, #1a1a1a)", color: "inherit", border: "1px solid var(--border, #444)", fontFamily: "monospace", fontSize: "12px" }}
              />
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button type="button" onClick={() => setAdding(false)}>
                ยกเลิก
              </button>
              <button type="submit" className="primary" disabled={submitting}>
                {submitting ? <Loader2 size={14} className="spin" /> : <Check size={14} />} บันทึก MCP Server
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Servers List */}
      {filtered.length === 0 ? (
        <div
          style={{
            padding: "32px",
            textAlign: "center",
            color: "var(--muted, #888)",
            border: "1px dashed var(--border, #444)",
            borderRadius: "8px",
            marginTop: "12px",
          }}
        >
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "8px" }}>
              <Loader2 size={16} className="spin" /> กำลังโหลดรายการ MCP servers...
            </div>
          ) : (
            <div>
              <Server size={32} style={{ opacity: 0.4, marginBottom: "8px" }} />
              <div>ยังไม่มี MCP Server {filter !== "all" ? `สำหรับ ${filter === "claude" ? "Claude Code" : "Codex"}` : ""}</div>
              <p style={{ fontSize: "12px", marginTop: "4px" }}>
                กดปุ่ม "เพิ่ม Server" ด้านบน เพื่อเชื่อมต่อเครื่องมือภายนอกเข้าสู่ระบบ AI
              </p>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px" }}>
          {filtered.map((s) => {
            const isBusy = busyServer === s.id;
            return (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  borderRadius: "8px",
                  background: "var(--card-bg, #1e1e1e)",
                  border: `1px solid ${s.enabled ? "var(--border, #333)" : "var(--border-disabled, #2a2a2a)"}`,
                  opacity: s.enabled ? 1 : 0.6,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span style={{ fontWeight: 600, fontSize: "14px" }}>{s.name}</span>
                    <span
                      style={{
                        fontSize: "11px",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        fontWeight: 500,
                        background: s.provider === "claude" ? "rgba(168, 85, 247, 0.15)" : "rgba(34, 197, 94, 0.15)",
                        color: s.provider === "claude" ? "#c084fc" : "#4ade80",
                        border: `1px solid ${s.provider === "claude" ? "rgba(168, 85, 247, 0.3)" : "rgba(34, 197, 94, 0.3)"}`,
                      }}
                    >
                      {s.provider === "claude" ? "Claude Code" : "Codex"}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background: "rgba(255, 255, 255, 0.06)",
                        color: "var(--muted, #888)",
                      }}
                    >
                      {s.type === "stdio" ? "Stdio" : "HTTP/SSE"}
                    </span>
                    {s.scope === "project" && (
                      <span
                        style={{
                          fontSize: "11px",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: "rgba(59, 130, 246, 0.15)",
                          color: "#60a5fa",
                        }}
                      >
                        Project
                      </span>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--muted, #aaa)", fontFamily: "monospace" }}>
                    {s.type === "stdio" ? (
                      <>
                        <Terminal size={12} style={{ opacity: 0.6 }} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {s.command} {s.args?.join(" ")}
                        </span>
                      </>
                    ) : (
                      <>
                        <Globe size={12} style={{ opacity: 0.6 }} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {s.url}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "12px" }}>
                  <button
                    className={`text-button ${s.enabled ? "primary" : ""}`}
                    disabled={isBusy}
                    onClick={() => handleToggle(s)}
                    title={s.enabled ? "กดเพื่อปิดการใช้งาน" : "กดเพื่อเปิดการใช้งาน"}
                    style={{ fontSize: "12px", padding: "4px 8px" }}
                  >
                    {isBusy ? <Loader2 size={12} className="spin" /> : <Power size={12} />}
                    {s.enabled ? "เปิดอยู่" : "ปิดอยู่"}
                  </button>

                  <button
                    className="icon-button danger"
                    disabled={isBusy}
                    onClick={() => handleDelete(s)}
                    title="ลบ Server"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
