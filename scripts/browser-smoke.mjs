import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { featureSmoke } from "./ui-smoke.mjs";

let server;
let browser;
try {
  if (!process.env.TSAT_URL) {
    server = spawn(
      process.execPath,
      [
        "node_modules/vite/bin/vite.js",
        "preview",
        "--host",
        "0.0.0.0",
        "--port",
        "5174",
        "--strictPort",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let startupOutput = "";
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`Preview startup timed out: ${startupOutput}`)),
        30000,
      );
      server.stdout.on("data", (data) => {
        process.stdout.write(data);
        startupOutput = (
          startupOutput + stripVTControlCharacters(data.toString())
        ).slice(-16384);
        if (startupOutput.includes("Local:")) {
          clearTimeout(timeout);
          resolve();
        }
      });
      server.stderr.on("data", (data) => process.stderr.write(data));
      server.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      server.on("exit", (code) => {
        clearTimeout(timeout);
        reject(new Error(`Preview exited: ${code}`));
      });
    });
  }
  browser = await chromium.launch({
    executablePath: process.env.TSAT_BROWSER_PATH || undefined,
    args: process.env.TSAT_BROWSER_PATH
      ? ["--no-sandbox", "--disable-dev-shm-usage"]
      : [],
    headless: true,
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(process.env.TSAT_URL || "http://localhost:5174");
  await page.getByRole("heading", { name: "My projects." }).waitFor();
  assert.equal(await page.locator("html").getAttribute("lang"), "en");
  await featureSmoke(page);
  await fs.mkdir("test-results", { recursive: true });
  await page.screenshot({
    path: "test-results/browser-workspace.png",
    fullPage: true,
  });
  // Language changes must update titles without a reload, including after load.
  await page
    .getByRole("button", { name: "Русский / English", exact: true })
    .click();
  await page.getByRole("heading", { name: "Мои проекты." }).waitFor();
  await page
    .getByRole("button", { name: "Русский / English", exact: true })
    .click();
  await page.getByRole("heading", { name: "My projects." }).waitFor();
  await page
    .getByRole("button", { name: "Open Northern_Lights", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Customize icon", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start with a letter", exact: true })
    .click();
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page.getByLabel("Icon text", { exact: true }).fill("TSAT");
  await page.screenshot({
    path: "test-results/browser-icon-studio.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page
      .getByRole("dialog")
      .evaluate(
        (node) => node.getBoundingClientRect().right <= window.innerWidth,
      ),
    true,
    "Mobile dialog fits viewport",
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
    "No mobile horizontal overflow",
  );
  assert.equal(
    await page.getByRole("dialog").evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return node.contains(
        document.elementFromPoint(rect.left + 10, rect.top + 50),
      );
    }),
    true,
    "Mobile dialog is not obscured by the sidebar stacking context",
  );
  await page.screenshot({
    path: "test-results/browser-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await page.getByRole("button", { name: "Description", exact: true }).click();
  await page
    .getByRole("button", { name: "Answer a few questions", exact: true })
    .click();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: English default, RU/EN switching, responsive icon/document dialogs, no renderer exceptions.",
  );
} catch (error) {
  console.error(
    "::error::" +
      String(error?.stack ?? error)
        .replaceAll("%", "%25")
        .replaceAll("\r", "%0D")
        .replaceAll("\n", "%0A"),
  );
  throw error;
} finally {
  await browser?.close();
  server?.kill();
}
