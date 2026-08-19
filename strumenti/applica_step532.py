from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: Path, old: str, new: str, label: str):
    text = path.read_text(encoding='utf-8')
    if new in text:
        print(f'  già applicato: {label}')
        return False
    if old not in text:
        raise SystemExit(f'Impossibile applicare STEP 5.3.2: blocco non trovato ({label}) in {path}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8', newline='\n')
    print(f'  modificato: {path.relative_to(ROOT)} — {label}')
    return True


print('STEP 5.3.2 — pulizia frontend Meta/Varianti')

# 1) Meta Explorer: sigla pubblica (MW invece di AM) e niente W/Aggro duplicato.
render = ROOT / 'sito' / 'js' / 'render.js'
replace_once(
    render,
    '''  const archetypeId = deckArchetypeId(deck);\n  const markText = deck.impronta\n    ? shortFingerprint(deck.impronta, 2).toUpperCase()\n    : (archetypeId || "AR").split(/[-_\\s]+/).filter(Boolean).slice(0, 2).map(x => x[0]).join("").toUpperCase();\n''',
    '''  const archetypeId = deckArchetypeId(deck);\n  const publicLabel = deckLabel(deck);\n  const publicWords = publicLabel.split(/[-_\\s]+/).filter(Boolean);\n  const markText = deck.impronta\n    ? shortFingerprint(deck.impronta, 2).toUpperCase()\n    : publicWords.slice(0, 2).map(x => x[0]).join("").toUpperCase();\n''',
    'sigla archetipo dal nome pubblico',
)
replace_once(
    render,
    '''  const text = el("span", "deck-copy");\n  text.append(el("strong", "deck-name", deckLabel(deck)), el("small", deckIsClassified(deck) ? "classified" : "", classificationSummary(deck)));\n  const meta = el("span", "deck-tags");\n''',
    '''  const text = el("span", "deck-copy");\n  text.append(el("strong", "deck-name", deckLabel(deck)));\n  if (!deckIsClassified(deck)) text.append(el("small", "", classificationSummary(deck)));\n  const meta = el("span", "deck-tags");\n''',
    'rimuove W/Aggro testuale duplicato',
)

# 2) Filtri colore: disponibile != selezionato. Il glow pieno appare solo dopo click.
site_css = ROOT / 'sito' / 'css' / 'site.css'
replace_once(
    site_css,
    '''.color-pip { width: 38px; height: 38px; border-radius: 50%; border: 1px solid rgba(255,255,255,.16); color: #111; font-weight: 950; cursor: pointer; box-shadow: inset 0 1px rgba(255,255,255,.3); transition: transform .15s ease, box-shadow .15s ease, opacity .15s ease; }\n.color-pip:hover:not(:disabled) { transform: translateY(-1px); }\n.color-pip[aria-pressed="true"] { outline: 2px solid var(--violet); outline-offset: 2px; box-shadow: 0 0 18px rgba(166,68,255,.28); }\n.color-pip:disabled { opacity: .27; cursor: not-allowed; filter: grayscale(.55); }\n''',
    '''.color-pip { width: 38px; height: 38px; border-radius: 50%; border: 1px solid rgba(255,255,255,.16); color: #111; font-weight: 950; cursor: pointer; box-shadow: inset 0 1px rgba(255,255,255,.3); opacity: .58; filter: saturate(.55); transition: transform .15s ease, box-shadow .15s ease, opacity .15s ease, filter .15s ease; }\n.color-pip:hover:not(:disabled) { transform: translateY(-1px); opacity: .82; filter: saturate(.85); }\n.color-pip[aria-pressed="true"] { opacity: 1; filter: none; outline: 2px solid var(--violet); outline-offset: 2px; box-shadow: 0 0 18px rgba(166,68,255,.28); }\n.color-pip:disabled { opacity: .20; cursor: not-allowed; filter: grayscale(.75); }\n''',
    'stato visivo filtri colore',
)

# 3) Titolo lista di riferimento singolare/plurale dinamico.
html = ROOT / 'sito' / 'archetipo.html'
replace_once(
    html,
    '''            <h2 id="decklist-detail-title" class="panel-title"><span class="icon" aria-hidden="true">▤</span>Liste di riferimento</h2>\n''',
    '''            <h2 id="decklist-detail-title" class="panel-title"><span class="icon" aria-hidden="true">▤</span><span id="reference-title-label">Lista di riferimento</span></h2>\n''',
    'titolo lista di riferimento dinamico',
)

# 4) Varianti: titolo umano, ID secondario, singolare partita, Dati insufficienti.
arch = ROOT / 'sito' / 'js' / 'archetype.js'
replace_once(
    arch,
    '''  for (const variant of variants) {\n''',
    '''  for (const [index, variant] of variants.entries()) {\n''',
    'indice umano delle varianti',
)
replace_once(
    arch,
    '''    const identity = document.createElement("div");\n    const title = document.createElement("strong"); title.textContent = `Variante ${variant.variante_id}`;\n    const sub = document.createElement("small");\n    sub.textContent = variant.lista_riferimento_nome\n      ? `Molto vicina a: ${variant.lista_riferimento_nome}`\n      : "Decklist distinta osservata su MOX";\n    identity.append(title, sub);\n    const metrics = document.createElement("div"); metrics.className = "variant-metrics";\n    metrics.innerHTML = `<span><b>${formatInteger(variant.partite)}</b> partite</span><span>${variant.dati_sufficienti ? (formatPercent(variant.win_rate) || "—") : "WR sotto soglia"}</span>`;\n''',
    '''    const identity = document.createElement("div");\n    const title = document.createElement("strong"); title.textContent = `Variante osservata #${index + 1}`;\n    const sub = document.createElement("small"); sub.textContent = `ID ${variant.variante_id}`;\n    identity.append(title, sub);\n    const metrics = document.createElement("div"); metrics.className = "variant-metrics";\n    const partiteLabel = Number(variant.partite) === 1 ? "partita" : "partite";\n    const wrLabel = variant.dati_sufficienti ? (formatPercent(variant.win_rate) || "—") : "Dati insufficienti";\n    metrics.innerHTML = `<span><b>${formatInteger(variant.partite)}</b> ${partiteLabel}</span><span>${wrLabel}</span>`;\n''',
    'titolo e metriche varianti',
)

# 5) Riferimenti: nome canonico e singolare/plurale del pannello.
replace_once(
    arch,
    '''function renderReferences(data) {\n  const host = document.querySelector("#reference-lists"); host.replaceChildren();\n  const refs = Array.isArray(data.liste_riferimento) ? data.liste_riferimento : [];\n  if (!refs.length) {\n''',
    '''function renderReferences(data) {\n  const host = document.querySelector("#reference-lists"); host.replaceChildren();\n  const refs = Array.isArray(data.liste_riferimento) ? data.liste_riferimento : [];\n  const titleLabel = document.querySelector("#reference-title-label");\n  if (titleLabel) titleLabel.textContent = refs.length === 1 ? "Lista di riferimento" : "Liste di riferimento";\n  if (!refs.length) {\n''',
    'singolare/plurale riferimenti',
)
replace_once(
    arch,
    '''    summary.textContent = [ref.nome, ref.modalita].filter(Boolean).join(" • ");\n''',
    '''    summary.textContent = [ref.nome_pubblico || ref.nome, ref.modalita].filter(Boolean).join(" • ");\n''',
    'nome canonico lista di riferimento',
)

print('STEP 5.3.2 applicata. Backend/API non modificati.')
print('Ora esegui: npm run prove')
