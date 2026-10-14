import { beforeEach, describe, expect, it, vi } from "vitest";
import { get } from "idb-keyval";
import { loadWorkspace } from "../src/lib/storage";
import { defaults } from "../src/lib/model";
vi.mock("idb-keyval", () => ({ get: vi.fn(), set: vi.fn() }));
beforeEach(() => {
  vi.mocked(get).mockReset();
});
describe("English-first workspace migration", () => {
  it("starts a fresh workspace in English", async () => {
    expect(defaults.language).toBe("en");
    const workspace = await loadWorkspace();
    expect(workspace.preferences.language).toBe("en");
    expect(workspace.projects).toHaveLength(3);
  });
  it.each(["ru", "en"])(
    "preserves explicit saved %s preference",
    async (language) => {
      vi.mocked(get).mockResolvedValue({
        projects: [],
        history: [],
        preferences: { language },
      });
      expect((await loadWorkspace()).preferences.language).toBe(language);
    },
  );
  it("uses English if a legacy workspace has no language preference", async () => {
    vi.mocked(get).mockResolvedValue({
      projects: [],
      history: [],
      preferences: { theme: "dark" },
    });
    const workspace = await loadWorkspace();
    expect(workspace.preferences.language).toBe("en");
    expect(workspace.preferences.theme).toBe("dark");
    expect(workspace.projects).toEqual([]);
  });
  it("propagates a storage read failure instead of overwriting user data", async () => {
    vi.mocked(get).mockRejectedValue(new Error("Storage unavailable"));
    await expect(loadWorkspace()).rejects.toThrow("Storage unavailable");
  });
});
