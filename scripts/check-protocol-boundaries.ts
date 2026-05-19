import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Violation = {
  file: string;
  line?: number;
  detail: string;
};

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");

const PROTOCOL_ROOTS = [
  "packages/shared",
  "packages/artifacts",
  "packages/privacy",
  "packages/protocol-slice",
  "packages/replay",
  "packages/contracts"
];

const PLATFORM_ROOTS = ["apps/api", "apps/web", "packages/db"];
const FORBIDDEN_PACKAGES = ["@pc/api", "@pc/web", "@pc/db"];
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".mjs", ".cjs"];
const IGNORED_DIRS = new Set(["node_modules", "dist", "build", "coverage", ".next", ".turbo"]);

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

async function main() {
  const violations: Violation[] = [];

  for (const root of PROTOCOL_ROOTS) {
    await checkPackageManifest(root, violations);
    const absoluteRoot = path.join(REPO_ROOT, root);
    for (const filePath of await listSourceFiles(absoluteRoot)) {
      await checkSourceFile(filePath, violations);
    }
  }

  if (violations.length > 0) {
    console.error("Protocol boundary check failed:");
    for (const violation of violations) {
      const location = violation.line ? `${violation.file}:${violation.line}` : violation.file;
      console.error(`- ${location} ${violation.detail}`);
    }
    process.exit(1);
  }

  console.log("Protocol boundary check: passed");
}

async function checkPackageManifest(root: string, violations: Violation[]) {
  const packagePath = path.join(REPO_ROOT, root, "package.json");
  const manifest = JSON.parse(await readFile(packagePath, "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
  };
  const dependencyNames = [
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {})
  ];

  for (const name of dependencyNames) {
    if (isForbiddenPackage(name)) {
      violations.push({
        file: relative(packagePath),
        detail: `declares forbidden platform dependency ${name}`
      });
    }
  }
}

async function checkSourceFile(filePath: string, violations: Violation[]) {
  const source = await readFile(filePath, "utf8");
  for (const occurrence of findImportSpecifiers(source)) {
    if (isForbiddenPackage(occurrence.specifier)) {
      violations.push({
        file: relative(filePath),
        line: lineNumber(source, occurrence.index),
        detail: `imports forbidden platform package ${occurrence.specifier}`
      });
      continue;
    }

    if (occurrence.specifier.startsWith(".")) {
      const target = path.resolve(path.dirname(filePath), occurrence.specifier);
      const platformRoot = PLATFORM_ROOTS.find((root) => isInside(target, path.join(REPO_ROOT, root)));
      if (platformRoot) {
        violations.push({
          file: relative(filePath),
          line: lineNumber(source, occurrence.index),
          detail: `imports platform path ${platformRoot}`
        });
      }
    }
  }
}

async function listSourceFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(root, entry.name);
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) return [];
        return listSourceFiles(entryPath);
      }
      return SOURCE_EXTENSIONS.includes(path.extname(entry.name)) ? [entryPath] : [];
    })
  );
  return files.flat();
}

function findImportSpecifiers(source: string) {
  const specifiers: Array<{ specifier: string; index: number }> = [];
  const patterns = [
    /\bfrom\s+["']([^"']+)["']/g,
    /\bimport\s+["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];
      if (specifier) specifiers.push({ specifier, index: match.index ?? 0 });
    }
  }

  return specifiers;
}

function isForbiddenPackage(specifier: string) {
  return FORBIDDEN_PACKAGES.some((packageName) => specifier === packageName || specifier.startsWith(`${packageName}/`));
}

function isInside(target: string, root: string) {
  const relativePath = path.relative(root, target);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function lineNumber(source: string, index: number) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function relative(filePath: string) {
  return path.relative(REPO_ROOT, filePath);
}
