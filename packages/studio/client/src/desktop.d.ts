export {};

declare global {
  interface Window {
    /** Present only when running inside the BridgeMind desktop app (Electron). */
    bridgemind?: {
      isDesktop: true;
      platform: string;
      browserLogin: (service: string) => Promise<{ success: boolean; service?: string; details?: string; error?: string }>;
      logout: (service: string) => Promise<{ success: boolean }>;
      pickFolder: () => Promise<string | null>;
      openExternal: (url: string) => Promise<void>;
    };
  }
}
