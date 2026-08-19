r"""Genera il catalogo server-side degli archetipi usando il DB locale di Arena.

STEP 5.3 mantiene separati:
- archetipo: famiglia strategica riconoscibile dal core;
- variante: lista quasi identica al riferimento (>= 90%);
- nome pubblico: etichetta canonica leggibile sul sito, distinta dai nomi interni.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from collections import Counter
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "src" / "catalogo-archetipi-generato.js"
BASICHE = {"plains", "island", "swamp", "mountain", "forest"}
CORE_MAX_CARTE = 8

NOMI_PUBBLICI = {
    "aure-mono-bianco": "Mono White Auras",
    "rakdos-aggro": "Rakdos Aggro",
    "mono-red": "Mono Red",
    "mono-white-lifegain": "Mono White Lifegain",
    "dimir": "Dimir Control (Bo3)",
    "dimir-control": "Dimir Control (Bo1)",
    "azorius": "Azorius Control",
    "naya": "Naya Aggro",
    "mono-black": "Mono Black Midrange",
    "boros-prodezze": "Boros Prowess",
    "golgari": "Golgari Midrange",
    "aure-orzhov": "Orzhov Auras",
    "boros-schiera": "Boros Aggro",
    "mono-blue": "Mono Blue Tempo",
    "mono-black-ladri": "Mono Black Aggro",
    "azorius-flash": "Azorius Flash",
    "orzhov-skeletons": "Orzhov Skeletons",
    "izzet-robots": "Izzet Robots",
    "jeskai-artifacts": "Jeskai Artifacts",
    "mono-green-landfall": "Mono Green Landfall",
    "izzet-spellementals": "Izzet Spellementals",
    "four-color-reanimator": "Four-Color Reanimator",
    "five-color-dragonstorm": "Five-Color Dragonstorm",
}


def normalizza(nome: str) -> str:
    testo = unicodedata.normalize("NFKC", str(nome or "")).casefold().strip()
    return " ".join(testo.split())


def nome_pubblico(mazzo: dict) -> str:
    ident = str(mazzo.get("archetipo_id") or mazzo.get("id") or "")
    if ident in NOMI_PUBBLICI:
        return NOMI_PUBBLICI[ident]
    tier = str(mazzo.get("tier_archetipo") or "").strip()
    if tier:
        return tier
    nome = str(mazzo.get("nome") or mazzo.get("archetipo") or ident).strip()
    nome = re.sub(r"\s*\((?:Bo1|Bo3|versione da ladder)\)\s*$", "", nome, flags=re.I)
    return nome or ident


def trova_mox(esplicito: str | None) -> Path:
    if esplicito:
        base = Path(esplicito).expanduser().resolve()
        if (base / "strumenti" / "costo_mazzo.py").is_file():
            return base
        if (base / "costo_mazzo.py").is_file():
            return base.parent
        raise SystemExit(f"Non trovo gli strumenti MOX in: {base}")
    candidati = [
        ROOT.parent / "Codice", ROOT.parent / "codice",
        ROOT.parent / "MOX" / "Codice", ROOT.parent / "Mox" / "Codice",
    ]
    for base in candidati:
        if (base / "strumenti" / "costo_mazzo.py").is_file():
            return base.resolve()
    raise SystemExit("Non trovo automaticamente la cartella Codice di MOX. Usa --mox.")


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
    raise SystemExit("Non trovo standard.json. Usa --meta.")


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
    esatto = normalizza(nome)
    if esatto in ids_per_nome:
        return esatto
    if "//" in str(nome):
        fronte = normalizza(str(nome).split("//", 1)[0])
        if fronte in ids_per_nome:
            return fronte
    return None


def core_dichiarato(mazzo: dict, firma: dict[str, int],
                    ids_per_nome: dict[str, set[int]]) -> list[str]:
    fuori: list[str] = []
    policy = mazzo.get("budget_policy") or {}
    for nome in policy.get("core") or []:
        key = risolvi_nome_catalogo(str(nome), ids_per_nome)
        if key and key in firma and key not in fuori:
            fuori.append(key)
    return fuori


def completa_core(liste: list[dict]) -> None:
    carte_per_archetipo: dict[str, set[str]] = {}
    for lista in liste:
        ident = str(lista.get("archetipo_id") or lista.get("id") or "")
        carte_per_archetipo.setdefault(ident, set()).update((lista.get("firma") or {}).keys())
    frequenza_archetipi: Counter[str] = Counter()
    for carte in carte_per_archetipo.values():
        frequenza_archetipi.update(carte)

    for lista in liste:
        firma = lista.get("firma") or {}
        scelti: list[str] = []
        for nome in lista.pop("_core_dichiarato", []) or []:
            if nome in firma and nome not in scelti:
                scelti.append(nome)
        candidati = [nome for nome in firma if nome not in scelti]
        candidati.sort(key=lambda nome: (
            0 if int(firma.get(nome, 0)) >= 3 else 1 if int(firma.get(nome, 0)) == 2 else 2,
            frequenza_archetipi.get(nome, 999), -int(firma.get(nome, 0)), nome,
        ))
        for nome in candidati:
            if len(scelti) >= CORE_MAX_CARTE:
                break
            scelti.append(nome)
        lista["core"] = scelti[:CORE_MAX_CARTE]


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
        if nome:
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

        dichiarato = core_dichiarato(mazzo, firma, ids_per_nome)
        nomi_catalogo.update(dichiarato)
        liste.append({
            "id": mazzo.get("id"),
            "nome": mazzo.get("nome"),
            "nome_pubblico": nome_pubblico(mazzo),
            "archetipo": mazzo.get("archetipo") or mazzo.get("nome"),
            "archetipo_id": mazzo.get("archetipo_id") or mazzo.get("id"),
            "strategia": mazzo.get("strategia"),
            "colori": mazzo.get("colori") or [],
            "modalita": mazzo.get("modalita"),
            "fonte": mazzo.get("fonte"),
            "data": mazzo.get("data"),
            "lista_riferimento": mazzo.get("lista") or [],
            "sideboard_riferimento": mazzo.get("sideboard") or [],
            "firma": firma,
            "_core_dichiarato": dichiarato,
        })

    if mancanti:
        esempio = ", ".join(sorted(mancanti)[:12])
        raise SystemExit(
            f"Catalogo non generato: {len(mancanti)} nomi non esistono nel DB Arena locale. "
            f"Esempi: {esempio}"
        )

    completa_core(liste)
    for lista in liste:
        nomi_catalogo.update(lista.get("core") or [])

    # Il classificatore usa soprattutto le carte presenti nelle liste curate,
    # ma la pagina delle varianti deve poter mostrare il nome di QUALSIASI carta
    # realmente osservata da MOXTRACKER. Per questo il dizionario pubblico ID ->
    # nome viene generato da tutto il database locale di Arena, non soltanto dal
    # sottoinsieme presente in mox-meta. Le soglie e i core restano invariati.
    id_a_nome = {}
    basi_ids = []
    for nome in sorted(ids_per_nome):
        for arena_id in sorted(ids_per_nome.get(nome, ())):
            id_a_nome[str(arena_id)] = nome
            if nome in BASICHE:
                basi_ids.append(arena_id)

    catalogo = {
        "versione": 4,
        "generato": True,
        "formato": formato,
        "aggiornato": dati.get("aggiornato"),
        "generato_il": date.today().isoformat(),
        "nomi_arena_completi": True,
        "id_a_nome": id_a_nome,
        "basi_ids": sorted(set(basi_ids)),
        "liste": liste,
    }
    OUTPUT.write_text(js_export(catalogo), encoding="utf-8", newline="\n")
    return {
        "db": str(db), "meta": str(meta_path), "liste": len(liste),
        "nomi": len(nomi_catalogo), "nomi_arena": len(ids_per_nome), "ids": len(id_a_nome),
        "cores": sum(1 for lista in liste if lista.get("core")),
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
    print(f"  core generati:  {esito['cores']}")
    print(f"  nomi usati dal classificatore: {esito['nomi']}")
    print(f"  nomi Arena disponibili:        {esito['nomi_arena']}")
    print(f"  Arena ID nominati:             {esito['ids']}")
    print(f"  scritto:        {esito['output']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
