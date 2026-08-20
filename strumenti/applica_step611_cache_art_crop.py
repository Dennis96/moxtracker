#!/usr/bin/env python3
from pathlib import Path

MD_TEXT = "# STEP 6.1.1 — Fix cache artwork thumbnail\n\nData: 2026-08-19\n\n## Problema osservato\n\nDopo lo STEP 6.1 le thumbnail continuavano a mostrare porzioni della carta completa\ninvece dell'illustrazione Scryfall `art_crop`.\n\nLa causa non era il crop di Scryfall.\n\nLo STEP 6 aveva già salvato in `localStorage` una cache con chiave:\n\n`mox-scryfall-card-cache-v1`\n\nGli oggetti della cache v1 contengono `small` e `normal`, ma non il nuovo campo\n`artCrop` introdotto nello STEP 6.1.\n\nDi conseguenza il codice STEP 6.1 riceveva un oggetto cache vecchio e usava:\n\n`artCrop || small`\n\nquindi ricadeva su `small`, cioè la carta intera, dentro un contenitore\norizzontale. Il risultato era un ritaglio errato della carta completa.\n\n## Correzione\n\nLa cache immagini viene versionata a:\n\n`mox-scryfall-card-cache-v2`\n\nQuesto forza una nuova risoluzione Scryfall una sola volta e salva anche\n`artCrop`.\n\nInoltre il contenitore artwork passa dalla proporzione generica `4 / 3` alla\nproporzione Scryfall dell'art crop:\n\n`626 / 457`\n\n## Risultato atteso\n\nNelle liste:\n\n- solo artwork della carta;\n- niente bordo/testo della carta rimpicciolito;\n- artwork leggibile;\n- quantità e nome restano separati.\n\nHover desktop:\n\n- continua a mostrare la carta completa `normal`;\n- nessuna nuova chiamata generata dal semplice hover.\n\n## File modificati\n\n- `sito/js/card-images.js`\n- `sito/css/card-images.css`\n\n## File creati\n\n- `STEP6.1.1-FIX-CACHE-ART-CROP.md`\n- `strumenti/applica_step611_cache_art_crop.py`\n\n## File non modificati\n\nNessuna modifica a:\n\n- Archetype Engine;\n- `src/archetipi.js`;\n- soglie;\n- classificazione;\n- API;\n- database;\n- statistiche.\n\n## Test\n\nDopo l'applicazione:\n\n```bat\nnpm run prove\ngit status --short\ngit diff --stat\n```\n\nPoi sul browser locale:\n\n`Ctrl + F5`\n\nNon fare ancora commit/push prima della verifica visiva finale.\n"
MD_NAME = "STEP6.1.1-FIX-CACHE-ART-CROP.md"


def root_repo():
    for p in (Path.cwd(), Path(__file__).resolve().parent.parent):
        if (p / "package.json").is_file() and (p / "sito/js/card-images.js").is_file():
            return p.resolve()
    raise SystemExit("Non trovo la root di moxtracker.")


def replace_once(text, old, new, path):
    n = text.count(old)
    if n != 1:
        raise SystemExit(
            f"Patch annullata: in {path} trovo {n} occorrenze invece di 1. "
            "Nessun file e' stato modificato."
        )
    return text.replace(old, new, 1)


def main():
    root = root_repo()
    js_path = root / "sito/js/card-images.js"
    css_path = root / "sito/css/card-images.css"
    md_path = root / MD_NAME

    if md_path.exists():
        raise SystemExit(
            f"Patch annullata: {MD_NAME} esiste gia'. "
            "Controlla se questo fix e' gia' stato applicato."
        )

    js = js_path.read_text(encoding="utf-8")
    css = css_path.read_text(encoding="utf-8")

    # Verifica che STEP 6.1 sia realmente presente.
    if "const artCrop = uris.art_crop || small;" not in js:
        raise SystemExit(
            "Patch annullata: non trovo STEP 6.1 in card-images.js."
        )

    js_new = replace_once(
        js,
        'const CACHE_KEY = "mox-scryfall-card-cache-v1";',
        'const CACHE_KEY = "mox-scryfall-card-cache-v2";',
        "sito/js/card-images.js",
    )

    css_new = replace_once(
        css,
        "  aspect-ratio: 4 / 3;",
        "  aspect-ratio: 626 / 457;",
        "sito/css/card-images.css",
    )

    # Scrive solo dopo aver verificato tutti i blocchi.
    js_path.write_text(js_new, encoding="utf-8", newline="\n")
    css_path.write_text(css_new, encoding="utf-8", newline="\n")
    md_path.write_text(MD_TEXT, encoding="utf-8", newline="\n")

    print("STEP 6.1.1 applicato.")
    print("Cache Scryfall: v2")
    print("Thumbnail: art_crop con proporzione 626/457")
    print("Hover: carta completa invariata")
    print()
    print("Ora esegui:")
    print("  npm run prove")
    print("  git status --short")
    print("  git diff --stat")
    print()
    print("Poi torna al browser e fai Ctrl + F5.")
    print("Non fare ancora commit/push.")


if __name__ == "__main__":
    main()
