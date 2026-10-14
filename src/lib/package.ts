import { zip, strToU8, type Zippable } from "fflate";
import type { Project, Asset } from "./model";
export interface Check {
  id: string;
  title: string;
  detail: string;
  status: "ok" | "error" | "warning";
}
export const MAX_BYTES = 200 * 1024 * 1024;
export const RESERVED = [
  "manifest.json",
  "readme.md",
  "changelog.md",
  "icon.png",
];
export function safePath(path: string): boolean {
  return (
    path.length > 0 &&
    path.length < 240 &&
    !path.startsWith("/") &&
    !path.includes("\\") &&
    !/[\x00-\x1f<>:"|?*]/.test(path) &&
    path
      .split("/")
      .every(
        (part) =>
          !!part &&
          part !== "." &&
          part !== ".." &&
          !/[. ]$/.test(part) &&
          !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part),
      )
  );
}
export function ignoredPath(path: string): boolean {
  return (
    path
      .split("/")
      .some((p) =>
        /^(\.git|node_modules|\.env(?:\..*)?|\.DS_Store|Thumbs\.db)$/i.test(p),
      ) || /\.(pdb|zip|exe)$/i.test(path)
  );
}
export function isPng256(data?: Uint8Array): boolean {
  if (!data || data.length < 24) return false;
  const png = [137, 80, 78, 71, 13, 10, 26, 10];
  if (
    !png.every((n, i) => data[i] === n) ||
    String.fromCharCode(...data.slice(12, 16)) !== "IHDR"
  )
    return false;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return view.getUint32(16) === 256 && view.getUint32(20) === 256;
}
export function validate(p: Project): Check[] {
  const m = p.manifest;
  const deps = m.dependencies;
  let website = !m.website_url;
  try {
    const u = new URL(m.website_url);
    website = ["http:", "https:", "mailto:", "ipfs:"].includes(u.protocol);
  } catch {
    /* empty is permitted */
  }
  const dependencyNames = deps.map((d) =>
    d.split("-").slice(0, -1).join("-").toLowerCase(),
  );
  const depValid =
    deps.length <= 1000 &&
    deps.every((d) => /^[a-zA-Z0-9_]+-[a-zA-Z0-9_]+-\d+\.\d+\.\d+$/.test(d)) &&
    new Set(dependencyNames).size === deps.length &&
    !dependencyNames.includes(`${p.team}-${m.name}`.toLowerCase());
  const paths = p.files.map((f) => f.path.toLowerCase());
  const filesValid =
    p.files.every(
      (f) =>
        safePath(f.path) &&
        !RESERVED.includes(f.path.toLowerCase()) &&
        !ignoredPath(f.path),
    ) && new Set(paths).size === paths.length;
  const total =
    p.files.reduce((n, f) => n + f.data.length, 0) +
    (p.icon?.length ?? 0) +
    strToU8(p.readme + p.changelog + JSON.stringify(m)).length;
  const c = (
    id: string,
    title: string,
    valid: boolean,
    detail: string,
  ): Check => ({ id, title, status: valid ? "ok" : "error", detail });
  return [
    c(
      "name",
      "Название пакета",
      /^[a-zA-Z0-9_]{1,128}$/.test(m.name),
      "От 1 до 128 символов: латиница, цифры и подчёркивания.",
    ),
    c(
      "version",
      "Версия пакета",
      /^\d+\.\d+\.\d+$/.test(m.version_number) &&
        m.version_number.split(".").every((n) => Number(n) <= 2147483647),
      "Три числа через точку, например 1.0.0. Без beta и v.",
    ),
    c(
      "description",
      "Описание",
      m.description.length <= 250,
      `${m.description.length} / 250 символов.`,
    ),
    c(
      "website",
      "Ссылка на проект",
      website,
      "Необязательно. Поддерживаются http, https, mailto и ipfs.",
    ),
    c(
      "readme",
      "README.md",
      !!p.readme.trim(),
      "Непустая инструкция в корне архива, в UTF-8.",
    ),
    c(
      "icon",
      "Иконка 256 × 256",
      isPng256(p.icon),
      "Нужен PNG размером ровно 256 × 256 пикселей.",
    ),
    c(
      "dependencies",
      "Зависимости",
      depValid,
      "Формат Author-Package-1.0.0, без повторов и зависимости от себя. Наличие проверит сервер.",
    ),
    c(
      "paths",
      "Структура архива",
      filesValid,
      "Без небезопасных путей, дубликатов и служебных файлов.",
    ),
    c(
      "size",
      "Размер проекта",
      total <= MAX_BYTES && p.files.length <= 2000,
      "Локальный лимит TSAT: 200 МБ и 2000 файлов.",
    ),
    {
      id: "payload",
      title: "Содержимое мода",
      status: p.files.length ? "ok" : "warning",
      detail:
        "Без файлов мода получится пакет метаданных. Для modpack это нормально.",
    },
    {
      id: "server",
      title: "Проверка Thunderstore",
      status: "warning",
      detail:
        "Права команды, уникальность версии, зависимости и правила сообщества проверяются при публикации.",
    },
  ];
}
export async function buildPackage(p: Project): Promise<Uint8Array> {
  const errors = validate(p).filter((c) => c.status === "error");
  if (errors.length) throw new Error(errors.map((e) => e.title).join(", "));
  const files: Zippable = Object.create(null);
  const manifest = {
    name: p.manifest.name,
    version_number: p.manifest.version_number,
    website_url: p.manifest.website_url,
    description: p.manifest.description,
    dependencies: p.manifest.dependencies,
  };
  files["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2) + "\n");
  files["README.md"] = strToU8(p.readme);
  files["icon.png"] = p.icon!;
  if (p.changelog.trim()) files["CHANGELOG.md"] = strToU8(p.changelog);
  p.files.forEach((f) => {
    files[f.path] = f.data;
  });
  return new Promise((resolve, reject) =>
    zip(files, { level: 6 }, (err, data) =>
      err ? reject(err) : resolve(data),
    ),
  );
}
export function mergeAssets(current: Asset[], incoming: Asset[]): Asset[] {
  const map = new Map(current.map((f) => [f.path.toLowerCase(), f]));
  for (const f of incoming) {
    if (!safePath(f.path)) throw new Error(`Небезопасный путь: ${f.path}`);
    if (RESERVED.includes(f.path.toLowerCase()) || ignoredPath(f.path))
      continue;
    map.set(f.path.toLowerCase(), f);
  }
  const files = [...map.values()];
  if (
    files.length > 2000 ||
    files.reduce((n, f) => n + f.data.length, 0) > MAX_BYTES
  )
    throw new Error("Лимит проекта: 200 МБ и 2000 файлов.");
  return files;
}
