import { useState } from "react";
import Markdown from "react-markdown";
import { ArrowLeft, ArrowRight, Check, FileText } from "lucide-react";
import { Modal } from "./components";
import { t } from "./lib/i18n";
import type { Project } from "./lib/model";
import {
  initialAnswers,
  generateReadme,
  updateChangelog,
  type DocumentAnswers,
} from "./lib/documents";

export default function DocumentWizard({
  project,
  onClose,
  onApply,
}: {
  project: Project;
  onClose: () => void;
  onApply: (readme: string, changelog: string) => void;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(() => initialAnswers(project));
  const [confirmed, setConfirmed] = useState(false);
  const [target, setTarget] = useState("both");
  const [preview, setPreview] = useState<"readme" | "changelog">("readme");
  const readme = generateReadme(project, answers);
  const changelog = updateChangelog(
    project.changelog,
    project.manifest.version_number,
    answers,
  );
  const hasRelease = [
    answers.added,
    answers.changed,
    answers.fixed,
    answers.knownIssues,
  ].some((s) => s.trim());
  const valid =
    (target === "changelog" || !!answers.summary.trim()) &&
    (target === "readme" || hasRelease);
  const fields: [keyof DocumentAnswers, string, string][] =
    step === 0
      ? [
          [
            "summary",
            "Что делает ваш мод?",
            "Краткое описание для нового игрока.",
          ],
          [
            "features",
            "Какие основные возможности?",
            "Одна возможность на строку.",
          ],
          [
            "requirements",
            "Что нужно для работы?",
            "Версии игры, загрузчика и зависимости — только проверенные.",
          ],
        ]
      : step === 1
        ? [
            [
              "installation",
              "Как установить мод?",
              "Укажите точные папки и шаги установки.",
            ],
            [
              "usage",
              "Как пользоваться и настраивать?",
              "Команды, горячие клавиши, путь к конфигу.",
            ],
            [
              "compatibility",
              "Совместимость и мультиплеер",
              "Что проверено, а что ещё не тестировалось?",
            ],
            [
              "support",
              "Куда сообщать об ошибках?",
              "Ссылка на issues или другой канал поддержки.",
            ],
            [
              "license",
              "Какая лицензия?",
              "Укажите лицензию кода и сторонних ресурсов.",
            ],
          ]
        : [
            ["added", "Что добавлено?", "Один пункт на строку."],
            ["changed", "Что изменено?", "Один пункт на строку."],
            ["fixed", "Что исправлено?", "Один пункт на строку."],
            [
              "knownIssues",
              "Какие проблемы остались?",
              "Необязательно. Не обещайте непроверенную совместимость.",
            ],
          ];
  return (
    <Modal
      wide
      title={t("Мастер README и CHANGELOG")}
      subtitle={t(
        "Ответьте на вопросы — получите готовые Markdown-документы. Всё локально, без AI и сети.",
      )}
      onClose={onClose}
    >
      <ol className="wizard-steps">
        {[
          "О моде",
          "Установка и поддержка",
          "Эта версия",
          "Проверка документов",
        ].map((label, index) => (
          <li
            key={label}
            aria-current={step === index ? "step" : undefined}
            className={
              step === index ? "current" : step > index ? "complete" : ""
            }
          >
            <span>{index + 1}</span>
            {t(label)}
          </li>
        ))}
      </ol>
      {step < 3 ? (
        <div className="wizard-fields">
          <p className="info-strip">
            {t(
              "Заголовки документов — на английском. Ответы сохраняются на языке, на котором вы их ввели. Пустые разделы будут пропущены.",
            )}
          </p>
          {step === 2 && (
            <h3>
              {project.manifest.name} · v{project.manifest.version_number}
            </h3>
          )}
          {fields.map(([key, label, hint]) => (
            <label className="field" key={key}>
              {t(label)}
              <textarea
                rows={key === "summary" ? 2 : 3}
                maxLength={20000}
                value={answers[key]}
                onChange={(e) =>
                  setAnswers({ ...answers, [key]: e.target.value })
                }
              />
              <small>{t(hint)}</small>
            </label>
          ))}
        </div>
      ) : (
        <>
          <label className="field">
            {t("Какие документы обновить?")}
            <select
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
                setConfirmed(false);
              }}
            >
              <option value="both">README + CHANGELOG</option>
              <option value="readme">README</option>
              <option value="changelog">CHANGELOG</option>
            </select>
          </label>
          <div className="doc-tabs">
            {(["readme", "changelog"] as const).map((doc) => (
              <button
                key={doc}
                className={preview === doc ? "selected" : ""}
                aria-pressed={preview === doc}
                onClick={() => setPreview(doc)}
              >
                {doc.toUpperCase()}.md
              </button>
            ))}
          </div>
          <div className="markdown-preview wizard-preview">
            <Markdown
              components={{ a: ({ children }) => <span>{children}</span> }}
            >
              {preview === "readme" ? readme : changelog}
            </Markdown>
          </div>
          {!valid && (
            <p className="error-text" role="alert">
              {t(
                "Для README нужно краткое описание; для CHANGELOG — хотя бы один пункт версии.",
              )}
            </p>
          )}
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            {t(
              "Заменить выбранные документы. В CHANGELOG обновится только текущая версия; старые версии сохранятся.",
            )}
          </label>
        </>
      )}
      <div className="modal-actions wizard-actions">
        <button
          className="button"
          onClick={() => (step ? setStep(step - 1) : onClose())}
        >
          <ArrowLeft size={16} />
          {step ? t("Назад") : t("Отмена")}
        </button>
        <span>{step + 1} / 4</span>
        {step < 3 ? (
          <button className="button primary" onClick={() => setStep(step + 1)}>
            {t("Далее")}
            <ArrowRight size={16} />
          </button>
        ) : (
          <button
            className="button primary"
            disabled={!confirmed || !valid}
            onClick={() =>
              onApply(
                target === "changelog" ? project.readme : readme,
                target === "readme" ? project.changelog : changelog,
              )
            }
          >
            <Check size={16} />
            <FileText size={16} />
            {t("Применить документы")}
          </button>
        )}
      </div>
    </Modal>
  );
}
