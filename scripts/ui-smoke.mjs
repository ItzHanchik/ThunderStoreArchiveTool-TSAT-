import assert from "node:assert/strict";

/** Run against either the browser or the packaged Electron renderer. */
export async function featureSmoke(page) {
  const button = (name) => page.getByRole("button", { name, exact: true });
  if ((await page.locator("html").getAttribute("lang")) !== "en")
    await button("Русский / English").click();
  await page.getByRole("heading", { name: "My projects." }).waitFor();
  const count = await page.locator(".project-card").count();
  await button("New project").click();
  await page.getByPlaceholder("My_Awesome_Mod").fill("Bugfix_Test");
  await button("Create project").click();
  await page
    .getByRole("heading", { name: "Bugfix_Test", exact: true, level: 1 })
    .waitFor();

  await button("Description").click();
  const originalReadme = await page
    .getByRole("textbox", { name: "README Markdown" })
    .inputValue();
  await button("Answer a few questions").click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  assert.equal(
    await page.getByRole("textbox", { name: "README Markdown" }).inputValue(),
    originalReadme,
    "Cancel keeps existing documents",
  );
  await button("Answer a few questions").click();
  await page
    .getByLabel("What does your mod do?")
    .fill("A useful mod for testing.");
  await page
    .getByLabel("What are the main features?")
    .fill("Clearer controls\nBetter documentation");
  await button("Next").click();
  await page
    .getByLabel("How do you install it?")
    .fill("Copy test.dll to the loader's plugins directory.");
  await button("Next").click();
  await page.getByLabel("What was fixed?").fill("Fixed an upload error.");
  await button("Next").click();
  assert.equal(
    await button("Apply documents").isDisabled(),
    true,
    "Replacement needs confirmation",
  );
  await page.getByText("A useful mod for testing.", { exact: true }).waitFor();
  await page.getByRole("dialog").getByRole("checkbox").check();
  await button("Apply documents").click();
  await page.getByText("A useful mod for testing.", { exact: true }).waitFor();
  // Undo then generate only CHANGELOG, keeping the author's README untouched.
  await button("Restore previous documents").click();
  await button("Answer a few questions").click();
  await button("Next").click();
  await button("Next").click();
  await page.getByLabel("What was fixed?").fill("Fixed an upload error.");
  await button("Next").click();
  await page
    .getByLabel("Which documents should be updated?")
    .selectOption("changelog");
  await page.getByRole("dialog").getByRole("checkbox").check();
  await button("Apply documents").click();
  await button("Edit").click();
  assert.equal(
    await page.getByRole("textbox", { name: "README Markdown" }).inputValue(),
    originalReadme,
  );
  await button("CHANGELOG.md").click();
  assert.match(
    await page
      .getByRole("textbox", { name: "CHANGELOG Markdown" })
      .inputValue(),
    /Fixed an upload error/,
  );

  await button("Manifest").click();
  const oldIcon = await page.locator(".icon-preview img").getAttribute("src");
  await button("Customize icon").click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  assert.equal(
    await page.locator(".icon-preview img").getAttribute("src"),
    oldIcon,
  );
  await button("Customize icon").click();
  await button("Start with a letter").click();
  await button("Text").click();
  await page.getByLabel("Icon text", { exact: true }).fill("QA");
  await page.getByLabel("Text shadow", { exact: true }).check();
  await page.getByRole("slider", { name: "Text size" }).press("End");
  await button("Background").click();
  await page.getByLabel("Primary color", { exact: true }).fill("#8844cc");
  await button("Border").click();
  await page.getByRole("slider", { name: "Border width" }).press("End");
  await button("Apply icon").click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  const dimensions = await page
    .locator(".icon-preview img")
    .evaluate(async (image) => {
      await image.decode();
      return { width: image.naturalWidth, height: image.naturalHeight };
    });
  assert.deepEqual(dimensions, { width: 256, height: 256 });
  await page.getByText("Saved on this device", { exact: true }).waitFor();
  await page.reload();
  await page.getByRole("heading", { name: "My projects." }).waitFor();
  await button("Open Bugfix_Test").click();
  await button("Customize icon").click();
  await button("Text").click();
  assert.equal(
    await page.getByLabel("Icon text", { exact: true }).inputValue(),
    "QA",
    "Editable design survives restart",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  // Imported raster source can be transformed and survives an apply/reopen.
  await button("Customize icon").click();
  const source = await page
    .locator(".icon-studio-preview > canvas")
    .evaluate((canvas) => canvas.toDataURL());
  await page
    .getByRole("dialog")
    .locator("input[type=file]")
    .setInputFiles({
      name: "source.png",
      mimeType: "image/png",
      buffer: Buffer.from(source.split(",")[1], "base64"),
    });
  await page.getByRole("slider", { name: "Rotation" }).press("ArrowRight");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Apply icon", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });

  await button("Delete project").click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Bugfix_Test", exact: true, level: 1 })
    .waitFor();
  await button("Delete project").click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete project", exact: true })
    .click();
  await page.getByRole("heading", { name: "My projects." }).waitFor();
  assert.equal(await page.locator(".project-card").count(), count);
  await page.getByText("Saved on this device", { exact: true }).waitFor();
  await page.reload();
  await page.getByRole("heading", { name: "My projects." }).waitFor();
  assert.equal(
    await page.locator(".project-card").count(),
    count,
    "Deletion persists",
  );
  // Every card has an immediately discoverable delete action.
  assert.equal(
    await page.locator(".project-card .delete-project-button").count(),
    count,
  );
  await page.locator(".project-card .delete-project-button").first().click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  assert.equal(await page.locator(".project-card").count(), count);
  console.log(
    "PASS: document assistant, selected-document update, undo/cancel, icon studio/source/settings, deletion and persistence.",
  );
}
