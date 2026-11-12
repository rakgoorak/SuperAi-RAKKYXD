import { useEffect, useState } from "react";
import { parseMcpJson } from "../mcpImport";
import { Check, Loader2, Plus, Power, RefreshCw, Server, Trash2, X, Terminal, Globe, Sparkles } from "lucide-react";
import { api, post } from "../api";
import { tr } from '../i18n';

export interface McpServerRecord {
  id: string;
  name: string;
  provider: "claude" | "codex" | "opencode";
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

function getPresets() {
  return [
  {
    name: "puppeteer",
    title: "Puppeteer (Browser)",
    desc: tr("ควบคุมเบราว์เซอร์อัตโนมัติ ท่องเว็บ และจับภาพหน้าจอ"),
    type: "stdio" as const,
    command: "npx",
    args: "-y @modelcontextprotocol/server-puppeteer",
  },
  {
    name: "desktop-commander",
    title: "Desktop Commander",
    desc: tr("ควบคุมหน้าจอและเปิดแอปพลิเคชันบนเครื่อง"),
    type: "stdio" as const,
    command: "npx",
    args: "-y @wonderwhy-er/desktop-commander@latest",
  },
  {
    name: "github",
    title: "GitHub MCP",
    desc: tr("อ่าน/เขียน Issues, Pull Requests และ Repositories"),
    type: "stdio" as const,
    command: "npx",
    args: "-y @modelcontextprotocol/server-github",
  },
  {
    name: "sqlite",
    title: "SQLite Server",
    desc: tr("คิวรีและอ่านฐานข้อมูล SQLite ในเครื่อง"),
    type: "stdio" as const,
    command: "npx",
    args: "-y @modelcontextprotocol/server-sqlite --db-path ./database.sqlite",
  },
  {
    name: "postgres",
    title: "PostgreSQL",
    desc: tr("เชื่อมต่อและคิวรีฐานข้อมูล PostgreSQL"),
    type: "stdio" as const,
    command: "npx",
    args: "-y @modelcontextprotocol/server-postgres postgresql://localhost/mydb",
  },
  {
    name: "filesystem",
    title: "Filesystem",
    desc: tr("เข้าถึงและจัดการไฟล์ในโฟลเดอร์ที่กำหนด"),
    type: "stdio" as const,
    command: "npx",
    args: "-y @modelcontextprotocol/server-filesystem D:\\",
  },
  {
    name: "brave-search",
    title: "Brave Search",
    desc: tr("ค้นหาข้อมูลบนอินเทอร์เน็ตผ่าน Brave Search API"),
    type: "stdio" as const,
    command: "npx",
    args: "-y @modelcontextprotocol/server-brave-search",
  },
  {
    name: "memory",
    title: "Memory Graph",
    desc: tr("กราฟความจำระยะยาว เสริมความจำให้กับ AI"),
    type: "stdio" as const,
    command: "npx",
    args: "-y @modelcontextprotocol/server-memory",
  },
  {
    name: "fetch",
    title: "Fetch Web Server",
    desc: tr("ดาวน์โหลดและอ่านหน้าเว็บเพื่อแปลงเป็น Markdown"),
    type: "stdio" as const,
    command: "uvx",
    args: "mcp-server-fetch",
  },
  ];
}

export function McpManagerPanel({ cwd, onError, onNotice }: Props) {
  const presets = getPresets();
  const [servers, setServers] = useState<McpServerRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "claude" | "codex" | "opencode">("all");
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyServer, setBusyServer] = useState<string | null>(null);

