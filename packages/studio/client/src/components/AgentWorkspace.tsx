import { Bot, BriefcaseBusiness, Users, Footprints } from "lucide-react";
import { useState, useEffect, useRef, type CSSProperties } from "react";
import type { Run } from "../api";
import type { AgentConfig } from "./AgentPanel";
import { agentLocations, type WorkspaceAgent } from "./agentWorkspaceState";

export type WorkspaceTheme = "studio" | "cyberpunk" | "diorama";

const THEME_STORAGE_KEY = "superai-workspace-theme";

interface ThemeOption {
  id: WorkspaceTheme;
  label: string;
  icon: string;
  tooltip: string;
}

const THEMES: ThemeOption[] = [
  { id: "studio", label: "Modern Studio", icon: "🏢", tooltip: "ห้องแล็บโปร่งทรงโมเดิร์น กระจกใสและโต๊ะไม้ Slate" },
  { id: "cyberpunk", label: "Cyberpunk Lab", icon: "🚀", tooltip: "แล็บไซเบอร์พังค์ โต๊ะโฮโลแกรม 3D และรางไฟนีออน" },
  { id: "diorama", label: "Cozy Diorama", icon: "🎨", tooltip: "ไดโอรามาอบอุ่น สไตล์ดินปั้น Low-poly และต้นไม้จิ๋ว" },
];

