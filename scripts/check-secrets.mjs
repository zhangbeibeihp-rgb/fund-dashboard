import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const ignoredDirs = new Set(['.git', 'node_modules', '.workbuddy']);
const ignoredFiles = new Set(['.env.example']);
const blockedPatterns = [
  { name: 'OpenAI-style secret key', re: /sk-[A-Za-z0-9_-]{20,}/ },
  { name: 'Bearer secret key', re: /Bearer\s+sk-[A-Za-z0-9_-]{20,}/ },
  { name: 'Supabase service role key', re: /service_role\s*[:=]\s*['"][^'"]+['"]/i },
  { name: 'Hardcoded AI_KEY assignment', re: /AI_KEY\s*=\s*['"][^'"]+['"]/ }
];

const textExt = new Set([
  '.js', '.mjs', '.json', '.html', '.md', '.css', '.sql', '.txt', '.yml', '.yaml',
  '.example', '.gitignore'
]);

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    if (ignoredDirs.has(name)) continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walk(path, files);
    } else {
      files.push(path);
    }
  }
  return files;
}

function isTextFile(path) {
  if (ignoredFiles.has(relative(root, path).replace(/\\/g, '/'))) return false;
  return textExt.has(path.slice(path.lastIndexOf('.'))) || path.endsWith('.gitignore');
}

const findings = [];
for (const file of walk(root)) {
  if (!isTextFile(file)) continue;
  const rel = relative(root, file).replace(/\\/g, '/');
  const text = readFileSync(file, 'utf8');
  for (const pattern of blockedPatterns) {
    const match = text.match(pattern.re);
    if (match) {
      findings.push(`${rel}: ${pattern.name}`);
    }
  }
}

if (findings.length) {
  console.error('Secret scan failed:');
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exit(1);
}

console.log('Secret scan passed');
