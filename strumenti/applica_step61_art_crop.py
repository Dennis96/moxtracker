#!/usr/bin/env python3
from pathlib import Path

TARGETS = [
    "sito/js/card-images.js",
    "sito/css/card-images.css",
    "prove/card-images.test.js",
]
NEW_MD = "STEP6.1-ART-CROP-THUMBNAIL.md"
MD_TEXT = "# STEP 6.1 — Thumbnail artwork delle carte\n\nData: 2026-08-19\n\n## Contesto\n\nLo STEP 6 ha introdotto immagini reali Scryfall e hover preview.\n\nLa prima verifica visiva ha mostrato che usare l'immagine completa della carta anche come miniatura rende le carte troppo piccole e poco leggibili.\n\nLa preview hover della carta completa, invece, è stata approvata.\n\n## Decisione UI\n\nNelle viste compatte MOXTRACKER mostra soltanto l'illustrazione:\n\n- Meta Explorer: artwork crop;\n- Lista di riferimento: artwork crop;\n- Varianti osservate: artwork crop;\n- mobile: artwork crop.\n\nL'hover desktop continua a mostrare la carta completa.\n\n## Implementazione\n\nScryfall `image_uris.art_crop` viene usato come thumbnail.\n\nFallback: `art_crop -> small`.\n\nLa carta completa dell'hover continua a usare `normal`.\n\nNon vengono aggiunte nuove richieste API.\n\n## Modifiche visive\n\n- thumbnail standard: 48 px, formato 4:3;\n- thumbnail decklist: 46 px;\n- mobile: 42 px;\n- massimo 8 carte core desktop;\n- massimo 5 carte core mobile.\n\n## File modificati\n\n- `sito/js/card-images.js`\n- `sito/css/card-images.css`\n- `prove/card-images.test.js`\n\n## File creati\n\n- `STEP6.1-ART-CROP-THUMBNAIL.md`\n- `strumenti/applica_step61_art_crop.py`\n\n## Archetype Engine\n\nNessuna modifica.\n\nRestano invariati:\n\n- soglia variante 0.90;\n- margine variante 0.03;\n- core threshold 0.60;\n- minimo core 5;\n- margine core 0.20.\n\n## Nota Meta Explorer\n\nLa mancanza delle immagini core nel test locale non dipende da Scryfall.\n\nIl frontend locale continua a interrogare `https://api.moxtracker.app`, mentre il campo `carte_core` esiste per ora soltanto nel backend STEP 6 locale non ancora pubblicato.\n\nLa verifica Meta Explorer va quindi ripetuta dopo l'aggiornamento del Worker o contro un backend locale equivalente.\n\n## Test\n\nDopo l'applicazione:\n\n```bat\nnpm run prove\ngit status --short\ngit diff --stat\n```\n\nNon fare ancora commit/push.\n"


def find_root():
    candidates = [Path.cwd(), Path(__file__).resolve().parent.parent]
    for candidate in candidates:
        if (candidate / "package.json").is_file() and (candidate / "sito").is_dir():
            return candidate.resolve()
    raise SystemExit("Non trovo la root moxtracker. Esegui lo script dalla root del repository.")


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(
            f"Patch annullata: blocco inatteso in {label} "
            f"(occorrenze trovate: {count}, attese: 1)."
        )
    return text.replace(old, new, 1)


