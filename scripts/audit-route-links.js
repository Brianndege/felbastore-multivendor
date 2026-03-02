const fs = require("fs");
const path = require("path");

const root = process.cwd();
const src = path.join(root, "src");
const appDir = path.join(src, "app");

const routeSet = new Set(["/"]);

function walkRoutes(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkRoutes(fullPath);
      continue;
    }

    if (entry.isFile() && entry.name === "page.tsx") {
      const rel = path.relative(appDir, path.dirname(fullPath)).replace(/\\/g, "/");
      const route = `/${rel === "." ? "" : rel}`.replace(/\[(.*?)\]/g, ":$1");
      routeSet.add(route);
    }
  }
}

walkRoutes(appDir);

const codeFiles = [];
function walkCode(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkCode(fullPath);
      continue;
    }
    if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      codeFiles.push(fullPath);
    }
  }
}
walkCode(src);

const routeRefRegex = /(href|router\.push|router\.replace)\s*=?\s*\(?\s*['"](\/[^'"?#]*)/g;
const refs = [];

for (const file of codeFiles) {
  const text = fs.readFileSync(file, "utf8");
  let match;
  while ((match = routeRefRegex.exec(text))) {
    refs.push({
      file: path.relative(root, file).replace(/\\/g, "/"),
      route: match[2],
    });
  }
}

function routeExists(route) {
  if (routeSet.has(route)) return true;
  if (routeSet.has(route.replace(/\/$/, ""))) return true;

  for (const declared of routeSet) {
    if (!declared.includes(":")) continue;
    const regex = new RegExp(`^${declared.replace(/:[^/]+/g, "[^/]+")}$`);
    if (regex.test(route)) return true;
  }

  return false;
}

const missing = [];
for (const ref of refs) {
  if (ref.route.startsWith("/api/")) continue;
  if (!routeExists(ref.route)) missing.push(ref);
}

const uniqueByRoute = [];
const seen = new Set();
for (const item of missing) {
  if (!seen.has(item.route)) {
    seen.add(item.route);
    uniqueByRoute.push(item);
  }
}

console.log(`TOTAL_ROUTES ${routeSet.size}`);
console.log(`TOTAL_REFS ${refs.length}`);
console.log(`MISSING_COUNT ${uniqueByRoute.length}`);
for (const item of uniqueByRoute) {
  console.log(`${item.route} <- ${item.file}`);
}
