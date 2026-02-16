import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceDir = path.join(root, "web");
const outDir = path.join(sourceDir, "dist");

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

fs.cpSync(path.join(sourceDir, "index.html"), path.join(outDir, "index.html"));
fs.cpSync(path.join(sourceDir, "src"), path.join(outDir, "src"), { recursive: true });

console.log(`Built web assets to ${path.relative(root, outDir)}`);
