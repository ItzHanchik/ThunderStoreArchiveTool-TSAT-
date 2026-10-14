import { defaultIcon, renderIcon } from "./icon";
import { get, set } from "idb-keyval";
import type { BuildRecord, Preferences, Project } from "./model";
import { defaults, starterProjects } from "./model";
export interface Workspace {
  projects: Project[];
  history: BuildRecord[];
  preferences: Preferences;
}
export async function loadWorkspace(): Promise<Workspace> {
  const saved = await get<Workspace>("tsat-workspace-v1");
  return saved
    ? {
        ...saved,
        preferences: {
          ...defaults,
          ...saved.preferences,
          language: saved.preferences?.language === "ru" ? "ru" : "en",
        },
      }
    : { projects: starterProjects(), history: [], preferences: defaults };
}
export const saveWorkspace = (w: Workspace) => set("tsat-workspace-v1", w);
export async function createIcon(
  color: string,
  letter: string,
): Promise<Uint8Array> {
  return renderIcon(defaultIcon(color, letter));
}
export async function exportBytes(
  bytes: Uint8Array,
  filename: string,
): Promise<boolean> {
  if (window.tsat) return window.tsat.saveArchive(bytes, filename);
  const url = URL.createObjectURL(
    new Blob([new Uint8Array(bytes)], { type: "application/zip" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}
export function openExternal(url: string) {
  if (window.tsat) void window.tsat.openExternal(url);
  else window.open(url, "_blank", "noopener,noreferrer");
}
