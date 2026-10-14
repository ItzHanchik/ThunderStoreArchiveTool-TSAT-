import type { Project } from "./model";
import { gameInfo } from "./model";

export interface DocumentAnswers {
  summary: string;
  features: string;
  requirements: string;
  installation: string;
  usage: string;
  compatibility: string;
  support: string;
  license: string;
  added: string;
  changed: string;
  fixed: string;
  knownIssues: string;
}
export function initialAnswers(p: Project): DocumentAnswers {
  return {
    summary: p.manifest.description,
    features: "",
    requirements: p.manifest.dependencies.join("\n"),
    installation: "",
    usage: "",
    compatibility: "",
    support: p.manifest.website_url,
    license: "",
    added: "",
    changed: "",
    fixed: "",
    knownIssues: "",
  };
}
const bullets = (value: string) =>
  value
    .trim()
    .split(/\r?\n/)
    .filter((s) => s.trim())
    .map((s) => `- ${s.trim().replace(/^[-*]\s+/, "")}`)
    .join("\n");
const section = (title: string, content: string) =>
  content.trim() ? `\n## ${title}\n\n${content.trim()}\n` : "";
/** Deterministic local generator: answers remain author-owned text, never translated. */
export function generateReadme(p: Project, a: DocumentAnswers): string {
  return (
    `# ${p.manifest.name.replaceAll("_", " ")}\n\n${a.summary.trim()}\n\nA mod for **${gameInfo(p.game).name}**.\n` +
    section("Features", bullets(a.features)) +
    section("Requirements", bullets(a.requirements)) +
    section("Installation", a.installation) +
    section("Configuration & Usage", a.usage) +
    section("Compatibility", a.compatibility) +
    section("Support & Bug Reports", a.support) +
    section("License", a.license) +
    section("Changelog", "See **CHANGELOG.md** for release notes.")
  );
}
export function generateRelease(version: string, a: DocumentAnswers): string {
  return (
    `## ${version}\n` +
    (
      [
        ["Added", a.added],
        ["Changed", a.changed],
        ["Fixed", a.fixed],
        ["Known Issues", a.knownIssues],
      ] as const
    )
      .filter(([, value]) => value.trim())
      .map(([title, value]) => `\n### ${title}\n\n${bullets(value)}\n`)
      .join("")
  );
}
/** Replace only this version's entry, preserving all older releases and custom preamble. */
export function updateChangelog(
  existing: string,
  version: string,
  a: DocumentAnswers,
): string {
  const release = generateRelease(version, a).trim();
  const lines = existing.replace(/\r\n/g, "\n").split("\n");
  const heading = /^##\s+(?:\[)?v?(\d+\.\d+\.\d+)(?:\])?(?=\s|$)/;
  const start = lines.findIndex((line) => heading.exec(line)?.[1] === version);
  if (start >= 0) {
    let end = start + 1;
    while (end < lines.length && !/^##\s/.test(lines[end])) end++;
    return (
      [...lines.slice(0, start), release, "", ...lines.slice(end)]
        .join("\n")
        .trimEnd() + "\n"
    );
  }
  const firstRelease = lines.findIndex((line) => /^##\s/.test(line));
  if (firstRelease >= 0)
    return (
      [
        ...lines.slice(0, firstRelease),
        release,
        "",
        ...lines.slice(firstRelease),
      ]
        .join("\n")
        .trimEnd() + "\n"
    );
  return `${existing.trim() || "# Changelog"}\n\n${release}\n`;
}
