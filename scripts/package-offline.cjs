#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const STAGING_DIR = path.join(ROOT, ".offline-staging");
const OFFLINE_DIR = path.join(ROOT, "offline");
const ARCHIVE_NAME = "teaching-hub-instructor.zip";

function run(command, args, options) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed`);
}

function readRegistry(root) {
  return JSON.parse(fs.readFileSync(path.join(root, "data", "courses.json"), "utf8"));
}

function courseRoot(root, entry) {
  if (!entry.localPath) return null;
  const manifestPath = path.isAbsolute(entry.localPath)
    ? entry.localPath
    : path.resolve(root, entry.localPath);
  return path.dirname(manifestPath);
}

function offlineBuildScript(sourceRoot) {
  const packageJson = JSON.parse(fs.readFileSync(path.join(sourceRoot, "package.json"), "utf8"));
  return packageJson.scripts?.["build:offline"] ? "build:offline" : "build";
}

function courseError(entry, error) {
  return new Error(`course "${entry.id}": ${error.message}`, { cause: error });
}

function inlinePortalIndex(dist, stagingDir) {
  const app = fs.readFileSync(path.join(dist, "assets", "app.js"), "utf8");
  if (app.includes("</script>")) throw new Error("offline portal bundle contains </script>");
  const stylesheet = fs.readdirSync(path.join(dist, "assets")).find((file) => file.endsWith(".css"));
  if (!stylesheet) throw new Error("offline portal stylesheet not found");
  const css = fs.readFileSync(path.join(dist, "assets", stylesheet), "utf8").replaceAll("url(./", "url(./assets/");
  let index = fs.readFileSync(path.join(stagingDir, "index.html"), "utf8");
  index = index.replace(/<script type="module"[^>]*src="\.\/assets\/app\.js"><\/script>\s*/, () => `<script type="module">${app}</script>\n`);
  index = index.replace(new RegExp(`<link rel="stylesheet"[^>]*href="\\.\\/assets\\/${stylesheet}">`), () => `<style>${css}</style>`);
  if (index.includes('src="./assets/app.js"') || index.includes(`href="./assets/${stylesheet}"`)) {
    throw new Error("portal offline inlining failed: staged index.html still references external app.js or stylesheet");
  }
  fs.writeFileSync(path.join(stagingDir, "index.html"), index);
}

function assemblePackage({
  root = ROOT,
  registry = readRegistry(root),
  stagingDir = path.join(root, ".offline-staging"),
  offlineDir = path.join(root, "offline"),
  run: runCommand = run,
} = {}) {
  const courses = registry.filter((entry) => entry.status === "published");
  fs.rmSync(stagingDir, { recursive: true, force: true });
  fs.mkdirSync(stagingDir, { recursive: true });

  for (const entry of courses) {
    const sourceRoot = courseRoot(root, entry);
    if (!sourceRoot) throw new Error(`course "${entry.id}": no localPath configured`);
    let buildScript;
    try {
      buildScript = offlineBuildScript(sourceRoot);
    } catch (error) {
      throw courseError(entry, error);
    }
    try {
      runCommand("npm", ["run", buildScript], {
        cwd: sourceRoot,
        env: process.env,
      });
    } catch (error) {
      throw courseError(entry, error);
    }
    const dist = path.join(sourceRoot, "dist");
    if (!fs.existsSync(dist)) {
      throw new Error(`course "${entry.id}": offline build output not found at ${dist}`);
    }
    fs.cpSync(dist, path.join(stagingDir, "courses", entry.id), { recursive: true });
  }

  runCommand("npm", ["run", "build:local"], {
    cwd: root,
    env: { ...process.env, PORTAL_PACKAGE: "1", PORTAL_BASE: "./", PORTAL_OFFLINE: "1" },
  });
  const portalDist = path.join(root, "dist");
  if (!fs.existsSync(portalDist)) throw new Error("portal offline build output not found at dist");
  fs.cpSync(portalDist, stagingDir, { recursive: true });
  inlinePortalIndex(portalDist, stagingDir);

  const archivePath = path.join(offlineDir, ARCHIVE_NAME);
  runCommand("python3", [path.join(root, "scripts", "create-zip.py"), stagingDir, archivePath], {
    cwd: root,
    env: process.env,
  });
  return { archivePath, stagingDir };
}

module.exports = { assemblePackage };

if (require.main === module) {
  try {
    const { archivePath } = assemblePackage();
    console.log(`created ${archivePath}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
