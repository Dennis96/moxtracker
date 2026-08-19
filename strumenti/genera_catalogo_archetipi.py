r"""Genera il catalogo server-side degli archetipi usando il DB locale di Arena.

Non cambia il protocollo inviato da MOX e non fa deduzioni dai colori.
Converte invece le decklist curate di mox-meta in firme confrontabili con gli
ID numerici che MOXTRACKER conserva in `carte_mazzo`.

Uso dalla root di moxtracker:
    python strumenti\genera_catalogo_archetipi.py

Se il progetto MOX non e' nella cartella sorella `Codice`, indicarlo:
    python strumenti\genera_catalogo_archetipi.py --mox "C:\\...\\Codice"
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "src" / "catalogo-archetipi-generato.js"
BASICHE = {"plains", "island", "swamp", "mountain", "forest"}


def normalizza(nome: str) -> str:
    testo = unicodedata.normalize("NFKC", str(nome or "")).casefold().strip()
    return " ".join(testo.split())


def trova_mox(esplicito: str | None) -> Path:
    if esplicito:
        base = Path(esplicito).expanduser().resolve()
        if (base / "strumenti" / "costo_mazzo.py").is_file():
            return base
        if (base / "costo_mazzo.py").is_file():
            return base.parent
        raise SystemExit(f"Non trovo gli strumenti MOX in: {base}")

    candidati = [
        ROOT.parent / "Codice",
        ROOT.parent / "codice",
        ROOT.parent / "MOX" / "Codice",
        ROOT.parent / "Mox" / "Codice",
    ]
    for base in candidati:
        if (base / "strumenti" / "costo_mazzo.py").is_file():
            return base.resolve()
    raise SystemExit(
        "Non trovo automaticamente la cartella Codice di MOX. "
        "Rilancia con --mox \"C:\\percorso\\Codice\"."
    )


def trova_meta(base_mox: Path, esplicito: str | None) -> Path:
    if esplicito:
        p = Path(esplicito).expanduser().resolve()
        if p.is_file():
            return p
        raise SystemExit(f"Non trovo il file meta indicato: {p}")
    candidati = [
        base_mox / "meta" / "standard.json",
        base_mox.parent / "mox-meta" / "meta" / "standard.json",
        ROOT.parent / "mox-meta" / "meta" / "standard.json",
    ]
    for p in candidati:
        if p.is_file():
            return p.resolve()
    raise SystemExit(
        "Non trovo standard.json. Usa --meta \"C:\\...\\standard.json\"."
    )


def carica_carte_arena(base_mox: Path):
    strumenti = base_mox / "strumenti"
    sys.path.insert(0, str(strumenti))
    try:
        from costo_mazzo import trova_database  # type: ignore
        from lingua import carica_carte  # type: ignore
    except Exception as exc:  # noqa: BLE001
        raise SystemExit(f"Non riesco a importare gli strumenti MOX: {exc}") from exc

    db = trova_database()
    if not db:
        raise SystemExit("Database delle carte di MTG Arena non trovato.")
    carte, _ = carica_carte(db)
    if not carte:
        raise SystemExit("Il database Arena e' leggibile ma non contiene carte.")
    return carte, Path(db)


def leggi_riga_lista(riga: str):
    m = re.match(r"^\s*(\d+)\s+(.+?)\s*$", str(riga or ""))
    if not m:
        return None
    return int(m.group(1)), m.group(2)


def risolvi_nome_catalogo(nome: str, ids_per_nome: dict[str, set[int]]):
    """Restituisce il nome canonico usato dal DB Arena.

    Le decklist pubbliche possono scrivere le carte trasformabili come
    ``Fronte // Retro`` mentre il DB locale di Arena puo' indicizzare soltanto
    la faccia anteriore, che e' quella effettivamente inseribile nel mazzo.
    Prima proviamo sempre il nome completo; il fallback alla faccia anteriore
    vale soltanto quando e' presente esplicitamente il separatore ``//``.
    """
    esatto = normalizza(nome)
    if esatto in ids_per_nome:
        return esatto

    if "//" in str(nome):
        fronte = normalizza(str(nome).split("//", 1)[0])
        if fronte in ids_per_nome:
            return fronte

    return None


def js_export(dati: dict) -> str:
    corpo = json.dumps(dati, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return (
        "// FILE GENERATO. Non modificarlo a mano.\n"
        "// Origine: mox-meta + database carte locale di MTG Arena.\n"
        f"export const CATALOGO_ARCHETIPI = {corpo};\n"
    )


def genera(base_mox: Path, meta_path: Path):
    carte, db = carica_carte_arena(base_mox)
    dati = json.loads(meta_path.read_text(encoding="utf-8"))
    formato = str(dati.get("formato") or "Standard")
    if formato.casefold() != "standard":
        raise SystemExit("La prima versione del motore genera soltanto Standard.")

    ids_per_nome: dict[str, set[int]] = {}
    for arena_id, info in carte.items():
        try:
            ident = int(arena_id)
        except (TypeError, ValueError):
            continue
        nomi = (info or {}).get("nomi") or {}
        nome = nomi.get("enUS")
        if not nome:
            continue
        ids_per_nome.setdefault(normalizza(nome), set()).add(ident)

    liste = []
    nomi_catalogo: set[str] = set()
    mancanti: set[str] = set()
    for mazzo in dati.get("mazzi") or []:
        firma: dict[str, int] = {}
        for riga in mazzo.get("lista") or []:
            parsed = leggi_riga_lista(riga)
            if not parsed:
                continue
            copie, nome = parsed
            key_originale = normalizza(nome)
            if key_originale in BASICHE:
                continue
            key = risolvi_nome_catalogo(nome, ids_per_nome)
            if key is None:
                mancanti.add(nome)
                continue
            nomi_catalogo.add(key)
            firma[key] = firma.get(key, 0) + copie
        liste.append({
            "id": mazzo.get("id"),
            "nome": mazzo.get("nome"),
            "archetipo": mazzo.get("archetipo") or mazzo.get("nome"),
            "archetipo_id": mazzo.get("archetipo_id") or mazzo.get("id"),
            "strategia": mazzo.get("strategia"),
            "colori": mazzo.get("colori") or [],
            "modalita": mazzo.get("modalita"),
            "firma": firma,
        })

    if mancanti:
        esempio = ", ".join(sorted(mancanti)[:12])
        raise SystemExit(
            f"Catalogo non generato: {len(mancanti)} nomi non esistono nel DB Arena "
            f"locale. Esempi: {esempio}"
        )

    # Mappa soltanto i nomi che possono servire al confronto, piu' tutte le
    # stampe delle cinque terre base. Questo mantiene piccolo il bundle Worker.
    richiesti = nomi_catalogo | BASICHE
    id_a_nome = {}
    basi_ids = []
    for nome in sorted(richiesti):
        for arena_id in sorted(ids_per_nome.get(nome, ())):
            id_a_nome[str(arena_id)] = nome
            if nome in BASICHE:
                basi_ids.append(arena_id)

    catalogo = {
        "versione": 1,
        "generato": True,
        "formato": formato,
        "aggiornato": dati.get("aggiornato"),
        "generato_il": date.today().isoformat(),
        "id_a_nome": id_a_nome,
        "basi_ids": sorted(set(basi_ids)),
        "liste": liste,
    }
    OUTPUT.write_text(js_export(catalogo), encoding="utf-8", newline="\n")
    return {
        "db": str(db),
        "meta": str(meta_path),
        "liste": len(liste),
        "nomi": len(nomi_catalogo),
        "ids": len(id_a_nome),
        "output": str(OUTPUT),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mox", help="Cartella Codice del progetto MOX")
    parser.add_argument("--meta", help="Percorso esplicito a meta/standard.json")
    args = parser.parse_args()
    base_mox = trova_mox(args.mox)
    meta_path = trova_meta(base_mox, args.meta)
    esito = genera(base_mox, meta_path)
    print("catalogo archetipi: OK")
    print(f"  database Arena: {esito['db']}")
    print(f"  meta:           {esito['meta']}")
    print(f"  liste:          {esito['liste']}")
    print(f"  nomi carte:     {esito['nomi']}")
    print(f"  Arena ID mappati: {esito['ids']}")
    print(f"  scritto:        {esito['output']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
