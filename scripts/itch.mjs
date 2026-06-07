import { existsSync, mkdirSync, rmSync } from "node:fs";
import { copyFile, readFile } from "node:fs/promises";
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
