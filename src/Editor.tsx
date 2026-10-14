import { modReadme, modChangelog } from "./lib/templates";
import { t } from "./lib/i18n";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Markdown from "react-markdown";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Code2,
  Download,
  ExternalLink,
  File,
  FileArchive,
  FileCode2,
  FileImage,
  FileText,
  FolderOpen,
  ImagePlus,
  Info,
  Link2,
  Loader2,
  PackageCheck,
  Plus,
  Rocket,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import type { Asset, Project } from "./lib/model";
import { gameInfo, sizeLabel } from "./lib/model";
import {
  buildPackage,
  ignoredPath,
  isPng256,
  MAX_BYTES,
  mergeAssets,
  safePath,
  validate,
} from "./lib/package";
import { createIcon, openExternal } from "./lib/storage";
import { Modal } from "./components";

type Tab = "manifest" | "files" | "readme" | "dependencies" | "checks";
interface Props {
  project: Project;
  onChange: (p: Project) => void;
  onBack: () => void;
  onBuild: () => void;
  building: boolean;
  notify: (s: string) => void;
  onAccount: () => void;
}
export default function Editor({
  project: p,
  onChange,
  onBack,
  onBuild,
  building,
  notify,
  onAccount,
}: Props) {
  const [tab, setTab] = useState<Tab>("manifest");
  const [doc, setDoc] = useState<"readme" | "changelog">("readme");
  const [preview, setPreview] = useState(false);
  const [dep, setDep] = useState("");
  const [drag, setDrag] = useState(false);
  const [importing, setImporting] = useState(false);
  const [publish, setPublish] = useState(false);
  const [iconUrl, setIconUrl] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const folder = useRef<HTMLInputElement>(null);
  const game = gameInfo(p.game);
  const checks = validate(p);
  const errors = checks.filter((c) => c.status === "error");
  const changeManifest = (
    field: keyof Project["manifest"],
    value: string | string[],
  ) => onChange({ ...p, manifest: { ...p.manifest, [field]: value } });
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
  async function importFiles(files: File[], folderMode = false) {
    if (importing || !files.length) return;
    setImporting(true);
    try {
      if (
        files.length > 2000 ||
        files.reduce((n, f) => n + f.size, 0) > MAX_BYTES
      )
        throw new Error(
          t("За один раз можно добавить не более 200 МБ и 2000 файлов."),
        );
      const incoming: Asset[] = [];
      const next = { ...p, manifest: { ...p.manifest } };
      let skipped = 0;
      for (const f of files) {
        const path = folderMode
          ? f.webkitRelativePath.split("/").slice(1).join("/")
          : f.name;
        if (!safePath(path)) throw new Error(t("Небезопасное имя: {0}", path));
        if (ignoredPath(path)) {
          skipped++;
          continue;
        }
        const data = new Uint8Array(await f.arrayBuffer());
        const lower = path.toLowerCase();
        if (lower === "icon.png") {
          if (!isPng256(data))
            throw new Error(t("icon.png должен быть PNG 256 × 256."));
          next.icon = data;
        } else if (lower === "readme.md" || lower === "changelog.md") {
          if (data.length > 1024 * 1024)
            throw new Error(t("Документ Markdown должен быть меньше 1 МБ."));
          next[lower === "readme.md" ? "readme" : "changelog"] =
            new TextDecoder("utf-8", { fatal: true }).decode(data);
        } else if (lower === "manifest.json") {
          if (data.length > 1024 * 1024)
            throw new Error(t("Слишком большой manifest.json."));
          const m: unknown = JSON.parse(
            new TextDecoder("utf-8", { fatal: true }).decode(data),
          );
          if (!m || typeof m !== "object")
            throw new Error(t("Неверный формат manifest.json."));
          const value = m as Record<string, unknown>;
          if (
            !["name", "description", "website_url", "version_number"].every(
              (k) => typeof value[k] === "string",
            ) ||
            !Array.isArray(value.dependencies) ||
            !value.dependencies.every((d) => typeof d === "string")
          )
            throw new Error(
              t(
                "Manifest должен содержать name, version_number, website_url, description и массив dependencies.",
              ),
            );
          if (
            Object.keys(value).some(
              (key) =>
                ![
                  "name",
                  "description",
                  "website_url",
                  "version_number",
                  "dependencies",
                ].includes(key),
            )
          )
            throw new Error(
              t(
                "Manifest содержит дополнительные поля (например, installers), которые эта версия TSAT пока не поддерживает. Импорт отменён, чтобы не потерять настройки.",
              ),
            );
          next.manifest = {
            name: value.name as string,
            description: value.description as string,
            website_url: value.website_url as string,
            version_number: value.version_number as string,
            dependencies: value.dependencies as string[],
          };
        } else incoming.push({ path, data });
      }
      next.files = mergeAssets(p.files, incoming);
      onChange(next);
      notify(
        t(
          "Импортировано: {0}. {1}",
          files.length - skipped,
          skipped
            ? t("Пропущено служебных файлов: {0}.", skipped)
            : t("Структура папок сохранена."),
        ),
      );
    } catch (e) {
      notify(t("Импорт отменён: {0}", (e as Error).message));
    } finally {
      setImporting(false);
      if (input.current) input.current.value = "";
      if (folder.current) folder.current.value = "";
    }
  }
  async function changeIcon(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 4 * 1024 * 1024)
        throw new Error(t("Иконка должна быть меньше 4 МБ."));
      const data = new Uint8Array(await file.arrayBuffer());
      if (!isPng256(data))
        throw new Error(t("Выберите PNG размером ровно 256 × 256."));
      const bitmap = await createImageBitmap(file);
      bitmap.close();
      onChange({ ...p, icon: data });
    } catch (e) {
      notify((e as Error).message);
    } finally {
      e.target.value = "";
    }
  }
  function addDependency() {
    const value = dep.trim();
    if (!/^[a-zA-Z0-9_]+-[a-zA-Z0-9_]+-\d+\.\d+\.\d+$/.test(value)) {
      notify(t("Укажите зависимость в формате Author-Package-1.0.0."));
      return;
    }
    const name = value.split("-").slice(0, -1).join("-").toLowerCase();
    if (
      p.manifest.dependencies.some(
        (d) => d.split("-").slice(0, -1).join("-").toLowerCase() === name,
      )
    ) {
      notify(
        t(
          "Этот пакет уже есть в зависимостях. Сначала удалите прежнюю версию.",
        ),
      );
      return;
    }
    if (p.manifest.dependencies.length >= 1000) {
      notify(t("Достигнут лимит: 1000 зависимостей."));
      return;
    }
    changeManifest("dependencies", [...p.manifest.dependencies, value]);
    setDep("");
  }
  return (
    <>
      <button className="back-button" onClick={onBack}>
        <ArrowLeft size={16} />
        {t("Все проекты")}
      </button>
      <div className="editor-heading">
        <div className="editor-project-icon" style={{ background: game.color }}>
          {iconUrl ? (
            <img src={iconUrl} alt={t("Иконка мода")} />
          ) : (
            <FileArchive size={25} />
          )}
        </div>
        <div>
          <div className="eyebrow">
            {game.name.toUpperCase()} <span>/</span> {t("РЕДАКТОР ПРОЕКТА")}
          </div>
          <h1>{p.manifest.name || t("Новый проект")}</h1>
          <p>
            <span className="badge">
              {p.template
                ? t("Шаблон для знакомства")
                : t("Локальный черновик")}
            </span>
            <span>v{p.manifest.version_number}</span>
          </p>
        </div>
        <div className="editor-actions">
          <button className="button" onClick={() => setPublish(true)}>
            <Rocket size={16} />
            {t("Публикация")}
          </button>
          <button
            className="button primary"
            disabled={building || importing}
            onClick={() =>
              errors.length
                ? (setTab("checks"),
                  notify(t("Сначала исправьте ошибки проверки.")))
                : onBuild()
            }
          >
            {building ? (
              <Loader2 className="spin" size={17} />
            ) : (
              <Download size={17} />
            )}
            {building ? t("Собираем…") : t("Собрать ZIP")}
          </button>
        </div>
      </div>
      {p.template && (
        <div className="template-notice">
          <SparkIcon />
          <span>
            {t(
              "Это стартовый шаблон, а не готовый мод. Добавьте свои файлы и описание — сделайте его вашим.",
            )}
          </span>
        </div>
      )}
      <div className="editor-layout">
        <div className="editor-main">
          <nav className="editor-tabs">
            {(
              [
                ["manifest", FileCode2, "Manifest"],
                ["files", FolderOpen, t("Файлы")],
                ["readme", FileText, t("Описание")],
                ["dependencies", Link2, t("Зависимости")],
                ["checks", ShieldCheck, t("Проверка")],
              ] as const
            ).map(([id, Icon, title]) => (
              <button
                className={tab === id ? "selected" : ""}
                onClick={() => setTab(id)}
                key={id}
              >
                <Icon size={16} />
                {title}
                {id === "checks" && errors.length > 0 && (
                  <span className="error-count">{errors.length}</span>
                )}
              </button>
            ))}
          </nav>
          <section className="editor-panel">
            {tab === "manifest" && (
              <>
                <div className="section-heading">
                  <div>
                    <h2>{t("Начнём с главного")}</h2>
                    <p>{t("Так ваш мод увидят в Thunderstore.")}</p>
                  </div>
                  <span className="code-label">manifest.json</span>
                </div>
                <div className="form-row">
                  <label className="field grow">
                    {t("Название пакета")}
                    <input
                      value={p.manifest.name}
                      maxLength={128}
                      onChange={(e) => changeManifest("name", e.target.value)}
                      placeholder="My_Awesome_Mod"
                    />
                    <small>{t("Латиница, цифры, подчёркивание.")}</small>
                  </label>
                  <label className="field version-field">
                    {t("Версия")}
                    <input
                      value={p.manifest.version_number}
                      onChange={(e) =>
                        changeManifest("version_number", e.target.value)
                      }
                      placeholder="1.0.0"
                    />
                    <small>{t("Формат: 1.0.0")}</small>
                  </label>
                </div>
                <label className="field">
                  {t("Краткое описание")}
                  <textarea
                    rows={3}
                    value={p.manifest.description}
                    onChange={(e) =>
                      changeManifest("description", e.target.value)
                    }
                    placeholder={t("Что делает ваш мод особенным?")}
                  />
                  <small
                    className={
                      p.manifest.description.length > 250 ? "error-text" : ""
                    }
                  >
                    {p.manifest.description.length} {t("/ 250 символов")}
                  </small>
                </label>
                <label className="field">
                  {t("Сайт проекта")}
                  <span className="optional">{t("необязательно")}</span>
                  <input
                    value={p.manifest.website_url}
                    onChange={(e) =>
                      changeManifest("website_url", e.target.value)
                    }
                    placeholder="https://github.com/you/your-mod"
                  />
                </label>
                <div className="form-row">
                  <label className="field grow">
                    {t("Команда Thunderstore")}
                    <input
                      value={p.team}
                      onChange={(e) => onChange({ ...p, team: e.target.value })}
                      placeholder="YourTeam"
                    />
                    <small>
                      {t(
                        "Namespace для публикации. В manifest не записывается.",
                      )}
                    </small>
                  </label>
                  <label className="field grow">
                    {t("Сообщество")}
                    <input
                      value={p.game}
                      onChange={(e) => onChange({ ...p, game: e.target.value })}
                      placeholder="valheim"
                    />
                    <small>
                      {t("Идентификатор из адреса /c/сообщество/.")}
                    </small>
                  </label>
                </div>
                <div className="icon-editor">
                  <div className="icon-preview">
                    {iconUrl ? (
                      <img src={iconUrl} alt={t("Иконка пакета")} />
                    ) : (
                      <FileImage size={28} />
                    )}
                  </div>
                  <div>
                    <h3>
                      {t("Маленькая иконка. Большое первое впечатление.")}
                    </h3>
                    <p>{t("PNG · ровно 256 × 256 пикселей")}</p>
                    <div className="inline-actions">
                      <label className="button small">
                        <ImagePlus size={14} />
                        {t("Выбрать иконку")}
                        <input
                          type="file"
                          accept="image/png"
                          hidden
                          onChange={changeIcon}
                        />
                      </label>
                      <button
                        className="text-button"
                        onClick={async () => {
                          try {
                            onChange({
                              ...p,
                              icon: await createIcon(
                                game.color,
                                p.manifest.name || "T",
                              ),
                            });
                          } catch {
                            notify(t("Не удалось создать иконку."));
                          }
                        }}
                      >
                        {t("Сгенерировать букву")}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
            {tab === "files" && (
              <>
                <div className="section-heading">
                  <div>
                    <h2>{t("Всё на своих местах")}</h2>
                    <p>
                      {t(
                        "Сохраняем структуру папки. Ничего не перемещаем без вас.",
                      )}
                    </p>
                  </div>
                  <span className="code-label">
                    {sizeLabel(p.files.reduce((s, f) => s + f.data.length, 0))}
                  </span>
                </div>
                <div
                  className={`dropzone ${drag ? "dragging" : ""}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDrag(true);
                  }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDrag(false);
                    if (
                      Array.from(e.dataTransfer.items).some(
                        (i) => i.webkitGetAsEntry?.()?.isDirectory,
                      )
                    ) {
                      notify(
                        t(
                          "Для папки используйте кнопку «Выбрать папку» — так сохранится вложенная структура.",
                        ),
                      );
                      return;
                    }
                    void importFiles(Array.from(e.dataTransfer.files));
                  }}
                >
                  <span className="drop-icon">
                    {importing ? (
                      <Loader2 className="spin" size={28} />
                    ) : (
                      <Upload size={28} />
                    )}
                  </span>
                  <h3>
                    {importing
                      ? t("Добавляем файлы…")
                      : t("Перетащите файлы вашего мода")}
                  </h3>
                  <p>{t("DLL, конфиги и ресурсы · до 200 МБ на проект")}</p>
                  <div className="inline-actions">
                    <button
                      className="button"
                      disabled={importing}
                      onClick={() => input.current?.click()}
                    >
                      {t("Выбрать файлы")}
                    </button>
                    <button
                      className="button"
                      disabled={importing}
                      onClick={() => folder.current?.click()}
                    >
                      <FolderOpen size={15} />
                      {t("Выбрать папку")}
                    </button>
                  </div>
                </div>
                <input
                  type="file"
                  multiple
                  hidden
                  ref={input}
                  onChange={(e) =>
                    importFiles(Array.from(e.target.files ?? []))
                  }
                />
                <input
                  type="file"
                  multiple
                  hidden
                  ref={folder}
                  {...{ webkitdirectory: "", directory: "" }}
                  onChange={(e) =>
                    importFiles(Array.from(e.target.files ?? []), true)
                  }
                />
                <p className="field-help">
                  {t(
                    "Выберите папку с содержимым будущего ZIP. Её имя не попадёт в архив. Файлы с одинаковым путём заменяются. .git, .env, node_modules, EXE, ZIP и PDB пропускаются.",
                  )}
                </p>
                <div className="file-list">
                  <div className="file-list-header">
                    <span>{t("ПУТЬ В АРХИВЕ")}</span>
                    <span>{t("РАЗМЕР")}</span>
                  </div>
                  {[
                    "manifest.json",
                    "README.md",
                    ...(p.changelog.trim() ? ["CHANGELOG.md"] : []),
                    "icon.png",
                  ].map((name) => (
                    <div className="file-row generated" key={name}>
                      <FileCode2 size={16} />
                      <strong>{name}</strong>
                      <span>{t("Из редактора")}</span>
                      <ShieldCheck size={14} />
                    </div>
                  ))}
                  {p.files.map((f) => (
                    <div className="file-row" key={f.path}>
                      <File size={16} />
                      <strong title={f.path}>{f.path}</strong>
                      <span>{sizeLabel(f.data.length)}</span>
                      <button
                        className="icon-button"
                        aria-label={t("Удалить {0}", f.path)}
                        onClick={() =>
                          onChange({
                            ...p,
                            files: p.files.filter(
                              (file) => file.path !== f.path,
                            ),
                          })
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="info-strip">
                  <Info size={18} />
                  <span>
                    {t(
                      "README, manifest и icon.png из корня импортируемой папки заменят поля редактора. Структуру BepInEx/plugins или другого загрузчика подготовьте в исходной папке.",
                    )}
                  </span>
                </div>
              </>
            )}
            {tab === "readme" && (
              <>
                <div className="section-heading">
                  <div>
                    <h2>{t("Расскажите свою историю")}</h2>
                    <p>
                      {t(
                        "Инструкции, возможности и всё, что стоит знать игрокам.",
                      )}
                    </p>
                  </div>
                </div>
                <div className="document-toolbar">
                  <div className="segmented">
                    <button
                      className={doc === "readme" ? "selected" : ""}
                      onClick={() => setDoc("readme")}
                    >
                      README.md
                    </button>
                    <button
                      className={doc === "changelog" ? "selected" : ""}
                      onClick={() => setDoc("changelog")}
                    >
                      CHANGELOG.md
                    </button>
                  </div>
                  <button
                    className="button small"
                    onClick={() => setPreview(!preview)}
                  >
                    {preview ? <Code2 size={14} /> : <FileText size={14} />}
                    {preview ? t("Редактировать") : t("Предпросмотр")}
                  </button>
                </div>
                <div className="template-tools">
                  <button
                    className="text-button"
                    onClick={() => {
                      if (
                        p[doc].trim() &&
                        !window.confirm(
                          t(
                            "Заменить текущий документ английским шаблоном? Это действие нельзя отменить.",
                          ),
                        )
                      )
                        return;
                      onChange({
                        ...p,
                        [doc]:
                          doc === "readme"
                            ? modReadme(p.manifest.name, game.name)
                            : modChangelog(p.manifest.version_number),
                      });
                      setPreview(false);
                    }}
                  >
                    {t("Вставить английский шаблон")}
                  </button>
                  <span>
                    {t("Текст пакета не зависит от языка интерфейса.")}
                  </span>
                </div>
                {preview ? (
                  <div className="markdown-preview">
                    <Markdown
                      components={{
                        a: ({ href, children }) => (
                          <button
                            className="markdown-link"
                            onClick={() => {
                              if (href && /^https?:\/\//.test(href))
                                openExternal(href);
                            }}
                          >
                            {children}
                            <ExternalLink size={11} />
                          </button>
                        ),
                        img: ({ alt }) => (
                          <span className="markdown-image">
                            {t("[Изображение:")}
                            {alt || t("без описания")}{" "}
                            {t("— внешние изображения не загружаются]")}
                          </span>
                        ),
                      }}
                    >
                      {p[doc]}
                    </Markdown>
                  </div>
                ) : (
                  <textarea
                    className="markdown-editor"
                    aria-label={
                      doc === "readme"
                        ? "README Markdown"
                        : "CHANGELOG Markdown"
                    }
                    spellCheck={false}
                    value={p[doc]}
                    onChange={(e) => onChange({ ...p, [doc]: e.target.value })}
                  />
                )}
                <p className="field-help">
                  {t(
                    "Markdown · UTF-8 · HTML не исполняется, внешние изображения не загружаются.",
                  )}
                </p>
              </>
            )}
            {tab === "dependencies" && (
              <>
                <div className="section-heading">
                  <div>
                    <h2>{t("Ничего не забыли?")}</h2>
                    <p>
                      {t(
                        "Добавьте пакеты, без которых ваш мод не сможет работать.",
                      )}
                    </p>
                  </div>
                  <Link2 size={23} />
                </div>
                <form
                  className="dependency-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    addDependency();
                  }}
                >
                  <input
                    aria-label={t("Имя зависимости")}
                    placeholder="Author-Package-1.0.0"
                    value={dep}
                    onChange={(e) => setDep(e.target.value)}
                  />
                  <button className="button primary">
                    <Plus size={17} />
                    {t("Добавить")}
                  </button>
                </form>
                <p className="field-help">
                  {t(
                    "Скопируйте dependency string со страницы нужного пакета в Thunderstore.",
                  )}
                </p>
                {p.manifest.dependencies.length ? (
                  <div className="dependency-list">
                    {p.manifest.dependencies.map((d, index) => (
                      <div className="file-row" key={`${d}-${index}`}>
                        <Link2 size={17} />
                        <strong>{d}</strong>
                        <button
                          className="icon-button"
                          aria-label={t("Удалить зависимость {0}", d)}
                          onClick={() =>
                            changeManifest(
                              "dependencies",
                              p.manifest.dependencies.filter(
                                (_, i) => i !== index,
                              ),
                            )
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <Link2 size={34} />
                    <h3>{t("Без лишних зависимостей")}</h3>
                    <p>
                      {t(
                        "Если мод работает сам по себе, оставьте список пустым.",
                      )}
                    </p>
                  </div>
                )}
                <div className="info-strip">
                  <Info size={18} />
                  <span>
                    {t(
                      "Не подставляем загрузчик автоматически: его версия и пакет зависят от игры. Существование зависимостей проверяет Thunderstore.",
                    )}
                  </span>
                </div>
              </>
            )}
            {tab === "checks" && (
              <>
                <div className="section-heading">
                  <div>
                    <h2>
                      {errors.length
                        ? t("Немного внимания к деталям")
                        : t("Всё готово к упаковке")}
                    </h2>
                    <p>
                      {errors.length
                        ? t(
                            "Исправьте ошибки: {0}. Затем можно собрать ZIP.",
                            errors.length,
                          )
                        : t(
                            "Локальные проверки пройдены. Предупреждения не мешают сборке.",
                          )}
                    </p>
                  </div>
                  {errors.length ? (
                    <CircleAlert size={25} className="warning-color" />
                  ) : (
                    <CheckCircle2 size={25} className="accent-color" />
                  )}
                </div>
                <div className="checks-list">
                  {checks.map((c) => (
                    <div key={c.id} className={`check-item ${c.status}`}>
                      {c.status === "ok" ? (
                        <CheckCircle2 size={20} />
                      ) : c.status === "error" ? (
                        <CircleAlert size={20} />
                      ) : (
                        <Info size={20} />
                      )}
                      <div>
                        <strong>{c.title}</strong>
                        <p>{c.detail}</p>
                      </div>
                      <span>
                        {c.status === "ok"
                          ? t("Готово")
                          : c.status === "error"
                            ? t("Исправить")
                            : t("Важно")}
                      </span>
                    </div>
                  ))}
                </div>
                <button
                  className="button primary"
                  disabled={!!errors.length || building}
                  onClick={onBuild}
                >
                  {building ? (
                    <Loader2 className="spin" size={16} />
                  ) : (
                    <FileArchive size={16} />
                  )}
                  {t("Собрать ZIP")}
                  <ArrowRight size={16} />
                </button>
              </>
            )}
          </section>
        </div>
        <aside className="editor-aside">
          <section className="panel package-preview">
            <div className="eyebrow">{t("ПРЕВЬЮ ПАКЕТА")}</div>
            <div
              className="package-preview-image"
              style={{ backgroundImage: `url('./art/${game.art}.svg')` }}
            >
              {iconUrl && <img src={iconUrl} alt="" />}
            </div>
            <h3>{p.manifest.name || t("Название мода")}</h3>
            <span className="muted">
              {t("от")}
              {p.team || t("вашей команды")}
            </span>
            <p>
              {p.manifest.description ||
                t("Здесь появится описание вашего мода.")}
            </p>
            <div className="preview-tags">
              <span>{game.name}</span>
              <span>v{p.manifest.version_number}</span>
            </div>
            <div className="preview-divider" />
            <div className="preview-info">
              <span>{t("Зависимости")}</span>
              <strong>{p.manifest.dependencies.length}</strong>
            </div>
            <div className="preview-info">
              <span>{t("Файлы мода")}</span>
              <strong>{p.files.length}</strong>
            </div>
          </section>
          <section className="panel readiness">
            <span className="soft-icon">
              <PackageCheck size={21} />
            </span>
            <h3>
              {errors.length
                ? t("Проверим перед стартом")
                : t("Можно собирать")}
            </h3>
            <p>
              {errors.length
                ? t("{0} ошибок требуют внимания.", errors.length)
                : t("Метаданные и структура прошли локальную проверку.")}
            </p>
            <div className="readiness-bar">
              <span
                style={{
                  width: `${(checks.filter((c) => c.status === "ok").length / 9) * 100}%`,
                }}
              />
            </div>
            <button className="text-button" onClick={() => setTab("checks")}>
              {t("Посмотреть проверку")}
              <ChevronRight size={15} />
            </button>
          </section>
          <div className="editor-tip">
            <ShieldCheck size={16} />
            <p>
              {t(
                "Проект сохраняется автоматически. Сборка не публикует мод — всё под вашим контролем.",
              )}
            </p>
          </div>
        </aside>
      </div>
      {publish && (
        <PublishDialog
          project={p}
          onClose={() => setPublish(false)}
          onAccount={() => {
            setPublish(false);
            onAccount();
          }}
          onBuild={onBuild}
          notify={notify}
          hasErrors={!!errors.length}
        />
      )}
    </>
  );
}
function SparkIcon() {
  return <Info size={17} />;
}
function PublishDialog({
  project: p,
  onClose,
  onAccount,
  onBuild,
  notify,
  hasErrors,
}: {
  project: Project;
  onClose: () => void;
  onAccount: () => void;
  onBuild: () => void;
  notify: (s: string) => void;
  hasErrors: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [nsfw, setNsfw] = useState(false);
  const [categories, setCategories] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [token, setToken] = useState(false);
  useEffect(() => {
    window.tsat
      ?.tokenStatus()
      .then((s) => setToken(s.saved))
      .catch(() => {});
  }, []);
  const validMeta =
    /^[A-Za-z0-9_]{1,64}$/.test(p.team) &&
    /^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.game);
  return (
    <Modal
      title={t("Следующая остановка — Thunderstore")}
      subtitle={t("Публикация всегда требует вашего подтверждения.")}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="publish-summary">
        <FileArchive size={30} />
        <div>
          <strong>
            {p.manifest.name} <span>v{p.manifest.version_number}</span>
          </strong>
          <p>
            {p.team || t("Команда не указана")} → {gameInfo(p.game).name}
          </p>
        </div>
      </div>
      {hasErrors && (
        <div className="info-strip warning">
          <CircleAlert size={18} />
          <span>{t("Сначала исправьте ошибки на вкладке «Проверка».")}</span>
        </div>
      )}
      {result ? (
        <div className="empty-state">
          <CheckCircle2 size={36} />
          <h3>{t("Пакет отправлен в Thunderstore")}</h3>
          <p>
            {t(
              "Сообщество может требовать модерацию перед появлением в каталоге.",
            )}
          </p>
          <button
            className="button primary"
            onClick={() => openExternal(result)}
          >
            {t("Открыть пакет")}
            <ExternalLink size={16} />
          </button>
        </div>
      ) : (
        <>
          <h3 className="publish-title">{t("Через официальный сайт")}</h3>
          <p className="modal-copy">
            {t(
              "Универсальный способ: соберите архив и загрузите его на странице публикации нужного сообщества. Войдите в аккаунт в своём браузере.",
            )}
          </p>
          <div className="inline-actions">
            <button
              disabled={hasErrors || busy}
              className="button"
              onClick={onBuild}
            >
              <Download size={15} />
              {t("Собрать ZIP")}
            </button>
            <button
              disabled={!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.game)}
              className="button"
              onClick={() =>
                openExternal(`https://thunderstore.io/c/${p.game}/create/`)
              }
            >
              {t("Открыть публикацию")}
              <ExternalLink size={14} />
            </button>
          </div>
          <div className="preview-divider" />
          <h3 className="publish-title">
            {t("Напрямую из EXE")}
            <span className="badge">{t("Экспериментально")}</span>
          </h3>
          {!window.tsat ? (
            <div className="desktop-only">
              <Info size={21} />
              <p>
                {t(
                  "API-публикация доступна только в настольной версии. В веб-превью используйте ZIP и сайт.",
                )}
              </p>
            </div>
          ) : !token ? (
            <button className="button" onClick={onAccount}>
              <ShieldCheck size={16} />
              {t("Подключить токен команды")}
            </button>
          ) : (
            <>
              {!validMeta && (
                <p className="error-text">
                  {t(
                    "Укажите корректную команду и сообщество на вкладке Manifest.",
                  )}
                </p>
              )}
              <label className="field">
                {t("Категории")}
                <span className="optional">{t("необязательно")}</span>
                <input
                  value={categories}
                  onChange={(e) => setCategories(e.target.value)}
                  placeholder={t("Слаги через запятую: mods, tools")}
                  disabled={busy}
                />
                <small>
                  {t(
                    "Доступные категории зависят от сообщества. Их проверит сервер.",
                  )}
                </small>
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={nsfw}
                  onChange={(e) => setNsfw(e.target.checked)}
                  disabled={busy}
                />
                {t("Пакет содержит NSFW-контент")}
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  disabled={busy}
                />
                {t(
                  "Я проверил файлы и готов опубликовать эту версию от имени команды",
                )}
                {p.team || "…"}.
              </label>
              <button
                className="button primary full-width"
                disabled={!consent || !validMeta || hasErrors || busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const bytes = await buildPackage(p);
                    const r = await window.tsat!.publish(bytes, {
                      filename: `${p.manifest.name}-${p.manifest.version_number}.zip`,
                      team: p.team,
                      community: p.game,
                      nsfw,
                      categories: categories
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    });
                    setResult(r.url);
                    notify(t("Thunderstore принял пакет."));
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? (
                  <Loader2 className="spin" size={16} />
                ) : (
                  <Rocket size={16} />
                )}
                {busy
                  ? t("Отправляем пакет… Не закрывайте приложение")
                  : t("Опубликовать эту версию")}
              </button>
              {error && (
                <p className="error-text" role="alert">
                  {error}
                </p>
              )}
              <p className="field-help">
                {t(
                  "Не повторяйте отправку после обрыва связи, пока не проверите страницу пакета: сервер мог уже принять версию.",
                )}
              </p>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
