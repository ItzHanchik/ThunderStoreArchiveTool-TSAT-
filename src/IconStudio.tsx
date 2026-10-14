import { useEffect, useId, useRef, useState } from "react";
import { Check, ImagePlus, RotateCcw } from "lucide-react";
import { Modal } from "./components";
import { t } from "./lib/i18n";
import { gameInfo, type Project } from "./lib/model";
import {
  bytesToImage,
  defaultIcon,
  drawIcon,
  importIconImage,
  renderIcon,
  type IconDesign,
} from "./lib/icon";

export default function IconStudio({
  project,
  onClose,
  onApply,
}: {
  project: Project;
  onClose: () => void;
  onApply: (icon: Uint8Array, design: IconDesign) => void;
}) {
  const id = useId();
  const [design, setDesign] = useState<IconDesign>(
    () =>
      project.iconDesign ??
      defaultIcon(gameInfo(project.game).color, project.manifest.name),
  );
  const [ready, setReady] = useState(!project.icon || !!project.iconDesign);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [panel, setPanel] = useState("image");
  const canvas = useRef<HTMLCanvasElement>(null);
  const smallCanvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    if (project.icon && !project.iconDesign)
      bytesToImage(project.icon)
        .then((source) => {
          if (!cancelled) {
            setDesign((d) => ({ ...d, source, text: "", borderWidth: 0 }));
            setReady(true);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setError(t("Не удалось создать иконку."));
            setReady(true);
          }
        });
    return () => {
      cancelled = true;
    };
  }, [project]);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const staging = document.createElement("canvas");
    drawIcon(staging, design)
      .then(() => {
        if (!cancelled && canvas.current) {
          canvas.current.width = canvas.current.height = 256;
          canvas.current.getContext("2d")!.drawImage(staging, 0, 0);
          smallCanvas.current?.getContext("2d")?.clearRect(0, 0, 64, 64);
          smallCanvas.current
            ?.getContext("2d")
            ?.drawImage(staging, 0, 0, 64, 64);
          setError("");
        }
      })
      .catch(() => {
        if (!cancelled) setError(t("Не удалось создать иконку."));
      });
    return () => {
      cancelled = true;
    };
  }, [design, ready]);
  function set<K extends keyof IconDesign>(key: K, value: IconDesign[K]) {
    setDesign((d) => ({ ...d, [key]: value }));
  }
  const range = (
    key: keyof IconDesign,
    label: string,
    min: number,
    max: number,
    step = 1,
  ) => (
    <label className="field" key={key} htmlFor={`${id}-${key}`}>
      <span>
        {t(label)} <output>{String(design[key])}</output>
      </span>
      <input
        id={`${id}-${key}`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={Number(design[key])}
        onChange={(e) => set(key, Number(e.target.value))}
      />
    </label>
  );
  const color = (
    key: "background" | "secondary" | "textColor" | "borderColor",
    label: string,
  ) => (
    <label className="field color-field">
      {t(label)}
      <input
        type="color"
        value={design[key]}
        onChange={(e) => set(key, e.target.value)}
      />
    </label>
  );
  return (
    <Modal
      wide
      title={t("Студия иконки")}
      subtitle={t(
        "Настройте готовую иконку или создайте новую. Результат — PNG 256 × 256.",
      )}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="icon-studio-layout">
        <div className="icon-studio-preview">
          <canvas
            ref={canvas}
            width={256}
            height={256}
            aria-label={t("Предпросмотр иконки")}
          />
          <span>256 × 256 · PNG</span>
          <div className="icon-small-preview">
            <span>{t("В каталоге")}</span>
            <canvas width={64} height={64} ref={smallCanvas} />
            <span>{project.manifest.name}</span>
          </div>
          <p>
            {t(
              "Исходник и настройки сохраняются в проекте. Изменения применятся только после подтверждения.",
            )}
          </p>
        </div>
        <div className="icon-studio-controls">
          <div className="doc-tabs">
            {[
              ["image", "Изображение"],
              ["background", "Фон"],
              ["text", "Текст"],
              ["border", "Рамка"],
            ].map(([id, label]) => (
              <button
                key={id}
                className={panel === id ? "selected" : ""}
                aria-pressed={panel === id}
                onClick={() => setPanel(id)}
              >
                {t(label)}
              </button>
            ))}
          </div>
          <fieldset disabled={busy || !ready} className="studio-fieldset">
            {panel === "image" && (
              <>
                <label
                  className="button"
                  role="button"
                  tabIndex={busy || !ready ? -1 : 0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.currentTarget.querySelector("input")?.click();
                    }
                  }}
                >
                  <ImagePlus size={16} />
                  {t("Загрузить изображение")}
                  <input
                    hidden
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      setBusy(true);
                      try {
                        const source = await importIconImage(file);
                        set("source", source);
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  />
                </label>
                <p className="field-help">PNG / JPG / WebP · ≤ 10 MB</p>
                {design.source && (
                  <button
                    className="text-button"
                    onClick={() => set("source", "")}
                  >
                    {t("Убрать изображение")}
                  </button>
                )}
                {range("zoom", "Масштаб", 0.25, 4, 0.05)}
                {range("imageX", "По горизонтали", -256, 256)}
                {range("imageY", "По вертикали", -256, 256)}
                {range("rotation", "Поворот", -180, 180)}
                {range("opacity", "Непрозрачность", 0, 100)}
                {range("overlay", "Затемнение", 0, 100)}
              </>
            )}
            {panel === "background" && (
              <>
                <div className="form-row">
                  {color("background", "Основной цвет")}
                  {color("secondary", "Второй цвет")}
                </div>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={design.gradient}
                    onChange={(e) => set("gradient", e.target.checked)}
                  />
                  {t("Градиент")}
                </label>
                {range("angle", "Угол градиента", 0, 360)}
                <h3>{t("Палитры")}</h3>
                <div className="palette-presets">
                  {[
                    ["#247d60", "#172e35"],
                    ["#7160d5", "#1e164b"],
                    ["#f0a052", "#9c2955"],
                    ["#3493bd", "#10233e"],
                  ].map(([a, b]) => (
                    <button
                      key={a}
                      title={`${a} / ${b}`}
                      aria-label={`${a} / ${b}`}
                      style={{
                        background: `linear-gradient(45deg, ${a}, ${b})`,
                      }}
                      onClick={() =>
                        setDesign((d) => ({
                          ...d,
                          background: a,
                          secondary: b,
                          gradient: true,
                        }))
                      }
                    />
                  ))}
                </div>
              </>
            )}
            {panel === "text" && (
              <>
                <label className="field">
                  {t("Текст на иконке")}
                  <input
                    maxLength={24}
                    value={design.text}
                    onChange={(e) => set("text", e.target.value)}
                  />
                </label>
                <label className="field">
                  {t("Шрифт")}
                  <select
                    value={design.font}
                    onChange={(e) =>
                      set("font", e.target.value as IconDesign["font"])
                    }
                  >
                    <option value="sans-serif">Sans serif</option>
                    <option value="serif">Serif</option>
                    <option value="monospace">Monospace</option>
                  </select>
                </label>
                {color("textColor", "Цвет текста")}
                {range("fontSize", "Размер текста", 12, 200)}
                {range("textX", "Положение текста X", 0, 256)}
                {range("textY", "Положение текста Y", 0, 256)}
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={design.bold}
                    onChange={(e) => set("bold", e.target.checked)}
                  />
                  {t("Жирный")}
                </label>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={design.shadow}
                    onChange={(e) => set("shadow", e.target.checked)}
                  />
                  {t("Тень текста")}
                </label>
              </>
            )}
            {panel === "border" && (
              <>
                {color("borderColor", "Цвет рамки")}
                {range("borderWidth", "Толщина рамки", 0, 20)}
                {range("inset", "Отступ рамки", 0, 100)}
                {range("radius", "Скругление рамки", 0, 100)}
              </>
            )}
          </fieldset>
        </div>
      </div>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button
          className="button"
          disabled={busy || !ready}
          onClick={() =>
            setDesign(
              defaultIcon(gameInfo(project.game).color, project.manifest.name),
            )
          }
        >
          <RotateCcw size={16} />
          {t("Начать с буквы")}
        </button>
        <button className="button" disabled={busy} onClick={onClose}>
          {t("Отмена")}
        </button>
        <button
          className="button primary"
          disabled={busy || !ready || !!error}
          onClick={async () => {
            setBusy(true);
            try {
              onApply(await renderIcon(design), design);
            } catch {
              setError(t("Не удалось создать иконку."));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Check size={16} />
          {t("Применить иконку")}
        </button>
      </div>
    </Modal>
  );
}
