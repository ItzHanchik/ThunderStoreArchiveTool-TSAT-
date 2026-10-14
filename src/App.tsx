import { t, setLanguage, dateLocale } from "./lib/i18n";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  BookOpen,
  Boxes,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  CloudRain,
  Copy,
  ExternalLink,
  FileArchive,
  Folder,
  FolderOpen,
  Gamepad2,
  Grid2X2,
  HardDrive,
  List,
  Loader2,
  Moon,
  MoreHorizontal,
  Palette,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Snowflake,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import {
  defaults,
  gameInfo,
  games,
  newProject,
  sizeLabel,
  type BuildRecord,
  type Preferences,
  type Project,
} from "./lib/model";
import {
  createIcon,
  exportBytes,
  loadWorkspace,
  openExternal,
  saveWorkspace,
} from "./lib/storage";
import { buildPackage } from "./lib/package";
import Editor from "./Editor";
import OnlineLibrary from "./OnlineLibrary";
import { Modal } from "./components";

type Page = "online" | "projects" | "games" | "history" | "guide";
type Dialog = "new" | "appearance" | "account" | null;
const pageTitles: Record<Page, string> = {
  online: "Каталог Thunderstore",
  projects: "Мои проекты",
  games: "Игры и сообщества",
  history: "История сборок",
  guide: "Как это работает",
};
export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [history, setHistory] = useState<BuildRecord[]>([]);
  const [preferences, setPreferences] = useState<Preferences>(defaults);
  setLanguage(preferences.language);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [page, setPage] = useState<Page>("projects");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [query, setQuery] = useState("");
  const [game, setGame] = useState("all");
  const [layout, setLayout] = useState("grid");
  const [sort, setSort] = useState("updated");
  const [toast, setToast] = useState("");
  const [saveState, setSaveState] = useState(t("Сохранено на устройстве"));
  const [building, setBuilding] = useState(false);
  const [newGame, setNewGame] = useState("valheim");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const search = useRef<HTMLInputElement>(null);
  const saveQueue = useRef(Promise.resolve());
  const saveRevision = useRef(0);
  useEffect(() => {
    document.documentElement.lang = preferences.language;
    void window.tsat?.setLanguage(preferences.language).catch(() => {});
  }, [preferences.language]);
  const active = projects.find((p) => p.id === activeId);
  const notify = (message: string) => setToast(message);
  useEffect(() => {
    let cancelled = false;
    loadWorkspace()
      .then(async (w) => {
        await Promise.all(
          w.projects.map(async (p) => {
            if (!p.icon && p.template)
              p.icon = await createIcon(
                gameInfo(p.game).color,
                p.manifest.name,
              );
          }),
        );
        if (!cancelled) {
          setProjects(w.projects);
          setHistory(w.history);
          setPreferences(w.preferences);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(true);
          setToast(
            t(
              "Не удалось прочитать локальные данные. Проверьте разрешение на хранение данных и перезагрузите приложение.",
            ),
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useLayoutEffect(() => {
    if (!loaded) return;
    const revision = ++saveRevision.current;
    setSaveState(t("Сохранение…"));
    {
      saveQueue.current = saveQueue.current
        .catch(() => {})
        .then(() => saveWorkspace({ projects, history, preferences }))
        .then(() => {
          if (revision === saveRevision.current)
            setSaveState(t("Сохранено на устройстве"));
        })
        .catch(() => {
          if (revision !== saveRevision.current) return;
          setSaveState(t("Ошибка сохранения"));
          notify(
            t(
              "Хранилище недоступно или заполнено. Экспортируйте важные проекты и освободите место.",
            ),
          );
        });
    }
  }, [projects, history, preferences, loaded]);
  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
  }, [preferences.theme]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 6500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  function navigate(next: Page) {
    setPage(next);
    setActiveId(null);
    setQuery("");
  }
  function create(gameId = "valheim") {
    setNewGame(gameId);
    setDialog("new");
  }
  function update(next: Project) {
    setProjects((ps) =>
      ps.map((p) =>
        p.id === next.id
          ? { ...next, updatedAt: Date.now(), template: false }
          : p,
      ),
    );
  }
  async function build(p: Project) {
    if (building) return;
    setBuilding(true);
    try {
      const bytes = await buildPackage(p);
      const filename = `${p.manifest.name}-${p.manifest.version_number}.zip`;
      const saved = await exportBytes(bytes, filename);
      if (!saved) {
        notify(t("Сохранение отменено."));
        return;
      }
      setHistory((h) =>
        [
          {
            id: crypto.randomUUID(),
            project: p.manifest.name,
            version: p.manifest.version_number,
            game: p.game,
            at: Date.now(),
            size: bytes.length,
            filename,
          },
          ...h,
        ].slice(0, 100),
      );
      notify(t("Готово! {0} · {1}", filename, sizeLabel(bytes.length)));
    } catch (e) {
      notify(t("Сборка не выполнена: {0}", (e as Error).message));
    } finally {
      setBuilding(false);
    }
  }
  async function duplicate(p: Project) {
    const next = {
      ...p,
      id: crypto.randomUUID(),
      manifest: {
        ...p.manifest,
        name: `${p.manifest.name.slice(0, 120)}_copy`,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      template: false,
    };
    setProjects((ps) => [next, ...ps]);
    notify(t("Создана независимая копия проекта."));
  }
  const filtered = projects
    .filter(
      (p) =>
        (game === "all" || p.game === game) &&
        `${p.manifest.name} ${gameInfo(p.game).name}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.manifest.name.localeCompare(b.manifest.name)
        : b.updatedAt - a.updatedAt,
    );
  const style = {
    "--accent": preferences.accent,
    "--bg-image": preferences.background
      ? `url("${preferences.background}")`
      : "none",
    "--bg-opacity": preferences.opacity / 100,
  } as CSSProperties;
  return (
    <div className={`app density-${preferences.density}`} style={style}>
      <div className="custom-background" />
      <Weather kind={preferences.weather} />
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => navigate("projects")}
          aria-label={t("TSAT — Главная")}
        >
          <span className="brand-mark">
            <Zap size={24} fill="currentColor" />
          </span>
          <span>
            TSAT<small>MOD CREATOR WORKSPACE</small>
          </span>
        </button>
        <div className="workspace-chip">
          <span className="workspace-avatar">W</span>
          <div>
            {t("Личное пространство")}
            <small>{t("Всё для вашего следующего мода")}</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <span className="nav-label">{t("РАБОЧЕЕ ПРОСТРАНСТВО")}</span>
        <nav>
          {(
            [
              ["projects", FolderOpen, t("Мои проекты")],
              ["games", Gamepad2, t("Игры и сообщества")],
              ["history", FileArchive, t("История сборок")],
              ["online", Boxes, t("Каталог Thunderstore")],
            ] as const
          ).map(([id, Icon, label]) => (
            <button
              key={id}
              className={`nav-item ${page === id ? "active" : ""}`}
              onClick={() => navigate(id)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {id === "projects" && <b>{projects.length}</b>}
            </button>
          ))}
        </nav>
        <span className="nav-label second">{t("ИНСТРУМЕНТЫ")}</span>
        <nav>
          <button className="nav-item" onClick={() => setDialog("appearance")}>
            <Palette size={19} />
            <span>{t("Персонализация")}</span>
            <span className="little-dot" />
          </button>
          <button
            className={`nav-item ${page === "guide" ? "active" : ""}`}
            onClick={() => navigate("guide")}
          >
            <BookOpen size={19} />
            <span>{t("С чего начать")}</span>
            <ExternalLink size={13} />
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="local-note">
            <div className="local-note-icon">
              <ShieldCheck size={19} />
            </div>
            <strong>{t("Ваши моды. Ваши правила.")}</strong>
            <p>
              {t("Проекты остаются на устройстве.")}
              <br />
              {t("Творчество — без лишнего шума.")}
            </p>
            <button onClick={() => navigate("guide")}>
              {t("Больше о TSAT")}
              <ArrowUpRight />
            </button>
          </div>
          <button
            className="account-button"
            onClick={() => setDialog("account")}
          >
            <span className="avatar">
              <UserRound size={19} />
            </span>
            <span>
              {t("Аккаунт Thunderstore")}
              <small>{t("Подключить команду")}</small>
            </span>
            <ChevronRight size={16} />
          </button>
          <div className="sidebar-version">
            <span>
              <span className="status-dot" /> TSAT v0.1.2
            </span>
            <span>EARLY ACCESS</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <span>{t("Рабочее пространство")}</span>
            <ChevronRight size={13} />
            <strong>
              {active ? active.manifest.name : t(pageTitles[page])}
            </strong>
          </div>
          <div className="top-actions">
            <button
              className="button small language-toggle"
              aria-label="Русский / English"
              onClick={() =>
                setPreferences((p) => ({
                  ...p,
                  language: p.language === "ru" ? "en" : "ru",
                }))
              }
            >
              {preferences.language.toUpperCase()}
            </button>
            <label className="global-search">
              <Search size={16} />
              <input
                ref={search}
                placeholder={t("Найти проект…")}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage("projects");
                  setActiveId(null);
                }}
              />
              <kbd>Ctrl K</kbd>
            </label>
            <button
              className="icon-button"
              title={t("Изменить тему")}
              onClick={() =>
                setPreferences((p) => ({
                  ...p,
                  theme: p.theme === "light" ? "dark" : "light",
                }))
              }
            >
              {preferences.theme === "light" ? (
                <Moon size={19} />
              ) : (
                <Sun size={19} />
              )}
            </button>
            <span className="top-divider" />
            <button
              className="top-avatar"
              title={t("Аккаунт")}
              onClick={() => setDialog("account")}
            >
              T
            </button>
          </div>
        </header>
        <main>
          {!loaded ? (
            <div className="empty-state">
              <Loader2 className={loadError ? "" : "spin"} />
              <h2>
                {loadError
                  ? t("Хранилище недоступно")
                  : t("Открываем мастерскую…")}
              </h2>
              {loadError && (
                <p>
                  {t(
                    "Данные не перезаписаны. Разрешите локальное хранение и перезагрузите страницу.",
                  )}
                </p>
              )}
            </div>
          ) : active ? (
            <Editor
              key={active.id}
              project={active}
              onDelete={() => setDeleteId(active.id)}
              onChange={update}
              onBack={() => setActiveId(null)}
              onBuild={() => build(active)}
              building={building}
              notify={notify}
              onAccount={() => setDialog("account")}
            />
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">{t("ВАША МАСТЕРСКАЯ МОДОВ")}</div>
                  <h1>
                    {t(pageTitles[page])}
                    <span className="heading-dot">.</span>
                  </h1>
                  <p>
                    {page === "projects"
                      ? t(
                          "От первой идеи до готового архива. Всё в одном месте.",
                        )
                      : page === "games"
                        ? t("Разные миры. Один привычный рабочий процесс.")
                        : page === "history"
                          ? t("Каждый релиз — ещё один шаг вперёд.")
                          : t("Меньше рутины. Больше времени на создание.")}
                  </p>
                </div>
                <button className="button primary" onClick={() => create()}>
                  <Plus size={18} />
                  {t("Новый проект")}
                </button>
              </div>
              {page === "projects" && (
                <>
                  {!query && (
                    <>
                      <section className="hero">
                        <div className="hero-content">
                          <span className="hero-kicker">
                            <span /> {t("СОЗДАВАЙТЕ. УПАКОВЫВАЙТЕ. ДЕЛИТЕСЬ.")}
                          </span>
                          <h2>
                            {t("Большие идеи.")}
                            <br />
                            {t("Аккуратные архивы.")}
                          </h2>
                          <p>
                            {t("Вы создаёте моды — мы позаботимся о деталях.")}
                            <br />
                            {t(
                              "Правильная структура, проверка и ZIP в пару кликов.",
                            )}
                          </p>
                          <button
                            className="button hero-button"
                            onClick={() => create()}
                          >
                            {t("Создать что-то классное")}
                            <ArrowRight size={16} />
                          </button>
                        </div>
                        <span className="hero-bottom">
                          <Zap size={12} /> BUILT FOR THUNDERSTORE
                        </span>
                      </section>
                      <section className="stats-row">
                        <Stat
                          icon={<Folder size={19} />}
                          value={projects.length.toString().padStart(2, "0")}
                          label={t("проектов в работе")}
                          detail={t("Все идеи под рукой")}
                        />
                        <Stat
                          icon={<Gamepad2 size={19} />}
                          value={new Set(projects.map((p) => p.game)).size
                            .toString()
                            .padStart(2, "0")}
                          label={t("игровых сообществ")}
                          detail={t("Без привязки к одной игре")}
                        />
                        <Stat
                          icon={<Boxes size={19} />}
                          value={history.length.toString().padStart(2, "0")}
                          label={t("архивов собрано")}
                          detail={t("Маленькие шаги. Большие релизы.")}
                        />
                      </section>
                    </>
                  )}
                  <section className="projects-section">
                    <div className="section-heading">
                      <div>
                        <h2>
                          {t("Библиотека проектов")}{" "}
                          <span className="count-badge">{projects.length}</span>
                        </h2>
                        <p>{t("Ваш следующий релиз начинается здесь")}</p>
                      </div>
                      <div className="filters">
                        <label className="select-control">
                          <SlidersHorizontal size={14} />
                          <select
                            aria-label={t("Фильтр по игре")}
                            value={game}
                            onChange={(e) => setGame(e.target.value)}
                          >
                            <option value="all">{t("Все игры")}</option>
                            {[...new Set(projects.map((p) => p.game))].map(
                              (id) => (
                                <option key={id} value={id}>
                                  {gameInfo(id).name}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                        <label className="select-control sort-control">
                          <select
                            aria-label={t("Сортировка")}
                            value={sort}
                            onChange={(e) => setSort(e.target.value)}
                          >
                            <option value="updated">
                              {t("По обновлению")}
                            </option>
                            <option value="name">{t("По названию")}</option>
                          </select>
                        </label>
                        <div className="view-switch">
                          <button
                            aria-label={t("Сетка")}
                            aria-pressed={layout === "grid"}
                            className={layout === "grid" ? "selected" : ""}
                            onClick={() => setLayout("grid")}
                          >
                            <Grid2X2 size={16} />
                          </button>
                          <button
                            aria-label={t("Список")}
                            aria-pressed={layout === "list"}
                            className={layout === "list" ? "selected" : ""}
                            onClick={() => setLayout("list")}
                          >
                            <List size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div
                      className={`project-grid ${layout === "list" ? "list-layout" : ""}`}
                    >
                      {filtered.map((p) => (
                        <ProjectCard
                          key={p.id}
                          project={p}
                          onOpen={() => setActiveId(p.id)}
                          onDuplicate={() => duplicate(p)}
                          onDelete={() => setDeleteId(p.id)}
                        />
                      ))}
                    </div>
                    {!filtered.length && (
                      <div className="empty-state">
                        <FolderOpen size={34} />
                        <h3>
                          {projects.length
                            ? t("Ничего не нашлось")
                            : t("Место для вашей первой идеи")}
                        </h3>
                        <p>
                          {projects.length
                            ? t(
                                "Попробуйте другой запрос или выберите все игры.",
                              )
                            : t(
                                "Создайте проект и добавьте файлы своего мода.",
                              )}
                        </p>
                        <button
                          className="button"
                          onClick={() => {
                            if (projects.length) {
                              setQuery("");
                              setGame("all");
                            } else create();
                          }}
                        >
                          {projects.length
                            ? t("Сбросить фильтры")
                            : t("Создать проект")}
                        </button>
                      </div>
                    )}
                  </section>
                  <section className="quick-start">
                    <div className="quick-start-title">
                      <span className="soft-icon">
                        <Sparkles size={20} />
                      </span>
                      <div>
                        <h3>{t("От идеи до релиза")}</h3>
                        <p>{t("Три простых шага. Никакой магии.")}</p>
                      </div>
                      <button
                        onClick={() => navigate("guide")}
                        className="text-button"
                      >
                        {t("Краткое руководство")}
                        <ArrowRight size={15} />
                      </button>
                    </div>
                    <div className="steps">
                      <Step
                        number="01"
                        title={t("Добавьте файлы")}
                        text={t("Выберите игру и соберите свой проект.")}
                      />
                      <Step
                        number="02"
                        title={t("Проверьте детали")}
                        text={t("TSAT проверит manifest, иконку и структуру.")}
                      />
                      <Step
                        number="03"
                        title={t("Поделитесь с миром")}
                        text={t("Соберите ZIP для публикации в Thunderstore.")}
                      />
                    </div>
                  </section>
                  <div className="bottom-tip">
                    <span>
                      <span className="tiny-spark">✧</span>{" "}
                      {t("Пространство, которое вдохновляет.")}
                    </span>
                    <button onClick={() => setDialog("appearance")}>
                      {t("Настроить тему, фон и атмосферу")}
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </>
              )}
              {page === "online" && (
                <OnlineLibrary
                  notify={notify}
                  onImport={async (remote, gameId) => {
                    const p = newProject(remote.name, gameId);
                    p.team = remote.namespace;
                    const parts = remote.version.split(".").map(Number);
                    const patch = parts[2] < 2147483647 ? parts[2] + 1 : 0;
                    p.manifest = {
                      name: remote.name,
                      description: remote.description,
                      website_url: remote.website,
                      dependencies: remote.dependencies,
                      version_number: `${parts[0]}.${parts[1]}.${patch}`,
                    };
                    p.icon = await createIcon(
                      gameInfo(gameId).color,
                      remote.name,
                    );
                    setProjects((ps) => [p, ...ps]);
                    setActiveId(p.id);
                    setPage("projects");
                    notify(
                      t(
                        "Создан черновик метаданных. Добавьте свои файлы, иконку и README. Права на пакет не передаются.",
                      ),
                    );
                  }}
                />
              )}
              {page === "games" && (
                <>
                  <div className="info-strip">
                    <Gamepad2 size={20} />
                    <span>
                      {t(
                        "Универсальный manifest v1. TSAT не навязывает загрузчик или структуру файлов — они зависят от вашей игры.",
                      )}
                    </span>
                  </div>
                  <div className="games-grid">
                    {games.map((g) => (
                      <button
                        className="game-card"
                        key={g.id}
                        onClick={() => create(g.id)}
                      >
                        <img src={`./art/${g.art}.svg`} alt="" />
                        <span className="game-tag">{g.tag}</span>
                        <div>
                          <h3>{g.name}</h3>
                          <p>{t(g.subtitle)}</p>
                          <span>
                            {t("Создать проект")}
                            <Plus size={16} />
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="custom-game">
                    <div>
                      <h3>{t("Ваша игра не в списке?")}</h3>
                      <p>
                        {t(
                          "Укажите идентификатор любого сообщества Thunderstore при создании проекта.",
                        )}
                      </p>
                    </div>
                    <button className="button" onClick={() => create("custom")}>
                      {t("Другая игра")}
                      <Plus size={16} />
                    </button>
                  </div>
                </>
              )}
              {page === "history" && (
                <section className="panel">
                  <div className="section-heading">
                    <div>
                      <h2>{t("Локальный журнал")}</h2>
                      <p>
                        {t(
                          "Последние 100 экспортов. ZIP хранится в выбранной вами папке, а не в журнале.",
                        )}
                      </p>
                    </div>
                    {history.length > 0 && (
                      <button
                        className="button subtle"
                        onClick={() => {
                          if (
                            window.confirm(
                              t(
                                "Очистить журнал сборок? Сохранённые ZIP останутся на диске.",
                              ),
                            )
                          )
                            setHistory([]);
                        }}
                      >
                        {t("Очистить журнал")}
                      </button>
                    )}
                  </div>
                  {history.length ? (
                    <div className="history-list">
                      {history.map((h) => (
                        <div className="history-row" key={h.id}>
                          <span className="soft-icon">
                            <FileArchive size={22} />
                          </span>
                          <div>
                            <strong>{h.filename}</strong>
                            <small>
                              {gameInfo(h.game).name} ·{" "}
                              {new Date(h.at).toLocaleString(dateLocale())}
                            </small>
                          </div>
                          <span>{sizeLabel(h.size)}</span>
                          <span className="badge green">
                            <Check size={12} /> {t("Экспортирован")}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <FileArchive size={38} />
                      <h3>{t("Первый релиз ещё впереди")}</h3>
                      <p>
                        {t(
                          "Соберите ZIP в редакторе проекта — запись появится здесь.",
                        )}
                      </p>
                      <button
                        className="button"
                        onClick={() => navigate("projects")}
                      >
                        {t("К проектам")}
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  )}
                </section>
              )}
              {page === "guide" && (
                <Guide
                  onCreate={() => create()}
                  onAccount={() => setDialog("account")}
                />
              )}
            </>
          )}
        </main>
        <footer className="app-footer">
          <span>
            <span className="status-dot" /> {t(saveState)}
          </span>
          <span>
            {window.tsat ? "DESKTOP" : "WEB PREVIEW"}
            <span className="footer-separator">/</span>
            {t("Сделано для тех, кто создаёт")}
            <Zap size={12} />
          </span>
        </footer>
      </div>
      {dialog === "new" && (
        <NewProjectDialog
          game={newGame}
          onClose={() => setDialog(null)}
          onCreate={async (name, gameId) => {
            const p = newProject(name, gameId);
            p.icon = await createIcon(gameInfo(gameId).color, name);
            setProjects((ps) => [p, ...ps]);
            setActiveId(p.id);
            setPage("projects");
            setDialog(null);
            notify(t("Проект создан. Начните с описания и файлов мода."));
          }}
        />
      )}
      {dialog === "appearance" && (
        <Appearance
          preferences={preferences}
          onChange={setPreferences}
          onClose={() => setDialog(null)}
          notify={notify}
        />
      )}
      {dialog === "account" && (
        <Account onClose={() => setDialog(null)} notify={notify} />
      )}
      {deleteId && (
        <Modal
          title={t("Удалить проект?")}
          subtitle={t("Это действие нельзя отменить.")}
          onClose={() => setDeleteId(null)}
        >
          <p className="modal-copy">
            {t("Проект «")}
            {projects.find((p) => p.id === deleteId)?.manifest.name}
            {t(
              "» и его локальные файлы будут удалены. Уже экспортированные архивы останутся на диске.",
            )}
          </p>
          <div className="modal-actions">
            <button className="button" onClick={() => setDeleteId(null)}>
              {t("Отмена")}
            </button>
            <button
              className="button danger"
              onClick={() => {
                setProjects((ps) => ps.filter((p) => p.id !== deleteId));
                setActiveId((id) => (id === deleteId ? null : id));
                setDeleteId(null);
                notify(t("Проект удалён. Экспортированные архивы сохранены."));
              }}
            >
              {t("Удалить проект")}
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <span className="soft-icon">
            <CheckCheck size={18} />
          </span>
          <span>{toast}</span>
          <button
            className="icon-button"
            onClick={() => setToast("")}
            aria-label={t("Закрыть уведомление")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
function ArrowUpRight() {
  return <ExternalLink size={12} />;
}
function Stat({
  icon,
  value,
  label,
  detail,
}: {
  icon: ReactNode;
  value: string;
  label: string;
  detail: string;
}) {
  return (
    <div className="stat">
      <span className="stat-icon">{icon}</span>
      <div>
        <div>
          <strong>{value}</strong>
          <span>{label}</span>
        </div>
        <p>{detail}</p>
      </div>
    </div>
  );
}
function Step({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div className="step">
      <span>{number}</span>
      <div>
        <h4>{title}</h4>
        <p>{text}</p>
      </div>
    </div>
  );
}
function ProjectCard({
  project: p,
  onOpen,
  onDuplicate,
  onDelete,
}: {
  project: Project;
  onOpen: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const g = gameInfo(p.game);
  const [menu, setMenu] = useState(false);
  const [iconUrl, setIconUrl] = useState("");
  useEffect(() => {
    if (!p.icon) {
      setIconUrl("");
      return;
    }
    const url = URL.createObjectURL(
      new Blob([new Uint8Array(p.icon)], { type: "image/png" }),
    );
    setIconUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [p.icon]);
  return (
    <article className="project-card">
      <button
        className="project-art"
        onClick={onOpen}
        aria-label={t("Открыть {0}", p.manifest.name)}
      >
        <img src={`./art/${g.art}.svg`} alt="" />
        <span className="art-shade" />
        <span className="game-name">{g.name}</span>
        <span className="art-tag">
          <span /> {p.template ? t("Шаблон") : t("Проект")}
        </span>
        <span className="art-monogram" style={{ background: g.color }}>
          {iconUrl ? <img src={iconUrl} alt="" /> : p.manifest.name[0]}
        </span>
      </button>
      <div className="project-body">
        <div className="project-title-row">
          <button onClick={onOpen}>
            <h3>{p.manifest.name}</h3>
          </button>
          <div className="menu-container">
            <button
              className="icon-button"
              aria-label={t("Действия с {0}", p.manifest.name)}
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              <MoreHorizontal size={19} />
            </button>
            {menu && (
              <>
                <button
                  className="menu-backdrop"
                  aria-label={t("Закрыть меню")}
                  onClick={() => setMenu(false)}
                />
                <div className="dropdown">
                  <button
                    onClick={() => {
                      onDuplicate();
                      setMenu(false);
                    }}
                  >
                    <Copy size={14} /> {t("Дублировать")}
                  </button>
                  <button
                    onClick={() => {
                      onDelete();
                      setMenu(false);
                    }}
                  >
                    <Trash2 size={14} /> {t("Удалить")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        <p className="project-description">
          {p.manifest.description ||
            t("У каждой идеи есть начало. Добавьте описание.")}
        </p>
        <div className="project-meta">
          <span className="version">v{p.manifest.version_number}</span>
          <span className="badge">
            <span className="draft-dot" />
            {p.template ? t("Для знакомства") : t("Черновик")}
          </span>
          <span>
            {p.files.length} {t("файлов")}
          </span>
        </div>
        <div className="project-card-footer">
          <span>
            {p.template
              ? t("Готов к вашей идее")
              : t(
                  "Изменён {0}",
                  new Date(p.updatedAt).toLocaleDateString(dateLocale(), {
                    day: "numeric",
                    month: "short",
                  }),
                )}
          </span>
          <button
            className="delete-project-button"
            onClick={onDelete}
            aria-label={t("Удалить {0}", p.manifest.name)}
            title={t("Удалить проект")}
          >
            <Trash2 size={16} />
          </button>
          <button onClick={onOpen}>
            {t("Открыть проект")}
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </article>
  );
}
function NewProjectDialog({
  game,
  onClose,
  onCreate,
}: {
  game: string;
  onClose: () => void;
  onCreate: (name: string, game: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [chosen, setChosen] = useState(game);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal
      title={t("Давайте создадим что-то новое")}
      subtitle={t("Небольшая идея сегодня. Любимый мод завтра.")}
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await onCreate(name, chosen === "custom" ? custom : chosen);
          } catch {
            setError(t("Не удалось создать проект. Попробуйте ещё раз."));
            setBusy(false);
          }
        }}
      >
        <label className="field">
          {t("Название пакета")}
          <input
            autoFocus
            required
            pattern="[A-Za-z0-9_]{1,128}"
            maxLength={128}
            placeholder="My_Awesome_Mod"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <small>
            {t("Латинские буквы, цифры и подчёркивания. Без пробелов.")}
          </small>
        </label>
        <label className="field">
          {t("Для какой игры?")}
          <select value={chosen} onChange={(e) => setChosen(e.target.value)}>
            {games.map((g) => (
              <option value={g.id} key={g.id}>
                {g.name}
              </option>
            ))}
            <option value="custom">{t("Другое сообщество…")}</option>
          </select>
        </label>
        {chosen === "custom" && (
          <label className="field">
            {t("Идентификатор сообщества")}
            <input
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              placeholder={t("из thunderstore.io/c/идентификатор/")}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
            <small>
              {t("Скопируйте сегмент URL после /c/ на сайте Thunderstore.")}
            </small>
          </label>
        )}
        <div className="info-strip">
          <ShieldCheck size={19} />
          <span>
            {t(
              "Мы подготовим manifest, README и иконку 256 × 256. Всё можно изменить позже.",
            )}
          </span>
        </div>
        {error && <p className="error-text">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose}>
            {t("Отмена")}
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}
            {t("Создать проект")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function Appearance({
  preferences: p,
  onChange,
  onClose,
  notify,
}: {
  preferences: Preferences;
  onChange: (p: Preferences) => void;
  onClose: () => void;
  notify: (s: string) => void;
}) {
  const set = (part: Partial<Preferences>) => onChange({ ...p, ...part });
  async function background(file?: File) {
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      notify(t("Выберите PNG, JPG или WebP до 5 МБ."));
      return;
    }
    const r = new FileReader();
    r.onload = () => set({ background: String(r.result) });
    r.readAsDataURL(file);
  }
  return (
    <Modal
      title={t("Ваше пространство. Ваше настроение.")}
      subtitle={t("Настройки сохраняются только на этом устройстве.")}
      onClose={onClose}
      wide
    >
      <div className="setting-section">
        <h3>{t("Язык интерфейса")}</h3>
        <div className="segmented">
          <button
            className={p.language === "ru" ? "selected" : ""}
            onClick={() => set({ language: "ru" })}
          >
            Русский
          </button>
          <button
            className={p.language === "en" ? "selected" : ""}
            onClick={() => set({ language: "en" })}
          >
            English
          </button>
        </div>
        <p className="field-help">
          {t(
            "Шаблоны README и CHANGELOG всегда на английском. Ваши тексты не переводятся.",
          )}
        </p>
      </div>
      <div className="setting-section">
        <h3>{t("Оформление")}</h3>
        <div className="theme-options">
          {(["light", "dark"] as const).map((theme) => (
            <button
              key={theme}
              className={`theme-option ${theme} ${p.theme === theme ? "chosen" : ""}`}
              onClick={() => set({ theme: theme })}
            >
              <span className="theme-mini">
                <i />
                <i />
                <i />
              </span>
              <span>
                {theme === "light" ? <Sun size={16} /> : <Moon size={16} />}
                {theme === "light" ? t("Светлая") : t("Тёмная")}
                {p.theme === theme && <Check size={15} />}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="setting-section">
        <h3>{t("Цвет акцента")}</h3>
        <div className="accent-options">
          {[
            "#247d60",
            "#5866bc",
            "#9962ae",
            "#bd744a",
            "#bd5f79",
            "#397f9b",
          ].map((c) => (
            <button
              key={c}
              aria-label={t("Акцент {0}", c)}
              style={{ background: c }}
              onClick={() => set({ accent: c })}
            >
              {p.accent === c && <Check size={18} />}
            </button>
          ))}
          <label className="custom-color" title={t("Свой цвет")}>
            <Plus size={19} />
            <input
              type="color"
              aria-label={t("Свой цвет акцента")}
              value={p.accent}
              onChange={(e) => set({ accent: e.target.value })}
            />
          </label>
        </div>
      </div>
      <div className="setting-section">
        <h3>
          {t("Атмосфера")}
          <span className="muted">{t("немного магии на фоне")}</span>
        </h3>
        <div className="segmented">
          {(
            [
              ["none", Sun, t("Без эффектов")],
              ["snow", Snowflake, t("Снег")],
              ["rain", CloudRain, t("Дождь")],
            ] as const
          ).map(([id, Icon, label]) => (
            <button
              className={p.weather === id ? "selected" : ""}
              key={id}
              onClick={() => set({ weather: id })}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </div>
        <p className="field-help">
          {t(
            "Анимация отключается, если в системе включено уменьшение движения.",
          )}
        </p>
      </div>
      <div className="setting-section">
        <h3>{t("Свой фон")}</h3>
        <label className="background-upload">
          <Upload size={21} />
          <span>
            {p.background
              ? t("Заменить изображение")
              : t("Выберите что-то вдохновляющее")}
            <small>{t("PNG, JPG, WebP · до 5 МБ")}</small>
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => background(e.target.files?.[0])}
          />
        </label>
        {p.background && (
          <div className="background-controls">
            <label>
              {t("Видимость ·")}
              {p.opacity}%
              <input
                type="range"
                min="5"
                max="50"
                value={p.opacity}
                onChange={(e) => set({ opacity: +e.target.value })}
              />
            </label>
            <button
              className="text-button"
              onClick={() => set({ background: "" })}
            >
              <Trash2 size={14} />
              {t("Удалить фон")}
            </button>
          </div>
        )}
      </div>
      <div className="setting-section">
        <h3>{t("Плотность интерфейса")}</h3>
        <div className="segmented">
          <button
            className={p.density === "comfortable" ? "selected" : ""}
            onClick={() => set({ density: "comfortable" })}
          >
            {t("Комфортная")}
          </button>
          <button
            className={p.density === "compact" ? "selected" : ""}
            onClick={() => set({ density: "compact" })}
          >
            {t("Компактная")}
          </button>
        </div>
      </div>
      <div className="modal-actions">
        <button className="button subtle" onClick={() => onChange(defaults)}>
          {t("Сбросить настройки")}
        </button>
        <button className="button primary" onClick={onClose}>
          <Check size={16} />
          {t("Вот так нравится")}
        </button>
      </div>
    </Modal>
  );
}
function Account({
  onClose,
  notify,
}: {
  onClose: () => void;
  notify: (s: string) => void;
}) {
  const [token, setToken] = useState("");
  const [saved, setSaved] = useState(false);
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    window.tsat
      ?.tokenStatus()
      .then((s) => {
        setSaved(s.saved);
        setAvailable(s.available);
      })
      .catch(() => notify(t("Защищённое хранилище недоступно.")));
  }, []);
  return (
    <Modal
      title={t("Ближе к вашему сообществу")}
      subtitle={t("Безопасное подключение к Thunderstore")}
      onClose={onClose}
    >
      <div className="account-visual">
        <span className="brand-mark">
          <Zap size={25} fill="currentColor" />
        </span>
        <span className="connection-line" />
        <ShieldCheck size={24} />
        <span className="connection-line" />
        <span className="thunder-mark">
          <Zap size={27} />
        </span>
      </div>
      <div className="info-strip">
        <ShieldCheck size={20} />
        <span>
          {t(
            "Здесь нет неофициального OAuth. Входите на сайте, а для публикации из EXE используйте токен service account вашей команды.",
          )}
        </span>
      </div>
      <ol className="account-steps">
        <li>
          <strong>{t("Войдите на официальном сайте")}</strong>
          <p>
            {t(
              "Авторизация откроется в системном браузере. TSAT не видит пароль и cookies.",
            )}
          </p>
          <button
            className="button"
            onClick={() => openExternal("https://thunderstore.io/")}
          >
            <ExternalLink size={15} />
            {t("Открыть Thunderstore")}
          </button>
        </li>
        <li>
          <strong>{t("Создайте токен команды")}</strong>
          <p>
            {t(
              "Settings → Teams → ваша команда → Service accounts. Создайте отдельную учётную запись для TSAT.",
            )}
          </p>
          <button
            className="text-button"
            onClick={() =>
              openExternal("https://thunderstore.io/settings/teams/")
            }
          >
            {t("Перейти к командам")}
            <ArrowRight size={14} />
          </button>
        </li>
        <li>
          <strong>{t("Подключите её в приложении")}</strong>
          <p>
            {t(
              "Токен шифруется через Electron safeStorage (DPAPI на Windows). Он не попадает в архивы или браузерное хранилище.",
            )}
          </p>
        </li>
      </ol>
      {window.tsat ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await window.tsat!.saveToken(token);
              setToken("");
              setSaved(true);
              notify(
                t(
                  "Токен зашифрован и сохранён. Права будут проверены Thunderstore при публикации.",
                ),
              );
            } catch (e) {
              notify((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="field">
            Service account token
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={t("Вставьте токен команды")}
              disabled={!available || busy}
              required
            />
          </label>
          {saved && (
            <p className="saved-token">
              <ShieldCheck size={16} />
              {t("Токен сохранён · права ещё не проверены")}
            </p>
          )}
          <div className="modal-actions">
            {saved && (
              <button
                className="button"
                type="button"
                onClick={async () => {
                  try {
                    await window.tsat!.deleteToken();
                    setSaved(false);
                    notify(
                      t(
                        "Токен удалён с устройства. При необходимости отзовите его и на сайте.",
                      ),
                    );
                  } catch {
                    notify(t("Не удалось удалить токен."));
                  }
                }}
              >
                {t("Отключить")}
              </button>
            )}
            <button
              className="button primary"
              disabled={!available || busy || !token.trim()}
            >
              {busy ? t("Сохранение…") : t("Сохранить безопасно")}
            </button>
          </div>
          {!available && (
            <p className="field-help">
              {t(
                "Системное шифрование недоступно. Сохранение токена заблокировано.",
              )}
            </p>
          )}
        </form>
      ) : (
        <div className="desktop-only">
          <HardDrive size={21} />
          <div>
            <strong>{t("Токен подключается только в EXE")}</strong>
            <p>
              {t(
                "В веб-превью можно собрать ZIP и загрузить его на сайт вручную. Секреты здесь не сохраняются.",
              )}
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}
function Guide({
  onCreate,
  onAccount,
}: {
  onCreate: () => void;
  onAccount: () => void;
}) {
  return (
    <div className="guide-layout">
      <section className="panel guide-main">
        <span className="soft-icon">
          <BookOpen size={24} />
        </span>
        <h2>{t("Ваш первый мод в TSAT")}</h2>
        <p>
          {t(
            "TSAT — упаковщик и рабочее пространство автора. Он не устанавливает моды в игру и не заменяет r2modman.",
          )}
        </p>
        <Step
          number="01"
          title={t("Создайте проект для своей игры")}
          text={t(
            "Выберите сообщество или укажите его URL-идентификатор. Примеры в библиотеке — пустые шаблоны, а не готовые моды.",
          )}
        />
        <Step
          number="02"
          title={t("Расскажите о своём моде")}
          text={t(
            "Заполните manifest, версию и описание. Добавьте README с инструкцией и PNG-иконку 256 × 256.",
          )}
        />
        <Step
          number="03"
          title={t("Добавьте файлы и зависимости")}
          text={t(
            "Загрузите папку мода с нужной структурой. Для зависимости укажите полное имя: Author-Package-1.0.0. Загрузчик и его версию выбираете вы.",
          )}
        />
        <Step
          number="04"
          title={t("Проверьте и соберите ZIP")}
          text={t(
            "TSAT проверяет локальные правила. Manifest, README и icon.png окажутся в корне, ваши вложенные папки сохранят структуру.",
          )}
        />
        <Step
          number="05"
          title={t("Опубликуйте, когда будете готовы")}
          text={t(
            "Загрузите ZIP на сайт или подключите токен в EXE для API-публикации. Сервер проверит права, зависимости и уникальность версии.",
          )}
        />
        <button className="button primary" onClick={onCreate}>
          {t("Создать первый проект")}
          <ArrowRight size={16} />
        </button>
      </section>
      <aside className="guide-side">
        <section className="panel">
          <ShieldCheck size={26} />
          <h3>{t("Локально — значит у вас")}</h3>
          <p>
            {t(
              "Проекты и файлы сохраняются в IndexedDB этого приложения. Резервные копии делайте через экспорт ZIP: очистка данных приложения удаляет библиотеку.",
            )}
          </p>
        </section>
        <section className="panel">
          <UserRound size={25} />
          <h3>{t("Безопасное подключение")}</h3>
          <p>
            {t(
              "Не передавайте пароль от аккаунта сторонним программам. TSAT использует отдельный токен команды.",
            )}
          </p>
          <button className="text-button" onClick={onAccount}>
            {t("Как подключиться")}
            <ArrowRight size={14} />
          </button>
        </section>
        <section className="panel">
          <CircleHelp size={25} />
          <h3>{t("Ранний доступ")}</h3>
          <p>
            {t(
              "API Thunderstore может меняться. Установщик пока без цифровой подписи, поэтому Windows может показывать предупреждение SmartScreen.",
            )}
          </p>
          <button
            className="text-button"
            onClick={() =>
              openExternal(
                "https://github.com/ItzHanchik/ThunderStoreArchiveTool-TSAT-/issues",
              )
            }
          >
            {t("Сообщить о проблеме")}
            <ExternalLink size={14} />
          </button>
        </section>
      </aside>
    </div>
  );
}
function Weather({ kind }: { kind: Preferences["weather"] }) {
  if (kind === "none") return null;
  return (
    <div className={`weather ${kind}`} aria-hidden="true">
      {Array.from({ length: 36 }, (_, i) => (
        <i
          key={i}
          style={
            {
              left: `${(i * 37) % 100}%`,
              animationDelay: `${-(i % 13)}s`,
              animationDuration: `${kind === "snow" ? 9 + (i % 8) : 1 + (i % 5) / 5}s`,
              opacity: 0.15 + (i % 5) / 12,
              "--drift": `${((i % 5) - 2) * 30}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
