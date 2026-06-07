import { existsSync, mkdirSync, rmSync } from "node:fs";
import { copyFile, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distPath = join(projectRoot, "dist");
const releasePath = join(projectRoot, "release");
const zipPath = join(releasePath, "racing-arena-itch.zip");
const envPath = join(projectRoot, ".env.itch");
const viteBinPath = join(projectRoot, "node_modules", "vite", "bin", "vite.js");

function run(command, args, options = {}) {
  const executable = process.platform === "win32" && command === "npm" ? "npm.cmd" : command;
  const result = spawnSync(executable, args, {
    cwd: options.cwd ?? projectRoot,
    env: { ...process.env, ...options.env },
    shell: process.platform === "win32" && command === "npm",
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed.`);
  }
}

async function readItchEnv() {
  if (!existsSync(envPath)) return {};
  const contents = await readFile(envPath, "utf8");
  return Object.fromEntries(
    contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const [key, ...valueParts] = line.split("=");
        return [key.trim(), valueParts.join("=").trim()];
      }),
  );
}

function createZip() {
  if (!existsSync(distPath)) {
    throw new Error("dist folder not found. Run npm run build:itch first.");
  }
  mkdirSync(releasePath, { recursive: true });
  rmSync(zipPath, { force: true });

  if (process.platform === "win32") {
    run("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      `Compress-Archive -Path '${join(distPath, "*").replaceAll("'", "''")}' -DestinationPath '${zipPath.replaceAll("'", "''")}' -Force`,
    ]);
  } else {
    run("zip", ["-r", zipPath, "."], { cwd: distPath });
  }

  console.log(`Created itch.io upload: ${zipPath}`);
}

async function buildItch() {
  const env = await readItchEnv();
  run(process.execPath, [viteBinPath, "build", "--mode", "itch", "--base=./"], { env });
  await inlineItchIndex();
}

async function inlineItchIndex() {
  const indexPath = join(distPath, "index.html");
  let html = await readFile(indexPath, "utf8");

  html = await inlineStylesheets(html);
  html = await inlineModuleScripts(html);

  await writeFile(indexPath, html);
  console.log("Inlined itch.io CSS and JavaScript into dist/index.html");
}

async function inlineStylesheets(html) {
  const stylesheetPattern = /<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
  const replacements = [];

  for (const match of html.matchAll(stylesheetPattern)) {
    const [tag, href] = match;
    const assetPath = resolveDistAsset(href);
    const css = await readFile(assetPath, "utf8");
    replacements.push([tag, `<style>\n${css}\n</style>`]);
  }

  return applyReplacements(html, replacements);
}

async function inlineModuleScripts(html) {
  const scriptPattern = /<script\b(?=[^>]*type=["']module["'])(?=[^>]*src=["']([^"']+)["'])[^>]*><\/script>/gi;
  const replacements = [];

  for (const match of html.matchAll(scriptPattern)) {
    const [tag, src] = match;
    const assetPath = resolveDistAsset(src);
    const js = (await readFile(assetPath, "utf8")).replaceAll("</script", "<\\/script");
    replacements.push([tag, `<script type="module">\n${js}\n</script>`]);
  }

  return applyReplacements(html, replacements);
}

function resolveDistAsset(assetUrl) {
  const cleanUrl = assetUrl.split("?")[0].replace(/^\.\//, "");
  if (cleanUrl.startsWith("/") || cleanUrl.includes("..")) {
    throw new Error(`Refusing to inline unexpected asset path: ${assetUrl}`);
  }
  return join(distPath, cleanUrl);
}

function applyReplacements(value, replacements) {
  return replacements.reduce((current, [from, to]) => current.replace(from, to), value);
}

async function packageItch() {
  await buildItch();
  createZip();
}

async function uploadItch() {
  const env = await readItchEnv();
  const itchTarget = process.env.ITCH_TARGET || env.ITCH_TARGET;
  if (!itchTarget) {
    throw new Error("Set ITCH_TARGET in .env.itch, for example ITCH_TARGET=username/game:html5.");
  }

  await buildItch();
  run("butler", ["push", distPath, itchTarget], { env });
}

const command = process.argv[2] ?? "package";

if (command === "package") {
  await packageItch();
} else if (command === "upload") {
  await uploadItch();
} else if (command === "copy-env") {
  await copyFile(join(projectRoot, ".env.itch.example"), envPath);
  console.log("Created .env.itch from .env.itch.example");
} else {
  console.log("Usage: node scripts/itch.mjs package|upload|copy-env");
  process.exitCode = 1;
}
