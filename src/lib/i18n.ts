import english from "../../shared/en.json";
export type Language = "ru" | "en";
let language: Language = "en";
export function setLanguage(next: Language) {
  language = next === "en" ? "en" : "ru";
}
export function getLanguage(): Language {
  return language;
}
export function dateLocale() {
  return language === "en" ? "en-US" : "ru-RU";
}
/** Only call for application-owned strings. User content is never translated. */
export function t(key: string, ...args: unknown[]): string {
  const translated =
    language === "en" ? (english as Record<string, string>)[key] || key : key;
  return translated.replace(/\{(\d+)\}/g, (match, index) =>
    Number(index) < args.length ? String(args[Number(index)]) : match,
  );
}
