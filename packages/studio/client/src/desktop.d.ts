export interface BrowserState {
  activeId: string;
  tabs: {
    id: string;
    url: string;
    title: string;
    loading: boolean;
    error: string;
    canBack: boolean;
    canForward: boolean;
  }[];
}
export interface UpdateState {
  status: "idle" | "checking" | "latest" | "none" | "available" | "unsupported" | "downloading" | "extracting" | "ready" | "waiting" | "installing" | "error";
  currentVersion: string;
  packaged: boolean;
  latestVersion?: string;
  /** Hard update: this version must be updated before the app can be used. */
  mandatory?: boolean;
  /** While waiting to install: what is still running (an Agent/Chat run, a CLI answering). */
  waitingFor?: string[];
  notes?: string;
  releaseUrl?: string;
  asset?: { name: string; size: number } | null;
  progress?: number;
  error?: string;
}
declare global {
  interface Window {
    superai?: {
      isDesktop: true;
      platform: string;
      pickFolder: () => Promise<string | null>;
      openExternal: (url: string) => Promise<void>;
      browser: (
        action: string,
        payload?: Record<string, unknown>,
      ) => Promise<BrowserState>;
      onBrowser: (callback: (state: BrowserState) => void) => () => void;
      /** Absolute path of a dropped file, or '' when it has none (e.g. dragged from a web page). */
      pathForFile: (file: File) => string;
      /** Puts an image file on the OS clipboard for a few seconds (Codex reads it on Ctrl+V). */
      stageClipboardImage: (filePath: string) => Promise<void>;
      /** In-app updater: check GitHub Releases, download, verify and install. */
      update: (action: "state" | "check" | "download" | "apply" | "force" | "cancel" | "install") => Promise<UpdateState>;
      onUpdate: (callback: (state: UpdateState) => void) => () => void;
    };
    bridgemind?: {
      isDesktop: true;
      platform: string;
      pickFolder: () => Promise<string | null>;
      openExternal: (url: string) => Promise<void>;
      browserLogin: (
        service: string,
      ) => Promise<{
        success: boolean;
        service?: string;
        details?: string;
        error?: string;
      }>;
      logout: (service: string) => Promise<{ success: boolean }>;
    };
  }
}
