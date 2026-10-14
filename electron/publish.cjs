const { createHash } = require("node:crypto");
const BASE = "https://thunderstore.io/api/experimental/";
function validateMetadata(m) {
  if (
    !m ||
    !/^[A-Za-z0-9_]{1,128}-\d+\.\d+\.\d+\.zip$/.test(m.filename) ||
    !/^[A-Za-z0-9_]{1,64}$/.test(m.team) ||
    !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(m.community) ||
    typeof m.nsfw !== "boolean" ||
    !Array.isArray(m.categories) ||
    m.categories.length > 100 ||
    !m.categories.every(
      (s) => typeof s === "string" && /^[a-z0-9_-]{1,128}$/.test(s),
    )
  )
    throw new Error("Некорректные параметры публикации.");
}
function allowedUpload(url) {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      (!u.port || u.port === "443") &&
      [".amazonaws.com", ".r2.cloudflarestorage.com", ".thunderstore.io"].some(
        (domain) => u.hostname.endsWith(domain),
      )
    );
  } catch {
    return false;
  }
}
async function publishPackage(bytes, metadata, token, fetcher = fetch) {
  validateMetadata(metadata);
  async function api(endpoint, data) {
    const r = await fetcher(BASE + endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
      redirect: "error",
      signal: AbortSignal.timeout(120000),
    });
    if (!r.ok)
      throw new Error(
        `Thunderstore: HTTP ${r.status}. ${r.status === 401 || r.status === 403 ? "Проверьте токен и права команды." : "Проверьте версию, зависимости, категории и правила сообщества. Подробности доступны при загрузке ZIP через сайт."}`,
      );
    return r.status === 204 ? null : r.json();
  }
  let uuid;
  let submitting = false;
  try {
    const init = await api("usermedia/initiate-upload/", {
      filename: metadata.filename,
      file_size_bytes: bytes.length,
    });
    uuid = init?.user_media?.uuid;
    if (typeof uuid !== "string" || !/^[0-9a-f-]{36}$/i.test(uuid)) {
      uuid = undefined;
      throw new Error("Неожиданный ответ сервера загрузки.");
    }
    if (
      !Array.isArray(init.upload_urls) ||
      !init.upload_urls.length ||
      init.upload_urls.length > 1000
    )
      throw new Error("Сервер не предоставил части загрузки.");
    let covered = 0;
    const plans = [...init.upload_urls].sort((a, b) => a.offset - b.offset);
    const partNumbers = new Set();
    for (const p of plans) {
      if (
        !Number.isSafeInteger(p.offset) ||
        !Number.isSafeInteger(p.length) ||
        p.offset !== covered ||
        p.length <= 0 ||
        p.offset + p.length > bytes.length ||
        !Number.isInteger(p.part_number) ||
        p.part_number < 1 ||
        partNumbers.has(p.part_number) ||
        !allowedUpload(p.url)
      )
        throw new Error(
          "Небезопасный или неподдерживаемый план загрузки. Используйте публикацию через сайт.",
        );
      partNumbers.add(p.part_number);
      covered += p.length;
    }
    if (covered !== bytes.length)
      throw new Error("Сервер запросил неполный архив.");
    const parts = [];
    for (const p of plans) {
      const chunk = bytes.subarray(p.offset, p.offset + p.length);
      const r = await fetcher(p.url, {
        method: "PUT",
        headers: {
          "Content-MD5": createHash("md5").update(chunk).digest("base64"),
        },
        body: chunk,
        redirect: "error",
        signal: AbortSignal.timeout(180000),
      });
      if (!r.ok || !r.headers.get("etag"))
        throw new Error(
          `Не удалось отправить часть архива (HTTP ${r.status}).`,
        );
      parts.push({ ETag: r.headers.get("etag"), PartNumber: p.part_number });
    }
    await api(`usermedia/${uuid}/finish-upload/`, { parts });
    submitting = true;
    const result = await api("submission/submit/", {
      author_name: metadata.team,
      categories: [],
      communities: [metadata.community],
      community_categories: { [metadata.community]: metadata.categories },
      has_nsfw_content: metadata.nsfw,
      upload_uuid: uuid,
    });
    if (!result?.package_version?.name)
      throw new Error(
        "Ответ публикации не распознан. Проверьте сайт перед повторной отправкой.",
      );
    return {
      url: `https://thunderstore.io/c/${metadata.community}/p/${encodeURIComponent(metadata.team)}/${encodeURIComponent(result.package_version.name)}/`,
    };
  } catch (e) {
    if (uuid && !submitting) {
      try {
        await api(`usermedia/${uuid}/abort-upload/`, {});
      } catch {
        /* best effort, never mask original failure */
      }
    }
    if (e instanceof Error && !/fetch|timeout|abort/i.test(e.message)) throw e;
    throw new Error(
      submitting
        ? "Соединение прервано при публикации. Проверьте страницу пакета перед повторной отправкой."
        : "Ошибка сети. Проверьте соединение и попробуйте позже.",
    );
  }
}
module.exports = { publishPackage, validateMetadata, allowedUpload };
