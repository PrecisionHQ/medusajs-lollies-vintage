#!/usr/bin/env python3
"""P11-global — Argos Translate (free, offline, open-source) MT drafts.

Usage:
  /tmp/argosvenv/bin/python storefront/scripts/argos-dicts.py es it nl pt da sv
  /tmp/argosvenv/bin/python storefront/scripts/argos-dicts.py --all --force

Notes:
- {var} placeholders and <br /> tags are split out before translating and
  spliced back verbatim — the engine never sees them.
- Existing files are SKIPPED unless --force (never clobber human review).
- After adding a locale: one line in REGISTRY (src/i18n/dictionaries.ts)
  + the code in SUPPORTED_LOCALES (src/i18n/config.ts).
- Locales without an Argos en->xx package print a warning and stay
  English-fallback (t() covers them per-key).
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EN_PATH = ROOT / "src/i18n/dictionaries/en.json"

# Locales worth drafting in bulk with --all (have Argos packages today).
ALL = [
    "es", "it", "nl", "pt", "da", "sv", "nb", "fi", "el", "pl", "cs",
    "hu", "ro", "uk", "ru", "tr", "ar", "hi", "id", "ms", "th",
    "vi", "ko", "ja", "zh",
]

SPLIT_RE = re.compile(r"(\{\w+\}|<br\s*/>)")

try:
    from argostranslate import package as pkg
    from argostranslate import translate as mt
except ImportError:
    sys.exit("Install first: python3 -m venv /tmp/argosvenv && /tmp/argosvenv/bin/pip install argostranslate")


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


def get_translator(target):
    langs = {str(l.code): l for l in mt.get_installed_languages()}
    src = langs.get("en")
    dst = langs.get(target)
    if not src or not dst:
        return None
    return src.get_translation(dst)


def ensure_package(target):
    langs = {str(l.code) for l in mt.get_installed_languages()}
    if target in langs and "en" in langs:
        return True
    pkg.update_package_index()
    avail = pkg.get_available_packages()
    cand = [p for p in avail if p.from_code == "en" and p.to_code == target]
    if not cand:
        return False
    path = cand[0].download()
    pkg.install_from_path(path)
    return True


def protect(text):
    """Split into (translatable, protected) segments."""
    parts = SPLIT_RE.split(text)
    segs = [(p, False) if SPLIT_RE.fullmatch(p) else (p, True) for p in parts if p]
    return segs


def translate_text(text, translator):
    out = []
    for part, do_translate in protect(text):
        if do_translate and part.strip():
            try:
                out.append(translator.translate(part))
            except Exception as e:
                print(f"      segment failed ({e!r}) — keeping English", flush=True)
                out.append(part)
        else:
            out.append(part)
    return "".join(out)


def main():
    args = sys.argv[1:]
    force = "--force" in args
    targets = [a for a in args if not a.startswith("--")]
    if "--all" in args:
        targets = ALL
    if not targets:
        sys.exit("Usage: argos-dicts.py <locale...> [--force] [--all]")

    en = json.loads(EN_PATH.read_text(encoding="utf-8"))
    flat = flatten(en)
    items = list(flat.items())
    print(f"{len(items)} keys x {len(targets)} locales", flush=True)

    for loc in targets:
        out_path = ROOT / f"src/i18n/dictionaries/{loc}.json"
        if out_path.exists() and not force:
            print(f"{loc}: exists, skipped (use --force to overwrite)")
            continue
        if not ensure_package(loc):
            print(f"{loc}: no Argos en->{loc} package — leaving English fallback")
            continue
        translator = get_translator(loc)
        if not translator:
            print(f"{loc}: package installed but translator missing — skipping")
            continue
        done = {}
        for i, (key, value) in enumerate(items):
            done[key] = translate_text(value, translator)
            if (i + 1) % 40 == 0:
                print(f"\r{loc}: {i + 1}/{len(items)}", end="", flush=True)
        print(f"\r{loc}: {len(items)}/{len(items)}")
        # Guard: refuse to ship an untranslated copy (translator misfires
        # return the source text; writing it would falsely mark the locale
        # "supported"). Abort loudly instead.
        same = sum(1 for k, v in done.items() if flat[k] == v)
        if same / len(done) > 0.95:
            print(f"{loc}: ABORT — {same}/{len(done)} strings unchanged, not writing")
            continue
        out_path.write_text(
            json.dumps(unflatten(done), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"{loc}: wrote {out_path}")

    print("Done. Next: register each locale (dictionaries.ts + config.ts) and run the key-parity check.")


if __name__ == "__main__":
    main()
