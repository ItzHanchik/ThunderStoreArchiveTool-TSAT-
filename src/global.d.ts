interface Window {
  tsat?: {
    saveArchive(bytes: Uint8Array, filename: string): Promise<boolean>;
    openExternal(url: string): Promise<void>;
    tokenStatus(): Promise<{ saved: boolean; available: boolean }>;
    saveToken(token: string): Promise<void>;
    deleteToken(): Promise<void>;
    publish(bytes: Uint8Array, metadata: { filename: string; team: string; community: string; nsfw: boolean; categories: string[] }): Promise<{ url: string }>;
  };
}
