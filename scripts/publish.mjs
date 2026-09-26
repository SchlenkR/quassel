// Usage: pnpm release [--dry-run]; the token comes from NPM_TOKEN or the user's .npmrc.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgDir = join(root, "packages/quassel");
const out = join(pkgDir, "dist");
const dryRun = process.argv.includes("--dry-run");
const repoUrl = "https://github.com/SchlenkR/quassel";
const rawUrl = "https://raw.githubusercontent.com/SchlenkR/quassel/main";

const run = (command, args, cwd = root) => execFileSync(command, args, { cwd, stdio: "inherit" });
const source = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));

const published = (() => {
  try {
    return execFileSync("npm", ["view", `${source.name}@${source.version}`, "version"], { encoding: "utf8" }).trim() !== "";
  } catch {
    return false;
  }
})();
if (published && !dryRun) {
  throw new Error(`${source.name}@${source.version} is already on npm - bump the version in packages/quassel/package.json first`);
}

run("pnpm", ["--filter", "quassel", "check"]);

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const { build } = createRequire(join(pkgDir, "package.json"))("esbuild");
await build({
  entryPoints: {
    index: join(pkgDir, "src/index.ts"),
    events: join(pkgDir, "src/events.ts"),
  },
  outdir: out,
  bundle: true,
  splitting: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  jsx: "automatic",
  sourcemap: true,
  external: ["react", "react-dom", "react/jsx-runtime", ...Object.keys(source.dependencies).flatMap((name) => [name, `${name}/*`])],
});

run("pnpm", ["exec", "tsc", "-p", "tsconfig.build.json"], pkgDir);
run("pnpm", ["exec", "tailwindcss", "-i", "src/chat.css", "-o", join(out, "chat.css")], pkgDir);

const readme = readFileSync(join(root, "README.md"), "utf8")
  .replaceAll("](docs/images/", `](${rawUrl}/docs/images/`)
  .replaceAll("](docs/", `](${repoUrl}/blob/main/docs/`)
  .replaceAll("](LICENSE)", `](${repoUrl}/blob/main/LICENSE)`);
writeFileSync(join(out, "README.md"), readme);
cpSync(join(root, "LICENSE"), join(out, "LICENSE"));

const entry = (name) => ({ types: `./${name}.d.ts`, default: `./${name}.js` });
const manifest = {
  name: source.name,
  version: source.version,
  description: source.description,
  license: source.license,
  author: source.author,
  repository: source.repository,
  homepage: source.homepage,
  keywords: source.keywords,
  type: "module",
  sideEffects: source.sideEffects,
  exports: {
    ".": entry("index"),
    "./events": entry("events"),
    "./chat.css": "./chat.css",
  },
  dependencies: source.dependencies,
  peerDependencies: source.peerDependencies,
  peerDependenciesMeta: source.peerDependenciesMeta,
};
writeFileSync(join(out, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);

if (process.env.NPM_TOKEN) {
  writeFileSync(join(out, ".npmrc"), "registry=https://registry.npmjs.org/\n//registry.npmjs.org/:_authToken=${NPM_TOKEN}\n");
}
if (!existsSync(join(out, "index.d.ts"))) {
  throw new Error("declarations missing in dist");
}
if (!readFileSync(join(out, "chat.css"), "utf8").includes(".qsl\\:flex")) {
  throw new Error("chat.css in dist has no quassel utilities");
}

run("npm", ["publish", "--access", "public", ...(dryRun ? ["--dry-run"] : [])], out);
