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
  it.each([
    "https://s3.us-west-004.backblazeb2.com/bucket/key?X-Amz-Signature=secret",
    "https://thunderstore.s3.us-west-004.backblazeb2.com/key",
    "https://bucket.r2.cloudflarestorage.com/key",
    "https://fra1.digitaloceanspaces.com/thunderstore-usermedia/key?X-Amz-Signature=secret",
    "https://thunderstore-usermedia.fra1.digitaloceanspaces.com/key?uploadId=upload&partNumber=1",
    "https://nyc3.digitaloceanspaces.com/bucket/key",
    "https://thunderstore-usermedia.sgp1.digitaloceanspaces.com:443/key",
  ])("accepts supported S3-compatible storage %s", (url) =>
    expect(allowedUpload(url)).toBe(true),
  );
  it.each([
    "https://s3.us-west-004.backblazeb2.com.evil.test/key",
    "http://s3.us-west-004.backblazeb2.com/key",
    "https://user@s3.us-west-004.backblazeb2.com/key",
    "https://s3.us-west-004.backblazeb2.com:444/key",
    "https://127.0.0.1/key",
    "https://localhost/key",
    "file:///etc/passwd",
    "https://evilbackblazeb2.com/key",
    "http://fra1.digitaloceanspaces.com/key",
    "https://user:pass@fra1.digitaloceanspaces.com/key",
    "https://fra1.digitaloceanspaces.com:444/key",
    "https://fra1.digitaloceanspaces.com.evil.test/key",
    "https://evildigitaloceanspaces.com/key",
    "https://digitaloceanspaces.com/key",
    "https://fra1.cdn.digitaloceanspaces.com/key",
    "https://bucket.fra1.cdn.digitaloceanspaces.com/key",
    "https://nested.bucket.fra1.digitaloceanspaces.com/key",
  ])("rejects unsafe storage variant %s", (url) =>
    expect(allowedUpload(url)).toBe(false),
  );
  it("rejects injected metadata", () =>
    expect(() =>
      validateMetadata({ ...metadata, community: "../bad" }),
    ).toThrow());
  it.each([
    "bucket.s3.amazonaws.com",
    "s3.us-west-004.backblazeb2.com",
    "fra1.digitaloceanspaces.com",
    "thunderstore-usermedia.fra1.digitaloceanspaces.com",
  ])(
    "follows multipart flow on %s without leaking bearer to storage",
    async (host) => {
      const network = vi
        .fn()
        .mockResolvedValueOnce(
          json({
            user_media: { uuid },
            upload_urls: [
              {
                url: `https://${host}/file`,
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
      expect(network.mock.calls[1][1].headers["Content-Length"]).toBe("4");
      expect(network.mock.calls[1][1].headers["Content-MD5"]).toBeTruthy();
      expect(JSON.parse(network.mock.calls[3][1].body)).toMatchObject({
        author_name: "Team",
        upload_uuid: uuid,
        communities: ["valheim"],
      });
      expect(result.url).toBe("https://thunderstore.io/c/valheim/p/Team/Test/");
    },
  );
  it("uploads a presigned DigitalOcean multipart plan without rewriting URLs", async () => {
    const urls = [1, 2].map(
      (part) =>
        `https://fra1.digitaloceanspaces.com/thunderstore-usermedia/file?uploadId=example&partNumber=${part}&X-Amz-Signature=private${part}`,
    );
    const network = vi
      .fn()
      .mockResolvedValueOnce(
        json({
          user_media: { uuid },
          upload_urls: [
            { url: urls[1], offset: 2, length: 2, part_number: 2 },
            { url: urls[0], offset: 0, length: 2, part_number: 1 },
          ],
        }),
      )
      .mockResolvedValueOnce(new Response("", { headers: { etag: '"first"' } }))
      .mockResolvedValueOnce(
        new Response("", { headers: { etag: '"second"' } }),
      )
      .mockResolvedValueOnce(json({}))
      .mockResolvedValueOnce(json({ package_version: { name: "Test" } }));
    await publishPackage(
      Buffer.from("PKxx"),
      metadata,
      "secret-token",
      network,
    );
    expect(network).toHaveBeenCalledTimes(5);
    for (const [index, body] of ["PK", "xx"].entries()) {
      const [url, options] = network.mock.calls[index + 1];
      expect(url).toBe(urls[index]);
      expect(options.body.toString()).toBe(body);
      expect(options.method).toBe("PUT");
      expect(options.redirect).toBe("error");
      expect(options.headers["Content-Length"]).toBe("2");
      expect(options.headers.Authorization).toBeUndefined();
    }
    expect(JSON.parse(network.mock.calls[3][1].body)).toEqual({
      parts: [
        { ETag: '"first"', PartNumber: 1 },
        { ETag: '"second"', PartNumber: 2 },
      ],
    });
    expect(network.mock.calls[4][0]).toContain("submission/submit/");
  });
  it("aborts an insecure DigitalOcean plan without uploading package bytes", async () => {
    const network = vi
      .fn()
      .mockResolvedValueOnce(
        json({
          user_media: { uuid },
          upload_urls: [
            {
              url: "http://fra1.digitaloceanspaces.com/key",
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
    expect(network).toHaveBeenCalledTimes(2);
    expect(network.mock.calls[1][0]).toContain("abort-upload/");
    expect(
      network.mock.calls.every(([, options]) => options.method === "POST"),
    ).toBe(true);
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
  it.each([
    [{ offset: 1, length: 4, part_number: 1 }],
    [{ offset: 0, length: 5, part_number: 1 }],
    [{ offset: 0, length: 0, part_number: 1 }],
    [{ offset: 0, length: 2, part_number: 1 }],
    [
      { offset: 0, length: 2, part_number: 1 },
      { offset: 2, length: 2, part_number: 1 },
    ],
    [{ offset: 0, length: 4, part_number: 0 }],
    [{ offset: 0, length: 4, part_number: 2 }],
    [null],
  ])("rejects invalid plan before any PUT %#", async (...plan) => {
    const network = vi
      .fn()
      .mockResolvedValueOnce(
        json({
          user_media: { uuid },
          upload_urls: plan.map(
            (p) => p && { url: "https://bucket.s3.amazonaws.com/file", ...p },
          ),
        }),
      )
      .mockResolvedValueOnce(json({}));
    await expect(
      publishPackage(Buffer.from("PKxx"), metadata, "secret", network),
    ).rejects.toThrow();
    expect(network).toHaveBeenCalledTimes(2);
    expect(network.mock.calls[1][0]).toContain("abort-upload");
  });
  it("reports only unsupported hostname, never signed URL or credentials", async () => {
    const network = vi
      .fn()
      .mockResolvedValueOnce(
        json({
          user_media: { uuid },
          upload_urls: [
            {
              url: "https://unknown.test/key?X-Amz-Signature=private",
              offset: 0,
              length: 4,
              part_number: 1,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(json({}));
    let message = "";
    try {
      await publishPackage(Buffer.from("PKxx"), metadata, "secret", network);
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain("unknown.test");
    expect(message).not.toMatch(/private|secret|X-Amz/);
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
