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
    ? { ...saved, preferences: { ...defaults, ...saved.preferences } }
    : { projects: starterProjects(), history: [], preferences: defaults };
}
export const saveWorkspace = (w: Workspace) => set("tsat-workspace-v1", w);
export async function createIcon(
  color: string,
  letter: string,
): Promise<Uint8Array> {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 256, 256);
  g.addColorStop(0, color);
  g.addColorStop(1, "#172e35");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = "#ffffff24";
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, 208, 208);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 125px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letter.slice(0, 1).toUpperCase(), 128, 137);
  const blob = await new Promise<Blob>((resolve, reject) =>
    c.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Не удалось создать PNG"))),
      "image/png",
    ),
  );
  return new Uint8Array(await blob.arrayBuffer());
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
