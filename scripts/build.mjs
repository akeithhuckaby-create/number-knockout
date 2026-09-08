import { mkdir, cp, rm, stat } from "node:fs/promises";
const files = [
  "index.html",
  "calculator.html",
  "styles.css",
  "src",
  "assets",
  ".nojekyll",
];
for (const file of files) await stat(file);
await rm("dist", { recursive: true, force: true });
await mkdir("dist");
for (const file of files) await cp(file, `dist/${file}`, { recursive: true });
console.log(
  "GitHub Pages release copied to dist/. The repository root is also directly publishable.",
);
