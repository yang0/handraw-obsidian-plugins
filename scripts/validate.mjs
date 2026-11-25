#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INDEX_PATH = path.join(ROOT, 'index.json');
const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const ALLOWED_COMPAT = new Set(['verified', 'partial']);
const errors = [];
const fail = (m) => errors.push(m);
const isHttps = (u) => typeof u === 'string' && /^https:\/\/[^\s]+$/i.test(u.trim());

async function main() {
  const checkRemote = process.argv.includes('--check-remote');
  const idx = JSON.parse(await fs.readFile(INDEX_PATH, 'utf8'));
  if (idx.format !== 1) fail('index.json format must be 1');
  if (!Array.isArray(idx.plugins) || idx.plugins.length === 0) fail('plugins must be non-empty');
  const cats = new Set(Object.keys(idx.metadata?.categories || {}));
  const seen = new Set();

  for (const [i, p] of (idx.plugins || []).entries()) {
    const id = String(p?.id || '').trim();
    if (!id) { fail(`plugins[${i}].id required`); continue; }
    if (seen.has(id.toLowerCase())) fail(`duplicate id "${id}"`);
    seen.add(id.toLowerCase());
    if (!p.name?.trim()) fail(`[${id}] name required`);
    if (!p.repo || !REPO_RE.test(p.repo)) fail(`[${id}] invalid repo "${p.repo}"`);
    if (!ALLOWED_COMPAT.has(p.compatLevel)) fail(`[${id}] compatLevel must be verified or partial`);
    for (const c of p.categories || []) if (cats.size && !cats.has(c)) fail(`[${id}] unknown category "${c}"`);
    if (p.downloadMirrors) {
      for (const [mk, mv] of Object.entries(p.downloadMirrors)) {
        if (!isHttps(mv)) fail(`[${id}] downloadMirrors.${mk} must be https`);
      }
      if (!Array.isArray(p.files) || !p.files.includes('manifest.json') || !p.files.includes('main.js')) {
        fail(`[${id}] files must include manifest.json and main.js when downloadMirrors is set`);
      }
      if (checkRemote) {
        const testBase = p.downloadMirrors.github || p.downloadMirrors.gitee;
        const r = await fetch(testBase + 'manifest.json', { signal: AbortSignal.timeout(20000) });
        if (!r.ok) fail(`[${id}] remote manifest check failed: HTTP ${r.status}`);
        else console.log(`[ok] remote ${id} manifest verified`);
      }
    }
  }

  if (errors.length) {
    console.error(`Validation failed with ${errors.length} error(s):\n` + errors.map((e) => '  - ' + e).join('\n'));
    process.exit(1);
  }
  console.log(`Validation passed: ${idx.plugins.length} obsidian plugins in index.json.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
