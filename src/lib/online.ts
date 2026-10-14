export interface CatalogItem {
  id: string;
  name: string;
}
export interface PackageSummary {
  namespace: string;
  name: string;
  description: string;
  downloads: number;
  deprecated: boolean;
}
export interface RemotePackage extends PackageSummary {
  version: string;
  dependencies: string[];
  website: string;
}
export interface SearchResult {
  more: boolean;
  packages: PackageSummary[];
}
