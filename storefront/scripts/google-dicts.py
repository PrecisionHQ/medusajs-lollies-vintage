#!/usr/bin/env python3
"""P11-global — Google Translate (unofficial gtx endpoint, no key) MT drafts.

STOPGAP drafts pending human review (same status as the DeepL/Argos plan).
Plain-text segments only: {var} placeholders and <br /> tags are split out
beforehand and spliced back verbatim.

Usage:
  python3 storefront/scripts/google-dicts.py es it nl pt da sv
  python3 storefront/scripts/google-dicts.py --all --force

Notes:
- Existing files are SKIPPED unless --force (never clobber human review).
- Polite rate: 10 segments/request, ~1s between requests, backoff on 429.
- After adding a locale: one line in REGISTRY (src/i18n/dictionaries.ts)
  + the code in SUPPORTED_LOCALES (src/i18n/config.ts).
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EN_PATH = ROOT / "src/i18n/dictionaries/en.json"

ALL = [
    "es", "it", "nl", "pt", "da", "sv", "nb", "fi", "el", "pl", "cs",
    "hu", "ro", "uk", "ru", "tr", "ar", "hi", "id", "ms", "th",
    "vi", "ko", "ja", "zh-CN",
]

SPLIT_RE = re.compile(r"(\{\w+\}|<br\s*/>)")
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}


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


def gtx_batch(texts, target, tries=4):
    params = [("client", "gtx"), ("sl", "en"), ("tl", target), ("dt", "t")]
    params += [("q", t) for t in texts]
    url = "https://translate.googleapis.com/translate_a/single?" + urllib.parse.urlencode(params)
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=30) as res:
                data = json.load(res)
            return ["".join(s[0] for s in item[0]) for item in data[0]]
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = 10 * (attempt + 1)
                print(f"      429 — waiting {wait}s", flush=True)
                time.sleep(wait)
                continue
            raise
    raise RuntimeError(f"gtx failed after {tries} tries")


def protect(text):
    parts = SPLIT_RE.split(text)
    return [(p, False) if SPLIT_RE.fullmatch(p) else (p, True) for p in parts if p]


def main():
    args = sys.argv[1:]
    force = "--force" in args
    targets = [a for a in args if not a.startswith("--")]
    if "--all" in args:
        targets = ALL
    if not targets:
        sys.exit("Usage: google-dicts.py <locale...> [--force] [--all]")

    en = json.loads(EN_PATH.read_text(encoding="utf-8"))
    flat = flatten(en)
    items = list(flat.items())
    print(f"{len(items)} keys x {len(targets)} locales", flush=True)

    for loc in targets:
        out_path = ROOT / f"src/i18n/dictionaries/{loc}.json"
        if out_path.exists() and not force:
            print(f"{loc}: exists, skipped (use --force to overwrite)")
            continue
        # Collect translatable segments across all strings.
        jobs = []  # (key, [segment_indexes...])
        segments = []
        seg_of = {}
        for key, value in items:
            idxs = []
            for part, do_t in protect(value):
                if do_t and part.strip():
                    idxs.append(len(segments))
                    segments.append(part)
                else:
                    idxs.append(None)
            jobs.append((key, [p for p, _ in protect(value)], idxs))
        translated = [None] * len(segments)
        BATCH = 10
        try:
            for i in range(0, len(segments), BATCH):
                chunk = segments[i:i + BATCH]
                done = gtx_batch(chunk, loc)
                translated[i:i + BATCH] = done
                print(f"\r{loc}: {min(i + BATCH, len(segments))}/{len(segments)} segs",
                      end="", flush=True)
                time.sleep(1.0)
        except Exception as e:
            print(f"\n{loc}: FAILED ({e}) — leaving English fallback")
            continue
        print("")
        # Reassemble, splicing protected parts back verbatim.
        result = {}
        for key, parts, idxs in jobs:
            chunks = []
            si = 0
            for part, do_t in protect(flat[key]):
                if do_t and part.strip():
                    chunks.append(translated[idxs[si]] or part)
                    si += 1
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
    import urllib.error  # noqa: E402  (kept local to survive stripped envs)
    main()
