#!/usr/bin/env node
/**
 * P11-global — machine-translate en.json into DeepL draft dictionaries.
 *
 * Usage:
 *   DEEPL_API_KEY=xxx node scripts/deepl-dicts.mjs es it nl pt da sv
 *   DEEPL_API_KEY=xxx node scripts/deepl-dicts.mjs --all --force
 *
 * Notes:
 * - {var} placeholders and <br /> tags are protected via XML tag handling.
 * - Existing files are SKIPPED unless --force (never clobber human review).
 * - After adding a locale: add one line to REGISTRY (src/i18n/dictionaries.ts)
 *   + the code in SUPPORTED_LOCALES (src/i18n/config.ts).
 * - DeepL language coverage (~30) < our 195-country table (~70 locales):
 *   unsupported targets print a warning and stay English-fallback.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EN_PATH = join(ROOT, "src/i18n/dictionaries/en.json");

// Our locale -> DeepL target code (only where they differ).
const DEEPL_MAP = {
  en: "EN-GB",
  zh: "ZH",
  nb: "NB",
  fil: "TL", // DeepL has no Filipino; Tagalog is closest — review carefully
};
const deeplTarget = (loc) =>
  DEEPL_MAP[loc] || loc.toUpperCase().replace("PT", "PT-PT");

// Tier 1 + major-market locales worth drafting in bulk.
const ALL = [
  "es", "it", "nl", "pt", "da", "sv", "nb", "fi", "el", "pl", "cs",
  "hu", "ro", "hr", "sk", "sl", "bg", "et", "lv", "lt", "mt", "uk",
  "ru", "tr", "ar", "he", "fa", "ur", "hi", "bn", "id", "ms", "th",
  "vi", "ko", "ja", "zh", "sw",
];

function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") flatten(v, key, out);
    else out[key] = String(v);
  }
  return out;
}

function unflatten(flat) {
  const root = {};
  for (const [path, value] of Object.entries(flat)) {
    const parts = path.split(".");
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      node[parts[i]] ??= {};
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = value;
  }
  return root;
}

// "{name} ordered" -> "<ph id="0"/> ordered" (DeepL keeps XML tags).
function protect(s) {
  const vars = [];
  const xml = s
    .replace(/\{(\w+)\}/g, (_, name) => {
      vars.push(name);
      return `<ph id="${vars.length - 1}"/>`;
    });
  return { xml, vars };
}
function unprotect(s, vars) {
  return s.replace(/<ph id="(\d+)"\s*\/>/g, (_, i) => `{${vars[Number(i)]}}`);
}

async function translateBatch(texts, target, key, free) {
  const endpoint = free
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate";
  const params = new URLSearchParams();
  for (const t of texts) params.append("text", t);
  params.append("source_lang", "EN");
  params.append("target_lang", target);
  params.append("tag_handling", "xml");
  params.append("formality", "default");
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `DeepL-Auth-Key ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  if (!res.ok) throw new Error(`DeepL ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.translations.map((t) => t.text);
}

const args = process.argv.slice(2);
const force = args.includes("--force");
let targets = args.filter((a) => !a.startsWith("--"));
if (args.includes("--all")) targets = ALL;
if (!targets.length) {
  console.error("Usage: DEEPL_API_KEY=xxx node scripts/deepl-dicts.mjs <locale...> [--force] [--all]");
  process.exit(1);
}
const key = process.env.DEEPL_API_KEY;
if (!key) {
  console.error("Set DEEPL_API_KEY first.");
  process.exit(1);
}
const free = key.endsWith(":fx");

const en = JSON.parse(readFileSync(EN_PATH, "utf8"));
const flat = flatten(en);
const entries = Object.entries(flat);
console.log(`${entries.length} keys x ${targets.length} locales`);

for (const loc of targets) {
  const out = join(ROOT, `src/i18n/dictionaries/${loc}.json`);
  if (existsSync(out) && !force) {
    console.log(`${loc}: exists, skipped (use --force to overwrite)`);
    continue;
  }
  const target = deeplTarget(loc);
  const protectedTexts = entries.map(([, v]) => protect(v).xml);
  const varMaps = entries.map(([, v]) => protect(v).vars);
  const out_flat = {};
  const BATCH = 40;
  try {
    for (let i = 0; i < protectedTexts.length; i += BATCH) {
      const slice = protectedTexts.slice(i, i + BATCH);
      const done = await translateBatch(slice, target, key, free);
      done.forEach((text, j) => {
        const [k] = entries[i + j];
        out_flat[k] = unprotect(text, varMaps[i + j]);
      });
      process.stdout.write(`\r${loc}: ${Math.min(i + BATCH, protectedTexts.length)}/${protectedTexts.length}`);
    }
    console.log("");
  } catch (e) {
    console.error(`\n${loc}: FAILED (${e.message}) — leaving English fallback`);
    continue;
  }
  writeFileSync(out, JSON.stringify(unflatten(out_flat), null, 2) + "\n");
  console.log(`${loc}: wrote ${out}`);
}
console.log("Done. Next: register each locale (dictionaries.ts + config.ts) and run the key-parity check.");
