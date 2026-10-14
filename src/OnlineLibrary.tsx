import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  ExternalLink,
  Globe,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { games } from "./lib/model";
import type { CatalogItem, PackageSummary, RemotePackage } from "./lib/online";
import { openExternal } from "./lib/storage";
interface Props {
  onImport: (p: RemotePackage, game: string) => void;
  notify: (s: string) => void;
}
export default function OnlineLibrary({ onImport, notify }: Props) {
  const [communities, setCommunities] = useState<CatalogItem[]>(games);
  const [community, setCommunity] = useState("valheim");
  const [custom, setCustom] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PackageSummary[]>([]);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [last, setLast] = useState({ community: "valheim", query: "" });
  const [verified, setVerified] = useState("");
  const chosen = community === "custom" ? custom : community;
  async function load(next = 1, paging = false) {
    if (!window.tsat) return;
    const params = paging ? last : { community: chosen, query };
    setBusy(true);
    setError("");
    try {
      const r = await window.tsat.catalog("packages", {
        ...params,
        page: next,
      });
      setResults(r.packages);
      setMore(r.more);
      setPage(next);
      setSearched(true);
      setLast(params);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="info-strip">
        <ShieldCheck size={20} />
        <span>
          Живые данные Thunderstore по вашему запросу. Импорт создаёт{" "}
          <strong>новый локальный черновик метаданных</strong>, не скачивает код
          и не меняет опубликованный мод.
        </span>
      </div>
      {!window.tsat && (
        <div className="desktop-only">
          <Globe size={22} />
          <div>
            <strong>Онлайн-каталог работает в EXE</strong>
            <p>
              Веб-превью не обращается к API и не хранит токены. Для просмотра
              модов откройте официальный сайт.
            </p>
            <button
              className="text-button"
              onClick={() => openExternal("https://thunderstore.io/")}
            >
              Перейти в Thunderstore <ExternalLink size={14} />
            </button>
          </div>
        </div>
      )}
      <section className="panel online-panel">
        <div className="section-heading">
          <div>
            <h2>Один каталог. Много миров.</h2>
            <p>Найдите пакет по названию или namespace команды.</p>
          </div>
          <button
            className="button"
            disabled={!window.tsat || busy || refreshing}
            onClick={async () => {
              setRefreshing(true);
              setError("");
              try {
                const list = await window.tsat!.catalog("communities");
                setCommunities(list);
                notify(`Загружено сообществ: ${list.length}`);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setRefreshing(false);
              }
            }}
          >
            {refreshing ? (
              <Loader2 className="spin" size={14} />
            ) : (
              <RefreshCw size={14} />
            )}
            Обновить игры
          </button>
        </div>
        <form
          className="online-search"
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
        >
          <label className="field">
            Сообщество
            <select
              disabled={busy}
              value={community}
              onChange={(e) => setCommunity(e.target.value)}
            >
              {communities.map((g) => (
                <option value={g.id} key={g.id}>
                  {g.name}
                </option>
              ))}
              <option value="custom">Другое…</option>
            </select>
          </label>
          {community === "custom" && (
            <label className="field">
              Идентификатор
              <input
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
              />
            </label>
          )}
          <label className="field grow">
            Название или команда
            <input
              value={query}
              maxLength={128}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="BepInEx, YourTeam…"
            />
          </label>
          <button
            className="button primary"
            disabled={!window.tsat || busy || refreshing}
          >
            {busy ? (
              <Loader2 className="spin" size={16} />
            ) : (
              <Search size={16} />
            )}
            Найти
          </button>
        </form>
        {window.tsat && (
          <button
            className="text-button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const user = await window.tsat!.verifyToken();
                setVerified(
                  `${user.username} · ${user.teams.join(", ") || "нет активных команд"}`,
                );
                setQuery(user.teams[0] ?? "");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <ShieldCheck size={15} />
            Проверить сохранённый токен и выбрать мою команду
          </button>
        )}
        {verified && (
          <p className="saved-token">
            <CheckCircle2 size={15} />
            Авторизация подтверждена: {verified}. Права публикации проверяются
            отдельно.
          </p>
        )}
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
      </section>
      <div className="online-results">
        {results.map((p) => (
          <article
            className="panel online-package"
            key={`${p.namespace}-${p.name}`}
          >
            <span className="soft-icon">
              <Package size={21} />
            </span>
            <div className="grow">
              <span className="eyebrow">{p.namespace}</span>
              <h3>{p.name}</h3>
              <p>{p.description}</p>
              <span className="muted">
                <Download size={12} /> {p.downloads.toLocaleString("ru-RU")}{" "}
                загрузок{p.deprecated ? " · Устарел" : ""}
              </span>
            </div>
            <div className="online-package-actions">
              <button
                className="button"
                onClick={() =>
                  openExternal(
                    `https://thunderstore.io/c/${last.community}/p/${p.namespace}/${p.name}/`,
                  )
                }
              >
                На сайте <ExternalLink size={13} />
              </button>
              <button
                className="text-button"
                disabled={busy}
                onClick={async () => {
                  if (!window.tsat) return;
                  setBusy(true);
                  try {
                    onImport(
                      await window.tsat.catalog("package", {
                        namespace: p.namespace,
                        name: p.name,
                      }),
                      last.community,
                    );
                  } catch (e) {
                    notify((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Plus size={14} />
                Черновик из метаданных
              </button>
            </div>
          </article>
        ))}
      </div>
      {searched && (
        <div className="pagination">
          <button
            className="button"
            disabled={page <= 1 || busy}
            onClick={() => load(page - 1, true)}
          >
            <ArrowLeft size={14} />
            Назад
          </button>
          <span>
            Страница {page} · {last.community}
          </span>
          <button
            className="button"
            disabled={!more || busy}
            onClick={() => load(page + 1, true)}
          >
            Далее <ArrowRight size={14} />
          </button>
        </div>
      )}
      {!results.length && (
        <div className="empty-state">
          <Globe size={38} />
          <h3>
            {searched
              ? "Ничего не найдено"
              : "Ваши моды — часть большого сообщества"}
          </h3>
          <p>
            {searched
              ? "Измените запрос или сообщество."
              : "Выберите игру и запустите поиск. Запросы выполняются только по нажатию."}
          </p>
        </div>
      )}
    </>
  );
}
