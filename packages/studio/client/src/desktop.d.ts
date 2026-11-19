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
/** Computer use as the desktop app reports it. `os`: macOS permissions ("granted", "denied", "not-determined"…). */
export interface ComputerState {
  enabled: boolean;
  platform?: string;
  os?: { accessibility: string; screen: string };
  /** Set by "os-reset" when macOS refused to reset SuperAi's entry (the user removes it with − instead). */
  resetFailed?: boolean;
  /** Chats the user allowed in the Allow / Deny window: for the whole chat, or for the current task. */
  allowed?: { chatId: string; chatName?: string; scope: "chat" | "task"; apps?: string[] }[];
}
export type MacPermissionLevel = "not-determined" | "granted" | "denied" | "restricted" | "unknown";
export type MacPermissionPane = "microphone" | "camera" | "screen" | "accessibility" | "fullDiskAccess";
export interface MacPermissionStatus {
  microphone: MacPermissionLevel;
  camera: MacPermissionLevel;
  screen: MacPermissionLevel;
  accessibility: boolean;
}
export interface UpdateState {
  status: "idle" | "checking" | "latest" | "none" | "available" | "unsupported" | "downloading" | "extracting" | "ready" | "waiting" | "installing" | "error";
  currentVersion: string;
  packaged: boolean;
  /** Installed from the Microsoft Store: GitHub is only checked; the Store installs (storeUrl opens it). */
  storeManaged?: boolean;
  storeUrl?: string;
  latestVersion?: string;
  /** Hard update: this version must be updated before the app can be used. */
  mandatory?: boolean;
  /** While waiting to install: what is still running (an Agent/Chat run, a CLI answering). */
  waitingFor?: string[];
  notes?: string;
  releaseUrl?: string;
  asset?: { name: string; size: number } | null;
  /** Installed from the Microsoft Store: GitHub is only checked; the Store installs (storeUrl opens it). */
  storeManaged?: boolean;
  storeUrl?: string;
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
      /** Show a file (absolute path) selected in Explorer / Finder. */
      revealFile?: (file: string) => Promise<void>;
      macPermissions?: {
        status: () => Promise<MacPermissionStatus>;
        request: (permission: "microphone" | "camera" | "screen" | "accessibility") => Promise<{ granted: boolean; status: MacPermissionStatus }>;
        openSettings: (permission: MacPermissionPane) => Promise<void>;
      };
      browser: (
        action: string,
        payload?: Record<string, unknown>,
      ) => Promise<BrowserState>;
      /** Clears the selected core browser credential and the shared Preview session; not CLI login. */
      forgetSession: (service: "chatgpt" | "claude" | "gemini" | "deepseek" | "copilot") => Promise<
        { success: true; previewCleared: true } | { success: false; error: string }
      >;
      onBrowser: (callback: (state: BrowserState) => void) => () => void;
      /** The AI used the browser panel: show it. */
      onBrowserReveal?: (callback: (detail: { tool: string }) => void) => () => void;
      /** Absolute path of a dropped file, or '' when it has none (e.g. dragged from a web page). */
      pathForFile: (file: File) => string;
      /** Puts an image file on the OS clipboard for a few seconds (Codex reads it on Ctrl+V). */
      stageClipboardImage: (filePath: string) => Promise<void>;
      /** In-app updater: check GitHub Releases, download, verify and install. */
      update: (action: "state" | "check" | "download" | "apply" | "force" | "cancel" | "install") => Promise<UpdateState>;
      onUpdate: (callback: (state: UpdateState) => void) => () => void;
      /** Dynamic Client Bundle (OTA): sync Web Bundle without desktop binaries or full release. */
      clientUpdate?: (action: "state" | "check" | "sync" | "reload" | "reset" | "apply-local", payload?: any) => Promise<any>;
      onClientUpdate?: (callback: (state: any) => void) => () => void;
      onClientUpdateReady?: (callback: (info: { installedAt: number; releaseTag?: string }) => void) => () => void;
      /** Anonymous usage count: `available` is false in dev builds, `enabled` is the user's choice. */
      usage?: (action: "state" | "set", value?: boolean) => Promise<{ available: boolean; enabled: boolean; asked?: boolean }>;
      /** "Let the AI control this computer": off unless the user turns it on; sensitive apps ask first in an Allow / Deny window. */
      computer?: (action: "state" | "set" | "revoke" | "os-settings" | "os-reset", value?: boolean | "accessibility" | "screen") => Promise<ComputerState>;
      onComputer?: (callback: (state: ComputerState) => void) => () => void;
      /** OS notification + taskbar flash; clicking it focuses the window and reports `target` via onNotifyOpen. */
      notify?: (notice: { tag: string; title: string; body: string; target: unknown }) => Promise<void>;
      onNotifyOpen?: (callback: (target: unknown) => void) => () => void;
      /** Quick ask box: which global shortcut works ("" when none), or open it now. */
      quickAsk?: (action: "state" | "open") => Promise<{ key: string }>;
      /** Text sent from the quick ask box, to start a new chat with. */
      onQuickAsk?: (callback: (text: unknown) => void) => () => void;
    };
  }
}
