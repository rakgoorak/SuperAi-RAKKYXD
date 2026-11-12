import { useEffect, useState } from 'react';
import { Download, ExternalLink, LoaderCircle, Sparkles, X } from 'lucide-react';
import { api, post, type Cli } from '../api';
import { tr } from '../i18n';

interface Job {
  id: string;
  cliId: string;
  status: string;
  log: string;
  error?: string;
}

export function CliInstaller({
  clis,
  onRefresh,
  onError,
}: {
  clis: Cli[];
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [starting, setStarting] = useState('');
  const [selected, setSelected] = useState('');

  useEffect(() => {
    let ended = false,
      pending = false,
      last = '';
    const read = async () => {
      if (pending) return;
      pending = true;
      try {
        const data = await api<Job[]>('/api/cli-installs');
        if (ended) return;
        setJobs(data);
        const signature = data.map((j) => j.id + j.status).join();
        if (signature !== last) {
          last = signature;
          await onRefresh();
        }
      } catch (e) {
        if (!ended) onError((e as Error).message);
      } finally {
        pending = false;
      }
    };
    void read();
    const timer = setInterval(read, 1000);
    return () => {
      ended = true;
      clearInterval(timer);
    };
  }, [onRefresh, onError]);

  const start = async (id: string) => {
    setStarting(id);
    try {
      const job = await post<Job>(`/api/clis/${id}/install`);
      setJobs((current) => [...current, job]);
      setSelected(job.id);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setStarting('');
    }
  };

  const job = jobs.find((j) => j.id === selected) || jobs[jobs.length - 1];
  const isRunning = jobs.some((j) => j.status === 'running');
  const nodeStatus = clis[0]?.nodeStatus;
  const nodeReady = clis[0]?.nodeReady ?? true;

  const jobName = (id: string) => {
    if (id === 'node') return 'Node.js 22 LTS';
    return clis.find((c) => c.id === id)?.name || id;
  };

  return (
    <section className="cli-installer" aria-label={tr("ติดตั้งเครื่องมือ CLI")}>
      <h3>
        <Download size={14} />
        {tr("ติดตั้งเครื่องมือที่ยังไม่มี")}
      </h3>
      <div className="install-buttons">
        {clis
          .filter((c) => !c.available && c.installPackage)
          .map((c) => (
            <button
              className="secondary compact"
              key={c.id}
              disabled={!!starting || isRunning}
              onClick={() => void start(c.id)}
            >
              <Download size={13} />
              {starting === c.id ? tr("กำลังเริ่ม…") : tr`ติดตั้ง ${c.name}`}
            </button>
          ))}

        {!nodeReady && (
          <button
            className="secondary compact"
            disabled={!!starting || isRunning}
            onClick={() => void start('node')}
            title={tr("ดาวน์โหลดและติดตั้ง Node.js 22 LTS ลงโฟลเดอร์ส่วนตัวของ SuperAi อัตโนมัติ")}
          >
            <Sparkles size={13} />
            {starting === 'node'
              ? tr("กำลังเริ่ม…")
              : `⚡ ${nodeStatus?.version ? tr`อัปเดตเป็น Node.js 22+ (ปัจจุบัน: ${nodeStatus.version})` : tr("ติดตั้ง Node.js 22+ อัตโนมัติ")}`}
          </button>
        )}

        {clis.every((c) => c.available) && <p>{tr("เครื่องมือทั้งหมดพร้อมเปิด session")}</p>}

        {!nodeReady && (
          <button
            className="text-button"
            onClick={() =>
              window.superai
                ? void window.superai
                    .openExternal('https://nodejs.org/en/download')
                    .catch((e) => onError(e.message))
                : window.open('https://nodejs.org/en/download', '_blank', 'noopener,noreferrer')
            }
          >
            <ExternalLink size={13} />
            {tr("ติดตั้งเองจาก nodejs.org")}
          </button>
        )}

        <button className="text-button" onClick={() => void onRefresh().catch((e) => onError(e.message))}>
          {tr("ตรวจสอบอีกครั้ง")}
        </button>
      </div>

      <p className="team-footnote">
        {tr("ติดตั้งจากแพ็กเกจทางการลงโฟลเดอร์ส่วนตัวของ SuperAi · ตรวจสอบและติดตั้ง Node.js 22+ ให้อัตโนมัติเมื่อกดติดตั้ง · หลังติดตั้งให้เปิด CLI เพื่อล็อกอิน")}
      </p>

      {job && (
        <details className="install-log" open>
          <summary>
            {jobName(job.cliId)} ·{' '}
            {
              (
                {
                  running: tr("กำลังติดตั้ง"),
                  completed: tr("ติดตั้งสำเร็จ"),
                  failed: tr("ติดตั้งไม่สำเร็จ"),
                  cancelled: tr("ยกเลิกแล้ว"),
                } as Record<string, string>
              )[job.status]
            }
          </summary>
          <pre>{job.log}</pre>
          {job.error && <p role="alert">{job.error}</p>}
          {job.status === 'running' && (
            <button
              className="text-button"
              onClick={() => void post(`/api/cli-installs/${job.id}/cancel`).catch((e) => onError(e.message))}
            >
              <LoaderCircle size={13} className="spin" />
              <X size={13} />
              {tr("ยกเลิกการติดตั้ง")}
            </button>
          )}
        </details>
      )}
    </section>
  );
}
