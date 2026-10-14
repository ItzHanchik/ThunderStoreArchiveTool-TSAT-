import { afterEach, describe, expect, it } from "vitest";
import { setLanguage, t, dateLocale } from "../src/lib/i18n";
import { games, newProject } from "../src/lib/model";
import { modChangelog, modReadme } from "../src/lib/templates";
import english from "../shared/en.json";
import { createRequire } from "node:module";
const native = createRequire(import.meta.url)("../shared/i18n.cjs");
afterEach(() => {
  setLanguage("ru");
  native.setLanguage("ru");
});
describe("RU / EN interface", () => {
  it("translates messages and interpolation in both directions", () => {
    setLanguage("en");
    expect(t("Мои проекты")).toBe("My projects");
    expect(t("Открыть {0}", "User_Mod")).toBe("Open User_Mod");
    expect(dateLocale()).toBe("en-US");
    setLanguage("ru");
    expect(t("Мои проекты")).toBe("Мои проекты");
  });
  it("has complete English entries with matching interpolation parameters", () => {
    for (const [key, value] of Object.entries(english)) {
      expect(value.trim(), key).not.toBe("");
      expect(value.match(/\{\d+\}/g) ?? [], key).toEqual(
        key.match(/\{\d+\}/g) ?? [],
      );
    }
  });
  it("uses the same dictionary in native dialogs", () => {
    native.setLanguage("en");
    expect(native.t("Сохранить архив мода")).toBe("Save mod archive");
    expect(
      native.t(
        "{0}\nКоманда: {1}\nСообщество: {2}",
        "Mod.zip",
        "Team",
        "boneworks",
      ),
    ).toBe("Mod.zip\nTeam: Team\nCommunity: boneworks");
  });
  it("includes the real BONEWORKS community identifier", () => {
    expect(games.find((g) => g.id === "boneworks")?.name).toBe("BONEWORKS");
  });
});
describe("package-facing English templates", () => {
  it.each(["ru", "en"] as const)(
    "always writes English for the %s interface",
    (language) => {
      setLanguage(language);
      const p = newProject("My_Mod", "boneworks");
      expect(p.readme).toContain("**BONEWORKS**");
      expect(p.readme).toContain("## Requirements");
      expect(p.readme).toContain("### Manual installation");
      expect(p.readme).toContain("## Configuration & Usage");
      expect(p.readme).toContain("## Compatibility");
      expect(p.readme).toContain("## Support & Bug Reports");
      expect(p.readme).toContain("## License");
      expect(p.readme + p.changelog).not.toMatch(/[А-Яа-яЁё]/);
    },
  );
  it("does not mutate existing user text on a language switch", () => {
    const p = newProject("My_Mod", "boneworks");
    p.readme = "# Мой собственный текст";
    setLanguage("en");
    expect(p.readme).toBe("# Мой собственный текст");
  });
  it("supports current versions and readable project names", () => {
    expect(modChangelog("2.3.4")).toContain("## 2.3.4");
    expect(modReadme("My_Mod", "BONEWORKS")).toMatch(/^# My Mod/);
  });
});
