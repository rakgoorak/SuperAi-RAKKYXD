import { spawn, execFileSync, ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { cliEnv, findExecutable, getCliDefinition, INSTALL_PACKAGES, managedCliPrefix } from './CliCatalog.js';
import { installNode22 } from './NodeInstaller.js';
import { installPortableGit } from './GitInstaller.js';

export interface InstallJob {
  id: string;
  cliId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  log: string;
  error?: string;
}

export interface InstallNodeResult {
  node: string;
  npm: string;
  version: string;
}

export interface CliInstallDependencies {
  find: (command: string) => string | null;
  spawn: typeof spawn;
  prefix: string;
  timeout: number;
  version: (node: string) => string;
  installNode?: (options?: { onLog?: (msg: string) => void; signal?: AbortSignal }) => Promise<InstallNodeResult>;
  installGit?: (options?: { onLog?: (msg: string) => void; signal?: AbortSignal }) => Promise<{ version: string }>;
  autoInstallNode?: boolean;
}

export class CliInstallManager {
  private jobs = new Map<string, InstallJob>();
  private child: ChildProcess | null = null;
  private stopCurrent: (() => void) | null = null;
  private currentAbort: AbortController | null = null;
  private dependencies: CliInstallDependencies;

  list() {
    return [...this.jobs.values()];
  }

  constructor(dependencies?: Partial<CliInstallDependencies>) {
    if (dependencies) {
      this.dependencies = {
        find: findExecutable,
        spawn,
        prefix: managedCliPrefix(),
        timeout: 600000,
        version: (node: string) =>
          execFileSync(node, ['-p', 'process.versions.node'], {
            encoding: 'utf8',
            timeout: 5000,
            windowsHide: true,
          }).trim(),
        ...dependencies,
      };
    } else {
      this.dependencies = {
        find: findExecutable,
        spawn,
        prefix: managedCliPrefix(),
        timeout: 600000,
        version: (node: string) =>
          execFileSync(node, ['-p', 'process.versions.node'], {
            encoding: 'utf8',
            timeout: 5000,
            windowsHide: true,
          }).trim(),
        installNode: installNode22,
        installGit: installPortableGit,
        autoInstallNode: true,
      };
    }
  }

  private pruneOldJobs() {
    if (this.jobs.size > 20) {
      for (const [id, j] of this.jobs) {
        if (j.status !== 'running') this.jobs.delete(id);
      }
    }
  }

  private killChild(child: ChildProcess) {
    if (!child.pid) return;
    if (process.platform === 'win32') {
      const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
      });
      killer.on('error', () => child.kill());
      killer.on('close', (code) => {
        if (code) child.kill();
      });
    } else {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        child.kill();
      }
    }
  }

  start(cliId: string): InstallJob {
    if (cliId === 'node' || cliId === 'git') {
      const label = cliId === 'node' ? 'Node.js 22 LTS' : 'Git for Windows';
      const installer = cliId === 'node' ? this.dependencies.installNode : this.dependencies.installGit;
      if (this.child || this.currentAbort) {
        throw new Error('กำลังติดตั้งเครื่องมืออื่น กรุณารอหรือยกเลิกก่อน');
      }
      if (!installer) {
        throw new Error(`ระบบติดตั้ง ${label} อัตโนมัติไม่พร้อมใช้งาน`);
      }

      this.pruneOldJobs();
      const job: InstallJob = {
        id: randomUUID(),
        cliId,
        status: 'running',
        log: `กำลังเตรียมดาวน์โหลดและติดตั้ง ${label}...\n`,
      };
      this.jobs.set(job.id, job);

      const ac = new AbortController();
      this.currentAbort = ac;
      this.stopCurrent = () => {
        ac.abort();
      };

      (async () => {
        try {
          const res = await installer({
            onLog: (msg) => {
              job.log = (job.log + msg + '\n').slice(-20000);
            },
            signal: ac.signal,
          });
          if (job.status === 'cancelled') return;
          job.status = 'completed';
          job.log += `\n${label} (${res.version}) ติดตั้งสำเร็จและพร้อมใช้งาน`;
        } catch (e: any) {
          if (job.status === 'cancelled') return;
          job.status = 'failed';
          job.error = ac.signal.aborted
            ? `ยกเลิกการติดตั้ง ${label} แล้ว`
            : e.message || `ติดตั้ง ${label} ไม่สำเร็จ`;
        } finally {
          if (this.currentAbort === ac) {
            this.currentAbort = null;
            this.stopCurrent = null;
          }
        }
      })();

      return job;
    }

    const cli = getCliDefinition(cliId);
    const pkg = INSTALL_PACKAGES[cliId];
    if (!pkg) throw new Error('Terminal มาพร้อมระบบปฏิบัติการ ไม่ต้องติดตั้ง');
    if (this.child || this.currentAbort) {
      throw new Error('กำลังติดตั้งเครื่องมืออื่น กรุณารอหรือยกเลิกก่อน');
    }
    if (this.dependencies.find(cli.command)) {
      throw new Error('เครื่องมือนี้ติดตั้งแล้ว กดตรวจสอบอีกครั้งได้');
    }

    const node = this.dependencies.find('node');
    const npm = this.dependencies.find('npm');
    let nodeMajor = 0;
    if (node && npm) {
      try {
        nodeMajor = Number(this.dependencies.version(node).split('.')[0]) || 0;
      } catch {
        nodeMajor = 0;
      }
    }
    const needsNode = !node || !npm || nodeMajor < 22;

    if (needsNode) {
      if (!this.dependencies.installNode || this.dependencies.autoInstallNode === false) {
        if (!node || !npm) {
          throw new Error('ต้องติดตั้ง Node.js 22+ และ npm ก่อน แล้วเปิดโปรแกรมใหม่');
        }
        if (nodeMajor < 22) throw new Error('ต้องใช้ Node.js 22 ขึ้นไป');
      }

      fs.mkdirSync(this.dependencies.prefix, { recursive: true });
      this.pruneOldJobs();
      const job: InstallJob = {
        id: randomUUID(),
        cliId,
        status: 'running',
        log: `ตรวจพบ Node.js ต่ำกว่า 22 หรือยังไม่ได้ติดตั้ง\n[1/2] กำลังดาวน์โหลดและติดตั้ง Node.js 22 LTS อัตโนมัติ...\n`,
      };
      this.jobs.set(job.id, job);

      const ac = new AbortController();
      this.currentAbort = ac;
      this.stopCurrent = () => {
        ac.abort();
        if (this.child) this.killChild(this.child);
      };

      (async () => {
        try {
          await this.dependencies.installNode!({
            onLog: (msg) => {
              job.log = (job.log + msg + '\n').slice(-20000);
            },
            signal: ac.signal,
          });
          if (job.status === 'cancelled' || ac.signal.aborted) return;
          job.log += `\n[2/2] Node.js 22 พร้อมใช้งานแล้ว กำลังติดตั้ง ${pkg} จาก npm registry...\n`;

          const readyNode = this.dependencies.find('node');
          const readyNpm = this.dependencies.find('npm');
          if (!readyNode || !readyNpm) {
            throw new Error('ติดตั้ง Node.js 22 แล้วแต่ไม่พบ executable กรุณาเปิดโปรแกรมใหม่');
          }
          this.executeNpmInstall(job, cli, pkg, readyNode, readyNpm);
        } catch (e: any) {
          if (job.status === 'cancelled') return;
          job.status = 'failed';
          job.error = ac.signal.aborted ? 'ยกเลิกการติดตั้งแล้ว' : e.message || 'ติดตั้งไม่สำเร็จ';
          this.currentAbort = null;
          this.stopCurrent = null;
        }
      })();

      return job;
    }

    fs.mkdirSync(this.dependencies.prefix, { recursive: true });
    this.pruneOldJobs();
    const job: InstallJob = {
      id: randomUUID(),
      cliId,
      status: 'running',
      log: `ติดตั้ง ${pkg} จาก npm registry\n`,
    };
    this.jobs.set(job.id, job);

    this.executeNpmInstall(job, cli, pkg, node!, npm!);
    return job;
  }

  private executeNpmInstall(
    job: InstallJob,
    cli: { command: string; name: string },
    pkg: string,
    node: string,
    npm: string,
  ) {
    const real = fs.realpathSync(npm);
    const entry = [
      real.endsWith('.js') ? real : '',
      path.join(path.dirname(real), 'node_modules/npm/bin/npm-cli.js'),
      path.resolve(path.dirname(real), '../lib/node_modules/npm/bin/npm-cli.js'),
    ].find((p) => p && fs.existsSync(p));

    if (!entry) {
      job.status = 'failed';
      job.error = 'หา npm-cli.js ไม่พบ กรุณาติดตั้ง Node.js/npm ใหม่';
      this.currentAbort = null;
      this.stopCurrent = null;
      return;
    }

    const child = this.dependencies.spawn(
      node,
      [
        entry,
        'install',
        '--global',
        '--prefix',
        this.dependencies.prefix,
        `${pkg}@latest`,
        '--registry=https://registry.npmjs.org',
        '--no-fund',
        '--no-audit',
      ],
      {
        windowsHide: true,
        detached: process.platform !== 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, ...cliEnv() },
      },
    );
    this.child = child;

    const append = (chunk: Buffer) => {
      job.log = (job.log + chunk.toString()).slice(-20000);
    };
    child.stdout?.on('data', append);
    child.stderr?.on('data', append);

    const kill = () => this.killChild(child);
    this.stopCurrent = kill;

    const timer = setTimeout(() => {
      job.error = 'ติดตั้งเกินเวลาที่กำหนด กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่';
      kill();
    }, this.dependencies.timeout);

    child.on('error', (e) => {
      job.error = e.message;
      job.status = 'failed';
      clearTimeout(timer);
      if (this.child === child) {
        this.child = null;
        this.stopCurrent = null;
        this.currentAbort = null;
      }
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (this.child === child) {
        this.child = null;
        this.stopCurrent = null;
        this.currentAbort = null;
      }
      if (job.status === 'cancelled') return;
      if (job.error || code !== 0 || !this.dependencies.find(cli.command)) {
        job.status = 'failed';
        job.error =
          job.error ||
          (code === 0
            ? 'ติดตั้งเสร็จแต่ยังหา executable ไม่พบ กรุณาตรวจ log'
            : `ติดตั้งไม่สำเร็จ (exit ${code})`);
      } else {
        job.status = 'completed';
        job.log += '\nติดตั้งสำเร็จ · เปิด CLI เพื่อเข้าสู่ระบบด้วยบัญชีของคุณ';
      }
    });
  }

  cancel(id: string) {
    const job = this.jobs.get(id);
    if (!job || job.status !== 'running') return false;
    job.status = 'cancelled';
    this.stopCurrent?.();
    return true;
  }

  stop() {
    const job = this.list().find((j) => j.status === 'running');
    if (job) this.cancel(job.id);
  }
}
