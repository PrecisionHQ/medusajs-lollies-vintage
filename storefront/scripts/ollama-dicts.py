#!/usr/bin/env python3
"""P11-global — Ollama (free, local, open weights) MT drafts.

Uses a translation-specialized model (translategemma, fallback qwen2.5).
Plain-text segments only: {var} placeholders and <br /> tags are split
out beforehand and spliced back verbatim, so the model can't mangle them.

Usage:
  ollama serve &  ollama pull translategemma:4b
  python3 storefront/scripts/ollama-dicts.py es it nl pt da sv
  python3 storefront/scripts/ollama-dicts.py --all --force [--model qwen2.5:3b]

Notes:
- Existing files are SKIPPED unless --force (never clobber human review).
- After adding a locale: one line in REGISTRY (src/i18n/dictionaries.ts)
  + the code in SUPPORTED_LOCALES (src/i18n/config.ts).
- Refuses to write output that is >95% identical to English (misfire guard).
"""
import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EN_PATH = ROOT / "src/i18n/dictionaries/en.json"
OLLAMA_URL = "http://localhost:11434/api/generate"

ALL = [
    "es", "it", "nl", "pt", "da", "sv", "nb", "fi", "el", "pl", "cs",
    "hu", "ro", "uk", "ru", "tr", "ar", "hi", "id", "ms", "th",
    "vi", "ko", "ja", "zh",
]

# Our locale -> language name for the prompt (Ollama knows these).
LANG_NAMES = {
    "es": "Spanish", "it": "Italian", "nl": "Dutch", "pt": "Portuguese",
    "da": "Danish", "sv": "Swedish", "nb": "Norwegian Bokmål", "fi": "Finnish",
    "el": "Greek", "pl": "Polish", "cs": "Czech", "hu": "Hungarian",
    "ro": "Romanian", "uk": "Ukrainian", "ru": "Russian", "tr": "Turkish",
    "ar": "Arabic", "hi": "Hindi", "id": "Indonesian", "ms": "Malay",
    "th": "Thai", "vi": "Vietnamese", "ko": "Korean", "ja": "Japanese",
    "zh": "Simplified Chinese",
}

SPLIT_RE = re.compile(r"(\{\w+\}|<br\s*/>)")


def flatten(obj, prefix="", out=None):
    out = {} if out is None else out
    for k, v in obj.items():
        key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            flatten(v, key, out)
        else:
            out[key] = str(v)
    return out


def unflatten(flat):
    root = {}
    for path, value in flat.items():
        node = root
        *parts, last = path.split(".")
        for p in parts:
            node = node.setdefault(p, {})
        node[last] = value
    return root


def ollama_translate(text, target_lang, model):
    prompt = (
        f"Translate this e-commerce UI string from English to {target_lang}. "
        f"Output ONLY the translation, no quotes, no explanation.\n{text}"
    )
    body = json.dumps({
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.1},
    }).encode()
    req = urllib.request.Request(OLLAMA_URL, data=body,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as res:
        data = json.load(res)
    return data.get("response", "").strip().strip('"').strip()


def protect(text):
    parts = SPLIT_RE.split(text)
    return [(p, False) if SPLIT_RE.fullmatch(p) else (p, True)
            for p in parts if p]


def translate_text(text, target_lang, model):
    out = []
    for part, do_translate in protect(text):
        if do_translate and part.strip():
            try:
                out.append(ollama_translate(part, target_lang, model))
            except Exception as e:
                print(f"      segment failed ({e!r}) — keeping English", flush=True)
                out.append(part)
        else:
            out.append(part)
    return "".join(out)


def main():
    args = sys.argv[1:]
    force = "--force" in args
    model = "translategemma:4b"
    if "--model" in args:
        model = args[args.index("--model") + 1]
    targets = [a for a in args if not a.startswith("--") and a != model]
    if "--all" in args:
        targets = ALL
    if not targets:
        sys.exit("Usage: ollama-dicts.py <locale...> [--force] [--all] [--model NAME]")

    en = json.loads(EN_PATH.read_text(encoding="utf-8"))
    flat = flatten(en)
    items = list(flat.items())
    print(f"{len(items)} keys x {len(targets)} locales (model {model})", flush=True)

    for loc in targets:
        if loc not in LANG_NAMES:
            print(f"{loc}: no prompt mapping — skipping")
            continue
        out_path = ROOT / f"src/i18n/dictionaries/{loc}.json"
        if out_path.exists() and not force:
            print(f"{loc}: exists, skipped (use --force to overwrite)")
            continue
        done = {}
        for i, (key, value) in enumerate(items):
            done[key] = translate_text(value, LANG_NAMES[loc], model)
            if (i + 1) % 20 == 0:
                print(f"\r{loc}: {i + 1}/{len(items)}", end="", flush=True)
        print(f"\r{loc}: {len(items)}/{len(items)}")
        same = sum(1 for k, v in done.items() if flat[k] == v)
        if same / len(done) > 0.95:
            print(f"{loc}: ABORT — {same}/{len(done)} unchanged, not writing")
            continue
        out_path.write_text(
            json.dumps(unflatten(done), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"{loc}: wrote {out_path}")

    print("Done. Next: register each locale (dictionaries.ts + config.ts) and run the key-parity check.")


if __name__ == "__main__":
    main()
