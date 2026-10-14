import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";
const { catalog, verifyToken } = createRequire(import.meta.url)(
  "../electron/catalog.cjs",
);
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status });
describe("read-only Thunderstore catalog", () => {
  it("paginates communities only on the exact endpoint", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        json({
          results: [{ identifier: "valheim", name: "Valheim" }],
          next: "https://thunderstore.io/api/experimental/community/?cursor=next",
        }),
      )
      .mockResolvedValueOnce(
        json({
          results: [{ identifier: "repo", name: "R.E.P.O." }],
          next: null,
        }),
      );
    expect(await catalog("communities", {}, fetcher)).toHaveLength(2);
    expect(fetcher.mock.calls[1][0]).toContain("?cursor=next");
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });
  it("rejects pagination to a different origin", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(json({ results: [], next: "https://evil.test" }));
    await expect(catalog("communities", {}, fetcher)).rejects.toThrow(
      "пагинация",
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects malformed paths before making a request", async () => {
    const fetcher = vi.fn();
    await expect(
      catalog("package", { namespace: "../token", name: "Mod" }, fetcher),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("encodes user search as a query parameter", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(json({ packages: [], has_more_pages: false }));
    await catalog(
      "packages",
      { community: "valheim", query: "abc&nsfw=true", page: 1 },
      fetcher,
    );
    const url = new URL(fetcher.mock.calls[0][0]);
    expect(url.searchParams.get("q")).toBe("abc&nsfw=true");
    expect(url.searchParams.has("nsfw")).toBe(false);
  });
  it("returns only profile and teams, not the token", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(json({ username: "service", teams: ["MyTeam"] }));
    expect(await verifyToken("test-secret", fetcher)).toEqual({
      username: "service",
      teams: ["MyTeam"],
    });
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe(
      "Bearer test-secret",
    );
  });
  it("does not treat an anonymous 200 as authenticated", async () => {
    await expect(
      verifyToken(
        "bad",
        vi.fn().mockResolvedValue(json({ username: null, teams: [] })),
      ),
    ).rejects.toThrow("авторизацию");
  });
  it("does not expose an authentication error response body", async () => {
    await expect(
      verifyToken(
        "secret",
        vi.fn().mockResolvedValue(json({ detail: "secret" }, 401)),
      ),
    ).rejects.toThrow("HTTP 401");
  });
});
