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
      openVoice: () => Promise<void>;
      browser: (
        action: string,
        payload?: Record<string, unknown>,
      ) => Promise<BrowserState>;
      onBrowser: (callback: (state: BrowserState) => void) => () => void;
      onVoiceText: (callback: (text: string) => void) => () => void;
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
