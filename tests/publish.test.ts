import { createRequire } from "node:module";
import { describe, it, expect, vi } from "vitest";
const require = createRequire(import.meta.url);
const {
  publishPackage,
  allowedUpload,
  validateMetadata,
} = require("../electron/publish.cjs");
const metadata = {
  filename: "Test-1.0.0.zip",
  team: "Team",
  community: "valheim",
  categories: [],
  nsfw: false,
};
const uuid = "00000000-0000-4000-8000-000000000001";
const json = (v: unknown, status = 200) =>
  new Response(JSON.stringify(v), {
    status,
    headers: { "Content-Type": "application/json" },
  });
describe("publishing security and contract", () => {
  it.each([
    "http://bucket.s3.amazonaws.com/x",
    "https://evil.test",
    "https://s3.amazonaws.com.evil.test/x",
    "https://user:pass@bucket.s3.amazonaws.com/x",
    "https://bucket.s3.amazonaws.com:444/x",
  ])("rejects unsafe upload host %s", (url) =>
    expect(allowedUpload(url)).toBe(false),
  );
  it("accepts HTTPS S3 upload", () =>
    expect(
      allowedUpload("https://bucket.s3.amazonaws.com/key?signature=x"),
    ).toBe(true));
  it("rejects injected metadata", () =>
    expect(() =>
      validateMetadata({ ...metadata, community: "../bad" }),
    ).toThrow());
  it("follows multipart flow without leaking bearer to storage", async () => {
    const network = vi
      .fn()
      .mockResolvedValueOnce(
        json({
          user_media: { uuid },
          upload_urls: [
            {
              url: "https://bucket.s3.amazonaws.com/file",
              offset: 0,
              length: 4,
              part_number: 1,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(new Response("", { headers: { etag: "part" } }))
      .mockResolvedValueOnce(json({}))
      .mockResolvedValueOnce(json({ package_version: { name: "Test" } }));
    const result = await publishPackage(
      Buffer.from("PKxx"),
      metadata,
      "secret-token",
      network,
    );
    expect(network).toHaveBeenCalledTimes(4);
    expect(network.mock.calls[0][1].headers.Authorization).toBe(
      "Bearer secret-token",
    );
    expect(network.mock.calls[1][1].headers.Authorization).toBeUndefined();
    expect(network.mock.calls[1][1].redirect).toBe("error");
    expect(JSON.parse(network.mock.calls[3][1].body)).toMatchObject({
      author_name: "Team",
      upload_uuid: uuid,
      communities: ["valheim"],
    });
    expect(result.url).toBe("https://thunderstore.io/c/valheim/p/Team/Test/");
  });
  it("aborts invalid upload plans without sending package bytes", async () => {
    const network = vi
      .fn()
      .mockResolvedValueOnce(
        json({
          user_media: { uuid },
          upload_urls: [
            {
              url: "https://evil.test/file",
              offset: 0,
              length: 4,
              part_number: 1,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(json({}));
    await expect(
      publishPackage(Buffer.from("PKxx"), metadata, "secret", network),
    ).rejects.toThrow();
    expect(network.mock.calls[1][0]).toContain("/abort-upload/");
  });
  it("does not echo server error body or token", async () => {
    const network = vi
      .fn()
      .mockResolvedValue(json({ error: "secret-token" }, 401));
    await expect(
      publishPackage(Buffer.from("PKxx"), metadata, "secret-token", network),
    ).rejects.toThrow("HTTP 401");
  });
});