export function AgentWorkspace({ config, run, typing }: { config: AgentConfig | null; run?: Run; typing: boolean }) {
  if (!config && !run?.main) return null;

  // Persisted theme choice
  const [theme, setTheme] = useState<WorkspaceTheme>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === "studio" || saved === "cyberpunk" || saved === "diorama") {
        return saved;
      }
    } catch {}
    return "studio";
  });

  const handleSelectTheme = (nextTheme: WorkspaceTheme) => {
    setTheme(nextTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {}
  };

  // Demo walking toggle for interactive testing
  const [demoWalk, setDemoWalk] = useState(false);
  // Cheering agent interaction on click
  const [cheeringAgent, setCheeringAgent] = useState<string | null>(null);

  // Compute base agent locations from state logic
  const baseAgents = agentLocations(config || { main: run!.main!, subagents: run!.subagents || [] }, run, typing);

  // When demo walk is activated, simulate agents moving between meeting and desk
  const agents: WorkspaceAgent[] = demoWalk
    ? baseAgents.map((agent, i) => ({
        ...agent,
        room: i % 2 === 0 ? (agent.room === "meeting" ? "desk" : "meeting") : agent.room,
        label: agent.room === "meeting" ? "เดินไปที่โต๊ะ" : "เดินไปประชุม",
      }))
    : baseAgents;

  // Walking state and facing direction per agent
  const [walkingState, setWalkingState] = useState<Record<string, { isWalking: boolean; direction: "left" | "right" }>>({});
  const prevPositionsRef = useRef<Map<string, { x: number; y: number; room: string }>>(new Map());

  // Calculate coordinates for each agent
  let meetingIndex = 0, deskIndex = 0;
  const agentPlacements = agents.map((agent, index) => {
    const pos = agent.room === "meeting" ? meetingIndex++ : deskIndex++;
    const x = agent.room === "meeting" ? 8 + (pos % 4) * 10 : 58 + (pos % 3) * 13;
    const y = agent.room === "meeting" ? 54 + Math.floor(pos / 4) * 22 : 49 + Math.floor(pos / 3) * 22;
    const key = `${agent.seat.name}-${index}`;
    return { agent, index, pos, x, y, key };
  });

  // Track position changes and trigger walking animation cycle
  useEffect(() => {
    const nextWalking: Record<string, { isWalking: boolean; direction: "left" | "right" }> = {};
    let anyMoved = false;

    for (const item of agentPlacements) {
      const prev = prevPositionsRef.current.get(item.key);
      if (prev) {
        const dx = item.x - prev.x;
        const dy = item.y - prev.y;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3 || prev.room !== item.agent.room) {
          anyMoved = true;
          const direction: "left" | "right" = dx >= 0 ? "right" : "left";
          nextWalking[item.key] = { isWalking: true, direction };
        }
      }
      prevPositionsRef.current.set(item.key, { x: item.x, y: item.y, room: item.agent.room });
    }

    if (anyMoved) {
      setWalkingState(prev => ({ ...prev, ...nextWalking }));
      const timer = setTimeout(() => {
        setWalkingState(current => {
          const cleared: Record<string, { isWalking: boolean; direction: "left" | "right" }> = {};
          for (const k in current) {
            cleared[k] = { ...current[k], isWalking: false };
          }
          return cleared;
        });
      }, 1850);
      return () => clearTimeout(timer);
    }
  }, [agents, demoWalk]);

  const handleAgentClick = (agentKey: string) => {
    setCheeringAgent(agentKey);
    setTimeout(() => {
      setCheeringAgent(curr => (curr === agentKey ? null : curr));
    }, 1200);
  };

  return (
    <section className="agent-workspace" data-theme={theme} aria-label="พื้นที่ทำงานของทีม Agent">
      <div className="agent-workspace-head">
        <div>
          <span className="agent-workspace-eyebrow">SUPERAI · 3D AGENT WORKSPACE</span>
          <h2>พื้นที่ทำงานของทีม AI</h2>
        </div>

        <div className="agent-workspace-controls">
          {/* 3D Theme Switcher */}
          <div className="workspace-theme-switcher" role="tablist" aria-label="เลือกสไตล์ 3D Workspace">
            {THEMES.map(t => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={theme === t.id}
                className={`theme-pill ${theme === t.id ? "active" : ""}`}
                onClick={() => handleSelectTheme(t.id)}
                title={t.tooltip}
              >
                <span className="theme-pill-icon">{t.icon}</span>
                <span className="theme-pill-label">{t.label}</span>
              </button>
            ))}
          </div>

          {/* Walking simulation demo button */}
          <button
            type="button"
            className={`workspace-walk-demo-btn ${demoWalk ? "active" : ""}`}
            onClick={() => setDemoWalk(prev => !prev)}
            title={demoWalk ? "กลับสู่สถานะจริง" : "ทดสอบให้ตัวละครเดินสลับห้อง"}
          >
            <Footprints size={13} />
            <span>{demoWalk ? "หยุดเดิน" : "ทดสอบเดิน"}</span>
          </button>
        </div>

        <span className="agent-workspace-live">
          <i />
          {run?.status === "running" ? "กำลังทำงาน" : typing ? "รับโจทย์" : "พร้อมทำงาน"}
        </span>
      </div>

      <div
        className="agent-office"
        role="img"
        aria-label={agents.map(a => `${a.seat.name}: ${a.label} ${a.room === "desk" ? "ที่โต๊ะทำงาน" : "ในห้องประชุม"}`).join("; ")}
      >
        {/* Meeting Room */}
        <div className="office-room meeting-room">
          <div className="office-room-title">
            <Users size={14} /> ห้องประชุม <small>วิเคราะห์และวางแผน</small>
          </div>
          <div className="meeting-board">
            <span className="board-col-1">IDEAS</span>
            <span className="board-col-2">PLAN</span>
            <span className="board-col-3">PROGRESS</span>
          </div>
          <div className="meeting-table">
            <span />
            <span />
            <span />
          </div>
          {/* Theme-specific decorative elements in meeting room */}
          <div className="theme-decor meeting-decor" aria-hidden="true">
            <div className="cyber-holo-emitter" />
            <div className="cyber-holo-beam" />
            <div className="diorama-pinboard" />
            <div className="studio-glass-reflection" />
          </div>
        </div>

        {/* Work Room */}
        <div className="office-room work-room">
          <div className="office-room-title">
            <BriefcaseBusiness size={14} /> ห้องทำงาน <small>ลงมือทำงาน</small>
          </div>
          <div className="office-desks">
            <div className="desk-pod pod-1" />
            <div className="desk-pod pod-2" />
            <div className="desk-pod pod-3" />
          </div>
          {/* Theme-specific decorative elements in work room */}
          <div className="theme-decor work-decor" aria-hidden="true">
            <div className="cyber-server-rack" />
            <div className="diorama-potted-plant" />
            <div className="studio-task-lamp" />
          </div>
        </div>

        {/* Hallway Pathway Connector */}
        <div className="office-hallway-connector" aria-hidden="true">
          <div className="hallway-circuit-line" />
        </div>

        {/* Animated Agent Characters */}
        {agentPlacements.map(({ agent, index, x, y, key }) => {
          const walk = walkingState[key];
          const isWalking = !!walk?.isWalking;
          const direction = walk?.direction || (agent.room === "desk" ? "right" : "left");
          const isCheering = cheeringAgent === key;

          const bubbleText = isCheering
            ? "🎉 ไชโย!"
            : isWalking
              ? (agent.room === "desk" ? "🚶 ไปโต๊ะทำงาน" : "🚶 ไปประชุม")
              : (agent.room === "desk"
                  ? (run?.status === "running" ? "💻 กำลังเขียนโค้ด" : "💻 ประจำโต๊ะ")
                  : (typing ? "👂 กำลังฟังโจทย์" : (run?.status === "running" ? "💡 กำลังวางแผน" : "☕ พร้อมทำงาน")));

          return (
            <div
              className={`office-agent room-${agent.room} ${isWalking ? "is-walking" : "is-idle"} facing-${direction} ${isCheering ? "is-cheering" : ""}`}
              key={key}
              style={{
                "--agent-x": `${x}%`,
                "--agent-y": `${y}%`,
                "--agent-color": ["#75dbc0", "#a99cff", "#ffbc77", "#86bfff", "#ef9bbd", "#c8d880", "#e5a584"][index % 7],
              } as CSSProperties}
              onClick={() => handleAgentClick(key)}
              title={`${agent.seat.name} (${agent.label}) - คลิกเพื่อทักทาย`}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleAgentClick(key); }}
            >
              {/* Floating Thought / Activity Bubble */}
              <div className="office-agent-bubble" aria-hidden="true">
                <span className="bubble-text">{bubbleText}</span>
              </div>

              {/* Agent Name Tag */}
              <div className="office-agent-tag">
                <strong>{agent.seat.name}</strong>
                <small>{agent.label}</small>
              </div>

              {/* Dynamic Locomotion Trail / Particle Glow */}
              <div className="office-agent-trail" aria-hidden="true" />
              <div className="office-agent-shadow" aria-hidden="true" />

              {/* Agent 3D-Style Robot Figure */}
              <div className="office-agent-figure">
                <span className="office-agent-antenna" />
                <div className="office-agent-face">
                  <i />
                  <i />
                </div>
                <div className="office-agent-body">
                  <Bot size={12} />
                </div>
                <span className="office-agent-foot left" />
                <span className="office-agent-foot right" />
              </div>
            </div>
          );
        })}
      </div>

      <p className="agent-workspace-caption">
        รองรับ 3 สไตล์: 🏢 Modern Studio · 🚀 Cyberpunk Lab · 🎨 Cozy Diorama · ตัวละครเดินสลับห้องตามสถานะงานจริง หรือกด "ทดสอบเดิน" เพื่อชมแอนิเมชัน
      </p>
    </section>
  );
}
