#!/usr/bin/env python3
"""P11-global — Opus-MT (Helsinki-NLP, free, open weights) MT drafts.

Runs locally on CPU via transformers+torch (no server, no key).
Plain-text segments only: {var} placeholders and <br /> tags are split
out beforehand and spliced back verbatim.

Usage:
  /tmp/argosvenv/bin/python storefront/scripts/opus-dicts.py es it nl pt da sv
  /tmp/argosvenv/bin/python storefront/scripts/opus-dicts.py --all --force

Notes:
- Existing files are SKIPPED unless --force (never clobber human review).
- Locales without an opus-mt-en-xx model stay English-fallback.
- Refuses to write output >95% identical to English (misfire guard).
- After adding a locale: one line in REGISTRY (src/i18n/dictionaries.ts)
  + the code in SUPPORTED_LOCALES (src/i18n/config.ts).
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EN_PATH = ROOT / "src/i18n/dictionaries/en.json"

ALL = ["es", "it", "nl", "pt", "da", "sv", "nb", "fi", "el", "pl", "cs",
       "hu", "ro", "uk", "ru", "tr", "ar", "hi", "id", "ms", "th",
       "vi", "ko", "ja", "zh"]

SPLIT_RE = re.compile(r"(\{\w+\}|<br\s*/>)")
BATCH = 16

# Locales whose model id differs from the opus-mt-en-xx pattern.
MODEL_OVERRIDE = {
    "pt": "Helsinki-NLP/opus-mt-tc-big-en-pt",
}


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


def protect(text):
    parts = SPLIT_RE.split(text)
    return [(p, False) if SPLIT_RE.fullmatch(p) else (p, True) for p in parts if p]


def main():
    from transformers import MarianMTModel, MarianTokenizer

    args = sys.argv[1:]
    force = "--force" in args
    targets = [a for a in args if not a.startswith("--")]
    if "--all" in args:
        targets = ALL
    if not targets:
        sys.exit("Usage: opus-dicts.py <locale...> [--force] [--all]")

    en = json.loads(EN_PATH.read_text(encoding="utf-8"))
    flat = flatten(en)
    items = list(flat.items())
    print(f"{len(items)} keys x {len(targets)} locales", flush=True)

    for loc in targets:
        out_path = ROOT / f"src/i18n/dictionaries/{loc}.json"
        if out_path.exists() and not force:
            print(f"{loc}: exists, skipped (use --force to overwrite)")
            continue
        name = MODEL_OVERRIDE.get(loc, f"Helsinki-NLP/opus-mt-en-{loc}")
        try:
            tok = MarianTokenizer.from_pretrained(name)
            model = MarianMTModel.from_pretrained(name)
            model.eval()
        except Exception as e:
            print(f"{loc}: no model {name} ({e}) — leaving English fallback")
            continue
        # Collect unique translatable segments (dedupe repeats).
        seg_index = {}
        segments = []
        for _, value in items:
            for part, do_t in protect(value):
                if do_t and part.strip() and part not in seg_index:
                    seg_index[part] = len(segments)
                    segments.append(part)
        translated = [None] * len(segments)
        import torch

        with torch.no_grad():
            for i in range(0, len(segments), BATCH):
                chunk = segments[i:i + BATCH]
                enc = tok(chunk, return_tensors="pt", padding=True,
                          truncation=True, max_length=128)
                gen = model.generate(**enc, max_length=128)
                out = tok.batch_decode(gen, skip_special_tokens=True)
                translated[i:i + BATCH] = [s.strip() for s in out]
                print(f"\r{loc}: {min(i + BATCH, len(segments))}/{len(segments)} segs",
                      end="", flush=True)
        print("")
        result = {}
        for key, value in items:
            chunks = []
            for part, do_t in protect(value):
                if do_t and part.strip():
                    chunks.append(translated[seg_index[part]] or part)
                else:
                    chunks.append(part)
            result[key] = "".join(chunks)
        same = sum(1 for k, v in result.items() if flat[k] == v)
        if same / len(result) > 0.95:
            print(f"{loc}: ABORT — {same}/{len(result)} unchanged, not writing")
            continue
        out_path.write_text(
            json.dumps(unflatten(result), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"{loc}: wrote {out_path}")

    print("Done. Next: register each locale (dictionaries.ts + config.ts) and run the key-parity check.")


if __name__ == "__main__":
    main()