def main():
    root = find_root()

    for relative in TARGETS:
        if not (root / relative).is_file():
            raise SystemExit(
                f"Patch annullata: manca {relative}. Prima applica correttamente lo STEP 6."
            )

    if (root / NEW_MD).exists():
        raise SystemExit(
            f"Patch annullata: {NEW_MD} esiste gia'. Controlla se lo STEP 6.1 e' gia' stato applicato."
        )

    changed = {
        relative: (root / relative).read_text(encoding="utf-8")
        for relative in TARGETS
    }

    js = changed["sito/js/card-images.js"]
    js = replace_once(
        js,
        "  const small = uris.small || uris.normal || uris.large || uris.png || null;\n"
        "  const normal = uris.normal || uris.large || uris.png || small;\n"
        "  if (!small || !normal) return null;\n\n"
        "  return {\n"
        "    missing: false,\n"
        "    name: cleanName(card.name || face?.name),\n"
        "    arenaId: positiveArenaId(card.arena_id),\n"
        "    small,\n"
        "    normal,",
        "  const small = uris.small || uris.normal || uris.large || uris.png || null;\n"
        "  const artCrop = uris.art_crop || small;\n"
        "  const normal = uris.normal || uris.large || uris.png || small;\n"
        "  if (!small || !normal) return null;\n\n"
        "  return {\n"
        "    missing: false,\n"
        "    name: cleanName(card.name || face?.name),\n"
        "    arenaId: positiveArenaId(card.arena_id),\n"
        "    artCrop,\n"
        "    small,\n"
        "    normal,",
        "sito/js/card-images.js",
    )
    js = replace_once(
        js,
        "    if (!media?.small) {\n"
        "      node.classList.add(\"is-missing\");\n"
        "      placeholder.textContent = \"?\";\n"
        "      return;\n"
        "    }\n\n"
        "    image.addEventListener(\"load\", () => node.classList.add(\"is-loaded\"), { once: true });",
        "    const thumbnail = media?.artCrop || media?.small;\n"
        "    if (!thumbnail) {\n"
        "      node.classList.add(\"is-missing\");\n"
        "      placeholder.textContent = \"?\";\n"
        "      return;\n"
        "    }\n\n"
        "    image.addEventListener(\"load\", () => node.classList.add(\"is-loaded\"), { once: true });",
        "sito/js/card-images.js",
    )
    js = replace_once(
        js,
        "    image.src = media.small;\n"
        "    image.alt = media.name || spec.name || \"Carta Magic\";",
        "    image.src = thumbnail;\n"
        "    image.alt = media.name || spec.name || \"Carta Magic\";",
        "sito/js/card-images.js",
    )
    changed["sito/js/card-images.js"] = js

    css = changed["sito/css/card-images.css"]
    replacements = [
        ("  width: 36px;\n  aspect-ratio: 488 / 680;", "  width: 48px;\n  aspect-ratio: 4 / 3;"),
        (".card-thumb-compact { width: 34px; }", ".card-thumb-compact { width: 46px; }"),
        ("  grid-template-columns: 34px 38px minmax(0, 1fr);", "  grid-template-columns: 46px 38px minmax(0, 1fr);"),
        ("  .core-cards .card-thumb { width: 32px; }", "  .core-cards .card-thumb { width: 42px; }"),
        ("    grid-template-columns: 32px 34px minmax(0, 1fr);", "    grid-template-columns: 42px 34px minmax(0, 1fr);"),
        ("  .card-thumb-compact { width: 32px; }", "  .card-thumb-compact { width: 42px; }"),
    ]
    for old, new in replacements:
        css = replace_once(css, old, new, "sito/css/card-images.css")
    changed["sito/css/card-images.css"] = css

    tests = changed["prove/card-images.test.js"]
    tests = replace_once(
        tests,
        '    image_uris: {\n'
        '      small: "https://cards.scryfall.io/small/a.jpg",\n'
        '      normal: "https://cards.scryfall.io/normal/a.jpg",\n'
        '    },',
        '    image_uris: {\n'
        '      art_crop: "https://cards.scryfall.io/art_crop/a.jpg",\n'
        '      small: "https://cards.scryfall.io/small/a.jpg",\n'
        '      normal: "https://cards.scryfall.io/normal/a.jpg",\n'
        '    },',
        "prove/card-images.test.js",
    )
    tests = replace_once(
        tests,
        '    arenaId: 987,\n'
        '    small: "https://cards.scryfall.io/small/a.jpg",',
        '    arenaId: 987,\n'
        '    artCrop: "https://cards.scryfall.io/art_crop/a.jpg",\n'
        '    small: "https://cards.scryfall.io/small/a.jpg",',
        "prove/card-images.test.js",
    )
    tests = replace_once(
        tests,
        '      image_uris: {\n'
        '        small: "https://cards.scryfall.io/small/front.jpg",\n'
        '        normal: "https://cards.scryfall.io/normal/front.jpg",\n'
        '      },',
        '      image_uris: {\n'
        '        art_crop: "https://cards.scryfall.io/art_crop/front.jpg",\n'
        '        small: "https://cards.scryfall.io/small/front.jpg",\n'
        '        normal: "https://cards.scryfall.io/normal/front.jpg",\n'
        '      },',
        "prove/card-images.test.js",
    )
    tests = replace_once(
        tests,
        '  assert.equal(media?.small, "https://cards.scryfall.io/small/front.jpg");',
        '  assert.equal(media?.artCrop, "https://cards.scryfall.io/art_crop/front.jpg");\n'
        '  assert.equal(media?.small, "https://cards.scryfall.io/small/front.jpg");',
        "prove/card-images.test.js",
    )
    changed["prove/card-images.test.js"] = tests

    # Scrive solo dopo aver verificato tutti i blocchi.
    for relative, content in changed.items():
        (root / relative).write_text(content, encoding="utf-8", newline="\n")
    (root / NEW_MD).write_text(MD_TEXT, encoding="utf-8", newline="\n")

    print("STEP 6.1 applicato.")
    print("Miniature: artwork crop; hover: carta completa.")
    print()
    print("Ora esegui:")
    print("  npm run prove")
    print("  git status --short")
    print("  git diff --stat")
    print()
    print("Non fare ancora commit o push.")


if __name__ == "__main__":
    main()
