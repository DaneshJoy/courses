"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { assemblePackage } = require("../scripts/package-offline.cjs");

function writeFile(file, contents = "") {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

test("assembles local portal and course builds beneath the archive root", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "portal-package-"));
  const stagingDir = path.join(root, "staging");
  const offlineDir = path.join(root, "offline");
  const courses = [
    { id: "ai-foundations", localPath: "../ai-foundations/course.json", status: "published" },
  ];
  const courseRoot = path.join(path.dirname(root), "ai-foundations");
  const commands = [];
  writeFile(path.join(courseRoot, "package.json"), JSON.stringify({ scripts: { build: "" } }));

  const result = assemblePackage({
    root,
    registry: courses,
    stagingDir,
    offlineDir,
    run(command, args, options) {
      commands.push({ command, args, options });
      if (command === "npm" && options.cwd === root) writeFile(path.join(root, "dist", "index.html"));
      if (command === "npm" && options.cwd === courseRoot) writeFile(path.join(courseRoot, "dist", "index.html"));
      if (command === "python3") writeFile(args[2]);
    },
  });

  assert.equal(fs.existsSync(path.join(stagingDir, "index.html")), true);
  assert.equal(fs.existsSync(path.join(stagingDir, "courses", "ai-foundations", "index.html")), true);
  assert.equal(result.archivePath, path.join(offlineDir, "teaching-hub-instructor.zip"));
  assert.deepEqual(commands[0], {
    command: "npm",
    args: ["run", "build"],
    options: { cwd: courseRoot, env: { ...process.env, OFFLINE: "1" } },
  });
  assert.deepEqual(commands[1], {
    command: "npm",
    args: ["run", "build:local"],
    options: {
      cwd: root,
      env: { ...process.env, PORTAL_PACKAGE: "1", PORTAL_BASE: "./" },
    },
  });
  assert.equal(commands[2].command, "python3");
  assert.equal(commands[2].args[1], stagingDir);
  assert.equal(commands[2].args[2], result.archivePath);
  fs.rmSync(root, { recursive: true, force: true });
});

test("names the registry course when its offline build is absent", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "portal-package-"));
  const missingRoot = path.join(path.dirname(root), "missing");
  writeFile(path.join(missingRoot, "package.json"), JSON.stringify({ scripts: { build: "" } }));
  assert.throws(
    () => assemblePackage({
      root,
      registry: [{ id: "missing-course", localPath: "../missing/course.json", status: "published" }],
      run() {},
    }),
    /course "missing-course": offline build output not found/,
  );
  fs.rmSync(root, { recursive: true, force: true });
});
