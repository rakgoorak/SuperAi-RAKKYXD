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
declare global {
  interface Window {
    superai?: {
      isDesktop: true;
      platform: string;
      pickFolder: () => Promise<string | null>;
      openExternal: (url: string) => Promise<void>;
      openSpeechSettings: () => Promise<void>;
      browser: (
        action: string,
        payload?: Record<string, unknown>,
      ) => Promise<BrowserState>;
      onBrowser: (callback: (state: BrowserState) => void) => () => void;
      /** Absolute path of a dropped file, or '' when it has none (e.g. dragged from a web page). */
      pathForFile: (file: File) => string;
      /** Puts an image file on the OS clipboard for a few seconds (Codex reads it on Ctrl+V). */
      stageClipboardImage: (filePath: string) => Promise<void>;
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
