const { t } = require("../shared/i18n.cjs");
const BASE = "https://thunderstore.io/api/experimental/";
const slug = (value) =>
  typeof value === "string" &&
  /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value) &&
  value.length <= 128;
const name = (value) =>
  typeof value === "string" && /^[A-Za-z0-9_]{1,128}$/.test(value);
async function getJson(endpoint, token, fetcher = fetch) {
  const response = await fetcher(BASE + endpoint, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    redirect: "error",
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok)
    throw new Error(
      `Thunderstore: HTTP ${response.status}. ${[401, 403].includes(response.status) ? t("Проверьте токен и права команды.") : t("Попробуйте позже или откройте официальный сайт.")}`,
    );
  const reader = response.body?.getReader();
  if (!reader) throw new Error(t("Thunderstore вернул пустой ответ."));
  let size = 0;
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 4 * 1024 * 1024)
        throw new Error(t("Ответ Thunderstore превышает безопасный лимит."));
      chunks.push(Buffer.from(value));
    }
  } catch (e) {
    await reader.cancel().catch(() => {});
    throw e;
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error(t("Неподдерживаемый ответ Thunderstore."));
  }
}
async function listAll(endpoint, fetcher) {
  const results = [];
  let next = endpoint;
  for (let count = 0; next && count < 30; count++) {
    const data = await getJson(next, undefined, fetcher);
    if (!Array.isArray(data.results))
      throw new Error(
        t("Формат каталога изменился. Используйте официальный сайт."),
      );
    results.push(...data.results);
    if (!data.next) return results;
    const url = new URL(data.next, BASE);
    const expected = new URL(endpoint, BASE);
    if (
      url.origin !== expected.origin ||
      url.pathname !== expected.pathname ||
      url.username ||
      url.password
    )
      throw new Error(t("Небезопасная пагинация каталога."));
    next = endpoint + url.search;
  }
  throw new Error(t("Каталог слишком большой. Используйте официальный сайт."));
}
async function catalog(operation, params = {}, fetcher = fetch) {
  if (!params || typeof params !== "object")
    throw new Error(t("Неверные параметры каталога."));
  if (operation === "communities") {
    const result = await listAll("community/", fetcher);
    return result
      .filter((c) => slug(c.identifier) && typeof c.name === "string")
      .map((c) => ({ id: c.identifier, name: c.name.slice(0, 160) }));
  }
  if (operation === "categories" && slug(params.community)) {
    const result = await listAll(
      `community/${params.community}/category/`,
      fetcher,
    );
    return result
      .filter((c) => slug(c.slug) && typeof c.name === "string")
      .map((c) => ({ id: c.slug, name: c.name.slice(0, 160) }));
  }
  if (
    operation === "packages" &&
    slug(params.community) &&
    typeof params.query === "string" &&
    params.query.length <= 128 &&
    Number.isInteger(params.page) &&
    params.page >= 1 &&
    params.page <= 10000
  ) {
    const qs = new URLSearchParams({
      q: params.query,
      page: String(params.page),
      ordering: "last-updated",
    });
    const data = await getJson(
      `frontend/c/${params.community}/packages/?${qs}`,
      undefined,
      fetcher,
    );
    if (!Array.isArray(data.packages))
      throw new Error(
        t("Формат поиска изменился. Используйте официальный сайт."),
      );
    return {
      more: data.has_more_pages === true,
      packages: data.packages
        .filter((p) => name(p.namespace) && name(p.package_name))
        .map((p) => ({
          namespace: p.namespace,
          name: p.package_name,
          description: String(p.description ?? "").slice(0, 250),
          downloads: Number.isFinite(p.download_count) ? p.download_count : 0,
          deprecated: p.is_deprecated === true,
        })),
    };
  }
  if (operation === "package" && name(params.namespace) && name(params.name)) {
    const p = await getJson(
      `package/${params.namespace}/${params.name}/`,
      undefined,
      fetcher,
    );
    if (
      !p.latest ||
      typeof p.latest.version_number !== "string" ||
      !/^\d+\.\d+\.\d+$/.test(p.latest.version_number)
    )
      throw new Error(t("Пакет не содержит подходящей версии."));
    return {
      namespace: params.namespace,
      name: params.name,
      version: p.latest.version_number,
      description: String(p.latest.description ?? "").slice(0, 250),
      dependencies: Array.isArray(p.latest.dependencies)
        ? p.latest.dependencies.filter((d) => typeof d === "string")
        : [],
      website:
        typeof p.latest.website_url === "string" ? p.latest.website_url : "",
      downloads: Number.isFinite(p.total_downloads) ? p.total_downloads : 0,
      deprecated: p.is_deprecated === true,
    };
  }
  throw new Error(t("Неверный запрос каталога."));
}
async function verifyToken(token, fetcher = fetch) {
  const profile = await getJson("current-user/", token, fetcher);
  if (
    typeof profile.username !== "string" ||
    !profile.username ||
    !Array.isArray(profile.teams)
  )
    throw new Error(
      t(
        "Токен не подтвердил авторизацию. Создайте service account команды заново.",
      ),
    );
  return { username: profile.username, teams: profile.teams.filter(name) };
}
module.exports = { catalog, verifyToken };
