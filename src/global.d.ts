interface Window {
  tsat?: {
    setLanguage(language: "ru" | "en"): Promise<void>;
    saveArchive(bytes: Uint8Array, filename: string): Promise<boolean>;
    openExternal(url: string): Promise<void>;
    catalog(
      operation: "communities" | "categories",
      params?: { community: string },
    ): Promise<import("./lib/online").CatalogItem[]>;
    catalog(
      operation: "packages",
      params: { community: string; query: string; page: number },
    ): Promise<import("./lib/online").SearchResult>;
    catalog(
      operation: "package",
      params: { namespace: string; name: string },
    ): Promise<import("./lib/online").RemotePackage>;
    verifyToken(): Promise<{ username: string; teams: string[] }>;
    tokenStatus(): Promise<{ saved: boolean; available: boolean }>;
    saveToken(token: string): Promise<void>;
    deleteToken(): Promise<void>;
    publish(
      bytes: Uint8Array,
      metadata: {
        filename: string;
        team: string;
        community: string;
        nsfw: boolean;
        categories: string[];
      },
    ): Promise<{ url: string }>;
  };
}
