process.on("uncaughtException", reportFailure);
process.on("unhandledRejection", reportFailure);
function reportFailure(error) {
  console.error(
    "::error::" +
      String(error?.stack ?? error)
        .replaceAll("%", "%25")
        .replaceAll("\r", "%0D")
        .replaceAll("\n", "%0A"),
  );
  process.exit(1);
}
import { _electron as electron } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { unzipSync, strFromU8 } from "fflate";
const executablePath = path.resolve("release/win-unpacked/TSAT.exe");
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "tsat-smoke-"));
const app = await electron.launch({ executablePath, timeout: 60000 });
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.getByRole("heading", { name: "Мои проекты." }).waitFor();
  assert.equal(await page.locator(".project-card").count(), 3);
  const security = await app.evaluate(({ BrowserWindow }) => {
    const prefs =
      BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
    return {
      sandbox: prefs.sandbox,
      isolation: prefs.contextIsolation,
      node: prefs.nodeIntegration,
    };
  });
  assert.deepEqual(security, { sandbox: true, isolation: true, node: false });
  assert.equal(await page.evaluate(() => typeof window.require), "undefined");
  await page.getByRole("button", { name: "Новый проект", exact: true }).click();
  await page.getByPlaceholder("My_Awesome_Mod").fill("Smoke_Test");
  await page
    .getByRole("button", { name: "Создать проект", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Smoke_Test", exact: true, level: 1 })
    .waitFor();
  await page.getByRole("button", { name: "Файлы", exact: true }).click();
  await page
    .locator("input[type=file]:not([webkitdirectory])")
    .setInputFiles({
      name: "test.dll",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("TSAT test payload"),
    });
  await page.getByText("test.dll", { exact: true }).waitFor();
  const destination = path.join(temp, "Smoke_Test-1.0.0.zip");
  await app.evaluate(({ dialog }, dest) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: dest });
  }, destination);
  await page.getByRole("button", { name: "Собрать ZIP", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Готово!" }).waitFor();
  const zip = unzipSync(new Uint8Array(await fs.readFile(destination)));
  assert.equal(strFromU8(zip["test.dll"]), "TSAT test payload");
  assert.equal(JSON.parse(strFromU8(zip["manifest.json"])).name, "Smoke_Test");
  assert.ok(zip["icon.png"]);
  const token = "tsat-smoke-only-not-a-real-token-0123456789";
  const status = await page.evaluate(() => window.tsat.tokenStatus());
  assert.equal(status.available, true, "Windows DPAPI must be available");
  await page.evaluate((value) => window.tsat.saveToken(value), token);
  const userData = await app.evaluate(({ app }) => app.getPath("userData"));
  const encrypted = await fs.readFile(path.join(userData, "team-token.enc"));
  assert.equal(
    encrypted.includes(Buffer.from(token)),
    false,
    "No plaintext token on disk",
  );
  const decrypted = await app.evaluate(
    ({ safeStorage }, bytes) => safeStorage.decryptString(Buffer.from(bytes)),
    Array.from(encrypted),
  );
  assert.equal(decrypted, token);
  await page.evaluate(() => window.tsat.deleteToken());
  assert.equal(
    (await page.evaluate(() => window.tsat.tokenStatus())).saved,
    false,
  );
  await page
    .getByRole("button", { name: "Персонализация", exact: true })
    .click();
  await page.getByRole("button", { name: "Тёмная", exact: true }).click();
  await page.getByRole("button", { name: "Снег", exact: true }).click();
  await page.getByRole("button", { name: "Вот так нравится" }).click();
  await page.getByText("Сохранено на устройстве", { exact: true }).waitFor();
  await page.reload();
  await page.getByRole("heading", { name: "Мои проекты." }).waitFor();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  assert.equal(await page.locator(".weather.snow").count(), 1);
  assert.equal(await page.locator(".project-card").count(), 4);
  assert.deepEqual(errors, []);
  await fs.mkdir("test-results", { recursive: true });
  await page.screenshot({
    path: "test-results/windows-desktop.png",
    fullPage: true,
  });
  console.log(
    "PASS: packaged renderer, isolation, imports, ZIP, DPAPI token round-trip, persistence.",
  );
} finally {
  await app.close();
  await fs.rm(temp, { recursive: true, force: true });
}
