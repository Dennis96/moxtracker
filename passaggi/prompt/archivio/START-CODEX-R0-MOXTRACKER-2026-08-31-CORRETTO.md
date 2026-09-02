# START CODEX — CHIUSURA R0 `moxtracker`
**Data:** 31/08/2026
**Repository:** `moxtracker/`

---

# 1. Prima di qualsiasi modifica

Esegui soltanto controlli non distruttivi:

- `git status --short`
- branch corrente
- `git log --oneline -12`
- `git diff --stat`
- lista commit locali rispetto a `origin/main`

Non fare:
- reset;
- stash;
- clean;
- rebase;
- amend;
- push;
- deploy.

Stato locale atteso dall'ultimo handoff:

1. `fb6cb3e` — Registra preview Draft account
2. `39d56da` — Registra verifica draft link
3. `e2689a5` — Corregge tracce Draft Account senza pick
4. `3e8451a` — Chiarisce il campo legacy apertura nell'Account
5. `6414c57` — Rafforza readiness e smoke del sito
6. `5fa3d34` — Documenta proposta R3-PREP senza attivarla

Verifica la realtà Git prima di fidarti di questo elenco.

Leggi integralmente almeno:

- `STATO-CORRENTE-SITO.md`
- `R0-SITO-PUBLIC-READINESS-2026-08-31.md`
- `CHECKLIST-BETA-SITO-2026-08-27.md`
- `ACCOUNT-E-TICKET.md`
- `R3-PREP-SCHEMA-STORAGE.md`

## Gerarchia operativa

Per lo **stato corrente** prevalgono `STATO-CORRENTE-SITO.md`, gli handoff più recenti e soprattutto l'evidenza rieseguita sul **HEAD reale corrente**.

Checklist e documenti precedenti restano autorevoli per procedure, vincoli e controlli già definiti, ma non prevalgono come snapshot di branch, commit, build o numero di test.

---

# 2. Obiettivo

Chiudere **R0 lato sito/backend**.

Non aprire nuove feature.

Flusso:

```text
RC locale
  ↓
controlli reali mancanti
  ↓
fix solo dei blocker
  ↓
UNA preview completa
  ↓
3–5 tester
  ↓
R0 sito chiuso
```

---

# 3. Stato già verificato

Ultime evidenze note:

- `npm run prove` → 190/190;
- `npm run sito:build` → riuscita;
- build nota: `bb55e75aba7f7718`;
- compatibility Worker locale:
  - v1 → 200;
  - v2 → 200;
  - v3 → 400;
- `git diff --check` pulito;
- route statiche/locali principali verificate;
- nessuna migrazione D1;
- nessun deploy Worker;
- nessun deploy Pages nuovo;
- nessuna produzione.

Il lavoro locale comprende:

## M6
Correzione semantica UI di `apertura`:
- non “opening hand”;
- “ultima mano osservata” / equivalente EN;
- nessun cambio del vecchio payload.

## Account/Draft
- Draft con `pick=0` esclusi dagli indici Draft;
- partita collegata resta nello storico;
- totale Draft coerente;
- frontend e Worker allineati.

## R0-SITO
- route `/en/` locale;
- link admin EN;
- smoke Download su GitHub Latest/ZIP;
- test prelancio.

## R3-PREP
Solo documentazione.
Non autorizza:
- R3;
- SQL;
- migration;
- ingestion;
- packet v3;
- consenso Research.

---

# 4. Controlli reali ancora da chiudere

Questa è la priorità.

## Account/Ticket
Verificare realmente, in un contesto dove Worker/API e autenticazione siano validi:

1. ticket admin:
   - creazione;
   - apertura;
   - cambio stato;
   - risposta;
   - due eventi audit corretti;

2. ticket anonimo:
   - Turnstile reale;
   - invio;
   - link segreto;
   - riapertura tramite risposta;

3. revoke dispositivo:
   - revoca;
   - Mox non deve più poter scrivere;

4. export:
   - solo dati dell'account test;

5. cancellazione account test:
   - prima richiesta riuscita;
   - seconda richiesta negativa/idempotente secondo contratto.

Non dichiarare PASS usando soltanto fixture.

## Browser/UI
Verificare:
- Chrome;
- Edge;
- Firefox;
- telefono reale;
- 375px;
- 640px;
- tastiera;
- focus;
- menu mobile;
- reduced motion reale quando possibile;
- IT/EN;
- Download;
- Meta;
- Draft;
- Account;
- Supporto;
- Privacy.

Se un controllo richiede dispositivo reale non disponibile, preparare una checklist per i tester e marcarlo MANUALE, non PASS.

---

# 5. Pages preview vs Worker

Regola importante:

> una Pages preview pubblica il frontend, non sostituisce automaticamente il Worker/API.

Quindi:

### Pages preview può certificare
- HTML/CSS/JS frontend;
- IT/EN;
- responsive;
- navigazione;
- Download;
- Meta;
- Draft frontend;
- copy M6;
- asset;
- accessibilità frontend;
- smoke statico.

### Richiede Worker/API appropriato
- Account reale;
- storico Draft server-side;
- filtro Draft `pick=0` lato Worker;
- Ticket;
- Turnstile;
- audit;
- revoke;
- export;
- delete;
- validazione API.

Non confondere i due livelli.

---

# 6. Preview

Non creare subito una preview.

Prima:

1. inventario Git corrente;
2. verifica che i sei commit locali siano ancora la RC desiderata;
3. controlli automatici;
4. identifica quali controlli reali possono essere eseguiti senza deploy;
5. identifica se serve un deploy Worker separato e con quale rischio;
6. presenta il piano.

Dopo approvazione verrà creata **una sola nuova Pages preview completa**.

Non fare preview parziali.

---

# 7. Beta tester

Preparare una checklist semplice per 3–5 tester.

## Sito
- Home IT/EN;
- Download;
- Meta;
- Draft;
- Account;
- storico;
- ticket;
- mobile;
- browser diversi.

## Segnalazione bug
Richiedere:
- browser/dispositivo;
- pagina;
- azione;
- atteso;
- osservato;
- screenshot;
- riproducibile sì/no.

Non coinvolgere i tester nella complessità R1/R2.

---

# 8. Vincoli Research

R1 e R2 sono chiusi lato client.

Qui:

- non iniziare R3;
- non implementare ingestion Research;
- non creare packet v3;
- non modificare consenso Research;
- non creare migrazioni D1 Research;
- non assumere decisioni sul formato `deck + _deck_sideboard`.

`R3-PREP-SCHEMA-STORAGE.md` resta proposta/documentazione.

Il punto `R2 deck + _deck_sideboard ↔ games[].deck` resta esplicitamente congelato fino al gate **R2 ↔ R3-PREP** e non deve essere risolto dentro R0.

---

# 9. Prima consegna richiesta

Prima di modificare codice o fare deploy, consegna un piano breve con:

- stato Git reale;
- HEAD;
- commit locali;
- worktree;
- cosa è già certificato;
- cosa resta manuale;
- cosa richiede Pages;
- cosa richiede Worker;
- eventuali blocker;
- ordine proposto per chiudere R0.

Non fare push/deploy finché non ricevi approvazione.

A fine blocco produrre un handoff Markdown con:

1. baseline;
2. modifiche;
3. test;
4. controlli manuali;
5. esiti;
6. rischi;
7. commit;
8. stato R0;
9. prossimo passo proposto.