  // Form state
  const [formProvider, setFormProvider] = useState<"claude" | "codex" | "opencode">("claude");
  const [formScope, setFormScope] = useState<"global" | "project">("global");
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<"stdio" | "http">("stdio");
  const [formCommand, setFormCommand] = useState("");
  const [formArgs, setFormArgs] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formEnv, setFormEnv] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Paste a whole "mcpServers" JSON block, as shown in most MCP READMEs, instead of filling the form.
  const [addMode, setAddMode] = useState<"json" | "form">("json");
  const [jsonText, setJsonText] = useState("");
  const [jsonProviders, setJsonProviders] = useState<("claude" | "codex" | "opencode")[]>(["claude", "codex", "opencode"]);
  const PROVIDER_NAME = { claude: "Claude Code", codex: "Codex", opencode: "OpenCode" } as const;

  const handleImport = async () => {
    let parsed;
    try { parsed = parseMcpJson(jsonText); }
    catch (err: any) {
      onError(err.message === "EMPTY" ? tr("ไม่พบ MCP server ใน JSON นี้ ต้องมี command หรือ url อย่างน้อยหนึ่งตัว") : tr("JSON ไม่ถูกต้อง ตรวจวงเล็บและเครื่องหมายคำพูดแล้วลองใหม่"));
      return;
    }
    if (!jsonProviders.length) { onError(tr("เลือก AI อย่างน้อยหนึ่งตัว")); return; }
    setSubmitting(true);
    const added: McpServerRecord[] = [], failed: string[] = [];
    for (const server of parsed) for (const provider of jsonProviders) {
      try {
        const res = await post<{ success: boolean; server: McpServerRecord }>("/api/mcp/servers", { ...server, provider, scope: formScope, cwd });
        if (res.server) added.push(res.server);
      } catch (err: any) { failed.push(`${server.name} → ${PROVIDER_NAME[provider]}: ${err.message}`); }
    }
    setServers((prev) => [...prev.filter((s) => !added.some((a) => a.id === s.id)), ...added]);
    setSubmitting(false);
    if (failed.length) onError(failed.join("\n"));
    if (added.length) {
      onNotice?.(tr`เพิ่ม ${parsed.map((s) => s.name).join(", ")} ให้ ${jsonProviders.map((p) => PROVIDER_NAME[p]).join(", ")} แล้ว · เปิดห้องคุยใหม่เพื่อให้ AI โหลดเครื่องมือ`);
      if (!failed.length) { setJsonText(""); setAdding(false); }
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const url = cwd ? `/api/mcp/servers?cwd=${encodeURIComponent(cwd)}` : "/api/mcp/servers";
      const res = await api<{ servers: McpServerRecord[] }>(url);
      setServers(res.servers || []);
    } catch (err: any) {
      onError(err.message || tr("โหลดรายการ MCP servers ไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [cwd]);

  const handleCopyToServer = async (server: McpServerRecord, targetProvider: "claude" | "codex" | "opencode") => {
    setBusyServer(server.id);
    try {
      const payload = {
        provider: targetProvider,
        scope: server.scope,
        name: server.name,
        type: server.type,
        command: server.command,
        args: server.args ? server.args.join(" ") : undefined,
        url: server.url,
        env: server.env,
        cwd,
      };
      const res = await post<{ success: boolean; server: McpServerRecord }>("/api/mcp/servers", payload);
      if (res.server) {
        setServers((prev) => [...prev.filter((s) => s.id !== res.server.id), res.server]);
      }
      onNotice?.(tr`คัดลอก ${server.name} ไปยัง ${targetProvider === "claude" ? "Claude Code" : targetProvider === "codex" ? "Codex" : "OpenCode"} สำเร็จแล้ว`);
    } catch (err: any) {
      onError(err.message || tr("คัดลอกไม่สำเร็จ"));
    } finally {
      setBusyServer(null);
    }
  };

  const handleToggle = async (server: McpServerRecord) => {
    setBusyServer(server.id);
    try {
      const url = `/api/mcp/servers/${server.provider}/${encodeURIComponent(server.name)}/toggle`;
      await post(url, { enabled: !server.enabled, cwd });
      setServers((prev) =>
        prev.map((s) => (s.id === server.id ? { ...s, enabled: !server.enabled } : s)),
      );
      onNotice?.(server.enabled ? tr`ปิดการใช้งาน ${server.name} แล้ว` : tr`เปิดการใช้งาน ${server.name} แล้ว`);
    } catch (err: any) {
      onError(err.message || tr("เปลี่ยนสถานะไม่สำเร็จ"));
    } finally {
      setBusyServer(null);
    }
  };

  const handleDelete = async (server: McpServerRecord) => {
    if (!confirm(tr`คุณต้องการลบ MCP server "${server.name}" ออกจาก ${server.provider === "claude" ? "Claude Code" : server.provider === "codex" ? "Codex" : "OpenCode"} ใช่หรือไม่?`)) {
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
        throw new Error(err.error || tr("ลบไม่สำเร็จ"));
      }
      setServers((prev) => prev.filter((s) => s.id !== server.id));
      onNotice?.(tr`ลบ ${server.name} แล้ว`);
    } catch (err: any) {
      onError(err.message || tr("ลบไม่สำเร็จ"));
    } finally {
      setBusyServer(null);
    }
  };

  const handlePresetSelect = (preset: ReturnType<typeof getPresets>[number]) => {
    setFormName(preset.name);
    setFormType(preset.type);
    setFormCommand(preset.command);
    setFormArgs(preset.args);
    setFormUrl("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      onError(tr("กรุณาระบุชื่อ MCP server"));
      return;
    }
    if (formType === "stdio" && !formCommand.trim()) {
      onError(tr("กรุณาระบุคำสั่ง Command"));
      return;
    }
    if (formType === "http" && !formUrl.trim()) {
      onError(tr("กรุณาระบุ URL"));
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
      onNotice?.(tr`เพิ่ม MCP Server "${formName}" ให้ ${formProvider === "claude" ? "Claude Code" : formProvider === "codex" ? "Codex" : "OpenCode"} เรียบร้อยแล้ว`);
      setAdding(false);
      // Reset form
      setFormName("");
      setFormCommand("");
      setFormArgs("");
      setFormUrl("");
      setFormEnv("");
    } catch (err: any) {
      onError(err.message || tr("เพิ่ม MCP Server ไม่สำเร็จ"));
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
        <h3>{tr("เครื่องมือ MCP (Model Context Protocol)")}</h3>
        <div style={{ display: "flex", gap: "6px" }}>
          <button className="text-button" disabled={loading} onClick={load} title={tr("รีเฟรช")}>
            <RefreshCw className={loading ? "spin" : ""} size={13} /> {tr("รีเฟรช")}
          </button>
          <button className="text-button primary" onClick={() => setAdding(true)}>
            <Plus size={13} /> {tr("เพิ่ม Server")}
          </button>
        </div>
      </div>
      <p className="muted">
        {tr("Model Context Protocol ช่วยให้ Claude Code และ Codex เข้าถึงเครื่องมือพิเศษ เช่น ค้นหาฐานข้อมูล สั่งการระบบอัตโนมัติ หรือเชื่อมต่อกับบริการภายนอก")}
      </p>

      {/* Filter and Search Bar */}
      <div style={{ display: "flex", gap: "8px", margin: "12px 0", alignItems: "center" }}>
        <div className="segmented-control" role="group" aria-label={tr("กรองผู้ให้บริการ")}>
          <button
            type="button"
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            {tr("ทั้งหมด (")}{servers.length})
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
          <button
            type="button"
            className={filter === "opencode" ? "active" : ""}
            onClick={() => setFilter("opencode")}
          >
            OpenCode ({servers.filter((s) => s.provider === "opencode").length})
          </button>
        </div>
        <input
          type="search"
          placeholder={tr("ค้นหาชื่อหรือคำสั่ง...")}
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
              <Server size={16} /> {tr("เพิ่ม MCP Server ใหม่")}
            </h4>
            <button className="icon-button" onClick={() => setAdding(false)} title={tr("ปิด")}>
              <X size={15} />
            </button>
          </div>

          <div role="tablist" aria-label={tr("วิธีเพิ่ม MCP Server")} style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
            {(["json", "form"] as const).map((mode) => (
              <button key={mode} type="button" role="tab" aria-selected={addMode === mode} onClick={() => setAddMode(mode)}
                className={addMode === mode ? "primary" : "secondary"} style={{ fontSize: "12px", padding: "4px 10px" }}>
                {mode === "json" ? tr("วาง JSON") : tr("กรอกเอง")}
              </button>
            ))}
          </div>

          {addMode === "json" && (
            <div style={{ display: "grid", gap: "10px" }}>
              <label>
                <span style={{ fontSize: "12px", display: "block", marginBottom: "4px" }}>{tr("วาง JSON จากคู่มือของ MCP server (รูปแบบ mcpServers แบบเดียวกับ Claude Desktop)")}</span>
                <textarea value={jsonText} onChange={(e) => setJsonText(e.target.value)} rows={8} spellCheck={false} aria-label={tr("JSON ของ MCP server")}
                  placeholder={'{\n  "mcpServers": {\n    "playwright": {\n      "command": "npx",\n      "args": ["@playwright/mcp@latest"]\n    }\n  }\n}'}
                  style={{ width: "100%", padding: "8px", borderRadius: "4px", background: "var(--input-bg, #1a1a1a)", color: "inherit", border: "1px solid var(--border, #444)", fontFamily: "ui-monospace, Consolas, monospace", fontSize: "12px" }} />
              </label>
              <fieldset style={{ border: 0, padding: 0, margin: 0, display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
                <legend style={{ fontSize: "12px", marginBottom: "4px" }}>{tr("เพิ่มให้ AI")}</legend>
                {(["claude", "codex", "opencode"] as const).map((provider) => (
                  <label key={provider} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px" }}>
                    <input type="checkbox" checked={jsonProviders.includes(provider)}
                      onChange={(e) => setJsonProviders((prev) => e.target.checked ? [...prev, provider] : prev.filter((p) => p !== provider))} />
                    {PROVIDER_NAME[provider]}
                  </label>
                ))}
                <select value={formScope} onChange={(e) => setFormScope(e.target.value as any)} aria-label={tr("ขอบเขตการใช้งาน")}
                  style={{ padding: "4px", borderRadius: "4px", background: "var(--input-bg, #1a1a1a)", color: "inherit", border: "1px solid var(--border, #444)" }}>
                  <option value="global">{tr("ทั้งเครื่อง (Global User)")}</option>
                  <option value="project" disabled={!cwd}>{tr("เฉพาะโปรเจกต์นี้ (.mcp.json)")}</option>
                </select>
              </fieldset>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="button" className="primary" disabled={submitting || !jsonText.trim()} onClick={() => void handleImport()}>
                  {submitting ? tr("กำลังเพิ่ม…") : tr("เพิ่มจาก JSON")}
                </button>
              </div>
            </div>
          )}

          {addMode === "form" && <>
          {/* Quick Presets */}
          <div style={{ marginBottom: "12px" }}>
            <span style={{ fontSize: "12px", color: "var(--muted, #888)", display: "flex", alignItems: "center", gap: "4px", marginBottom: "6px" }}>
              <Sparkles size={13} /> {tr("แม่แบบยอดนิยม (คลิกเพื่อใส่ข้อมูลอัตโนมัติ):")}
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {presets.map((p) => (
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
                <span style={{ fontSize: "12px", display: "block", marginBottom: "4px" }}>{tr("ผู้ให้บริการ AI")}</span>
                <select
                  value={formProvider}
                  onChange={(e) => setFormProvider(e.target.value as any)}
                  style={{ width: "100%", padding: "6px", borderRadius: "4px", background: "var(--input-bg, #1a1a1a)", color: "inherit", border: "1px solid var(--border, #444)" }}
                >
                  <option value="claude">Claude Code (~/.claude.json)</option>
                  <option value="codex">ChatGPT Codex (config.toml)</option>
                  <option value="opencode">OpenCode (opencode.json)</option>
                </select>
              </label>

              <label>
                <span style={{ fontSize: "12px", display: "block", marginBottom: "4px" }}>{tr("ขอบเขตการใช้งาน")}</span>
                <select
                  value={formScope}
                  onChange={(e) => setFormScope(e.target.value as any)}
                  style={{ width: "100%", padding: "6px", borderRadius: "4px", background: "var(--input-bg, #1a1a1a)", color: "inherit", border: "1px solid var(--border, #444)" }}
                >
                  <option value="global">{tr("ทั้งเครื่อง (Global User)")}</option>
                  {cwd && <option value="project">{tr("เฉพาะโปรเจกต์นี้ (.mcp.json)")}</option>}
                </select>
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "10px", marginBottom: "10px" }}>
              <label>
                <span style={{ fontSize: "12px", display: "block", marginBottom: "4px" }}>{tr("ชื่อ Server (ID ภาษาอังกฤษ) *")}</span>
                <input
                  type="text"
                  required
                  placeholder={tr("เช่น desktop-commander, github")}
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  style={{ width: "100%", padding: "6px", borderRadius: "4px", background: "var(--input-bg, #1a1a1a)", color: "inherit", border: "1px solid var(--border, #444)" }}
                />
              </label>

              <label>
                <span style={{ fontSize: "12px", display: "block", marginBottom: "4px" }}>{tr("ชนิดการเชื่อมต่อ (Type)")}</span>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as any)}
                  style={{ width: "100%", padding: "6px", borderRadius: "4px", background: "var(--input-bg, #1a1a1a)", color: "inherit", border: "1px solid var(--border, #444)" }}
                >
                  <option value="stdio">{tr("Stdio (คำสั่งโปรแกรม)")}</option>
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
                    placeholder={tr("เช่น npx, uvx, node, python")}
                    value={formCommand}
                    onChange={(e) => setFormCommand(e.target.value)}
                    style={{ width: "100%", padding: "6px", borderRadius: "4px", background: "var(--input-bg, #1a1a1a)", color: "inherit", border: "1px solid var(--border, #444)" }}
                  />
                </label>
                <label>
                  <span style={{ fontSize: "12px", display: "block", marginBottom: "4px" }}>Arguments</span>
                  <input
                    type="text"
                    placeholder={tr("เช่น -y @wonderwhy-er/desktop-commander@latest")}
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
              <span style={{ fontSize: "12px", display: "block", marginBottom: "4px" }}>{tr("Environment Variables (บรรทัดละ KEY=VALUE ไม่บังคับ)")}</span>
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
                {tr("ยกเลิก")}
              </button>
              <button type="submit" className="primary" disabled={submitting}>
                {submitting ? <Loader2 size={14} className="spin" /> : <Check size={14} />} {tr("บันทึก MCP Server")}
              </button>
            </div>
          </form>
          </>}
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
              <Loader2 size={16} className="spin" /> {tr("กำลังโหลดรายการ MCP servers...")}
            </div>
          ) : (
            <div>
              <Server size={32} style={{ opacity: 0.4, marginBottom: "8px" }} />
              <div>{tr("ยังไม่มี MCP Server")} {filter !== "all" ? tr`สำหรับ ${filter === "claude" ? "Claude Code" : filter === "codex" ? "Codex" : "OpenCode"}` : ""}</div>
              <p style={{ fontSize: "12px", marginTop: "4px" }}>
                {tr("กดปุ่ม \"เพิ่ม Server\" ด้านบน เพื่อเชื่อมต่อเครื่องมือภายนอกเข้าสู่ระบบ AI")}
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
                        background: s.provider === "claude" ? "rgba(168, 85, 247, 0.15)" : s.provider === "codex" ? "rgba(34, 197, 94, 0.15)" : "rgba(56, 189, 248, 0.15)",
                        color: s.provider === "claude" ? "#c084fc" : s.provider === "codex" ? "#4ade80" : "#38bdf8",
                        border: `1px solid ${s.provider === "claude" ? "rgba(168, 85, 247, 0.3)" : s.provider === "codex" ? "rgba(34, 197, 94, 0.3)" : "rgba(56, 189, 248, 0.3)"}`,
                      }}
                    >
                      {s.provider === "claude" ? "Claude Code" : s.provider === "codex" ? "Codex" : "OpenCode"}
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

                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "12px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {/* One-Click Copy to Other Providers */}
                  {(["claude", "codex", "opencode"] as const)
                    .filter((targetP) => targetP !== s.provider)
                    .map((targetP) => (
                      <button
                        key={targetP}
                        type="button"
                        className="text-button"
                        disabled={isBusy}
                        onClick={() => handleCopyToServer(s, targetP)}
                        title={tr`คัดลอก ${s.name} ไปยัง ${targetP === "claude" ? "Claude Code" : targetP === "codex" ? "Codex" : "OpenCode"}`}
                        style={{ fontSize: "11px", padding: "3px 6px", opacity: 0.85 }}
                      >
                        + {targetP === "claude" ? "Claude" : targetP === "codex" ? "Codex" : "OpenCode"}
                      </button>
                    ))}

                  <button
                    className={`text-button ${s.enabled ? "primary" : ""}`}
                    disabled={isBusy}
                    onClick={() => handleToggle(s)}
                    title={s.enabled ? tr("กดเพื่อปิดการใช้งาน") : tr("กดเพื่อเปิดการใช้งาน")}
                    style={{ fontSize: "12px", padding: "4px 8px" }}
                  >
                    {isBusy ? <Loader2 size={12} className="spin" /> : <Power size={12} />}
                    {s.enabled ? tr("เปิดอยู่") : tr("ปิดอยู่")}
                  </button>

                  <button
                    className="icon-button danger"
                    disabled={isBusy}
                    onClick={() => handleDelete(s)}
                    title={tr("ลบ Server")}
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
