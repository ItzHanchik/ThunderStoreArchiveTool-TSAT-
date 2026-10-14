import { describe, expect, it } from "vitest";
import { newProject } from "../src/lib/model";
import {
  generateReadme,
  initialAnswers,
  updateChangelog,
  generateRelease,
} from "../src/lib/documents";
const project = newProject("Useful_Mod", "boneworks");
const answers = {
  ...initialAnswers(project),
  summary: "Makes movement smoother.",
  features: "- Less friction\n\nCustom speed",
  fixed: "* Fixed a crash\nFixed save loading",
};
describe("local document assistant", () => {
  it("uses project metadata and answers, not invented compatibility claims", () => {
    const result = generateReadme(project, answers);
    expect(result).toContain("# Useful Mod");
    expect(result).toContain("**BONEWORKS**");
    expect(result).toContain("- Less friction\n- Custom speed");
    expect(result).not.toContain("## Compatibility");
    expect(result).not.toContain("## License");
    expect(result).not.toContain("## Installation");
    expect(result).toContain("CHANGELOG.md");
  });
  it("preserves author text regardless of interface language", () => {
    expect(
      generateReadme(project, { ...answers, summary: "Мой мод" }),
    ).toContain("Мой мод");
  });
  it("creates only filled release sections with current version", () => {
    expect(generateRelease("1.2.3", answers)).toBe(
      "## 1.2.3\n\n### Fixed\n\n- Fixed a crash\n- Fixed save loading\n",
    );
  });
  it("adds a release above older releases, keeping the preamble", () => {
    const old =
      "# My release notes\n\nCustom preamble.\n\n## 1.0.0\n\nOld text.\n";
    const result = updateChangelog(old, "1.2.3", answers);
    expect(result).toContain("Custom preamble.\n\n## 1.2.3");
    expect(result).toContain("## 1.0.0\n\nOld text.");
    expect(result.indexOf("## 1.2.3")).toBeLessThan(result.indexOf("## 1.0.0"));
  });
  it.each(["## 1.2.3", "## [1.2.3] - 2026-10-14", "## v1.2.3"])(
    "updates %s once without losing adjacent releases",
    (heading) => {
      const old = `# Changelog\n\n## Unreleased\n\nFuture work\n\n${heading}\n\nOutdated\n\n## 1.0.0\n\nOlder notes\n`;
      const result = updateChangelog(old, "1.2.3", answers);
      expect(result).toContain("Future work");
      expect(result).not.toContain("Outdated");
      expect(result).toContain("Older notes");
      expect(result.match(/## 1\.2\.3/g)).toHaveLength(1);
    },
  );
  it("handles an empty changelog and CRLF", () => {
    expect(updateChangelog("", "1.2.3", answers)).toMatch(
      /^# Changelog\n\n## 1.2.3/,
    );
    expect(
      updateChangelog("# Changelog\r\n\r\n## 1.0.0\r\nOld", "1.2.3", answers),
    ).not.toContain("\r");
  });
});
