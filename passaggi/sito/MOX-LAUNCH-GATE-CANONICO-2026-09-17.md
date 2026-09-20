# MOX — LAUNCH GATE CANONICO
Data: 2026-09-17
Stato: DRAFT PER APPROVAZIONE

## Obiettivo
Definire il gate unico che deve risultare PASS prima di promuovere MOX in modo ampio su Reddit, forum, Discord e community.

## Principio
Ogni funzione pubblicata sul sito deve essere classificata come:
- DISPONIBILE ORA
- IN SVILUPPO
- PIANIFICATA

Nessuna funzione presente soltanto su branch, mockup, roadmap o ricerca interna può essere presentata come disponibile.

## L0 — Baseline e candidato di lancio
PASS se:
- esiste un branch/candidato di lancio identificato;
- la preview verificata corrisponde a uno SHA noto;
- produzione e preview sono distinguibili;
- nessun lavoro S1/S2/S3 o Research viene implicitamente dichiarato live se non lo è.

FAIL se la preview punta a un vecchio redesign, non è riconducibile a uno SHA o descrive funzioni non presenti.

## L1 — Versione e stato funzioni
PASS se Home, Download, Meta, Draft, Account, Supporto, Privacy, Cosa invia MOX e Note di versione sono coerenti con la release candidata.

Research:
- partecipazione/raccolta opt-in = DISPONIBILE, se realmente presente;
- risultati/analisi MOX Research = IN SVILUPPO finché non sono pubblici.

## L2 — Privacy e trasparenza
PASS se:
- Privacy è aggiornata alla release candidata;
- Research è documentato se presente;
- consenso, revoca e cancellazione sono corretti;
- “Cosa invia MOX” copre tutti i flussi reali;
- account facoltativo e dati locali/remoti sono distinti;
- è presente il contatto privacy promesso prima del lancio;
- export/cancellazione sono verificati.

Per un lancio ampio UE: review privacy dedicata separata dal copy review.

## L3 — Release notes e aggiornamenti
PASS se:
- la release candidata ha una voce pubblica vera;
- Home mostra release corrente + ultimo aggiornamento;
- le Note di versione sono la cronologia;
- Home non diventa un changelog tecnico;
- sigle interne S1/S2/S3 non sono esposte al pubblico.

## L4 — Home: comprensione e differenziazione
Un nuovo visitatore deve capire in 30–60 secondi:
1. cos’è MOX;
2. cosa può fare oggi;
3. perché il progetto esiste;
4. quali principi lo differenziano;
5. dove sta andando;
6. cosa è ancora in sviluppo.

Riga fiducia candidata:
`Standalone Windows · Nessun account per iniziare · Consensi separati · Campioni dichiarati`

Non usare claim come “il migliore”, “il più completo”, “unico”.

## L5 — Goal pubblici e roadmap
Usare solo stati:
- DISPONIBILE
- IN SVILUPPO
- PIANIFICATO

Non esporre S1/S2/S3, branch o dettagli tecnici interni.

Famiglie candidate:
- MOX Research;
- Draft Assistant Next Gen;
- nuova esperienza desktop/Tauri;
- Meta/Brew;
- collection gap / wildcards;
- buildable decks;
- deck sharing.

## L6 — SEO e social
Produzione:
- title/description;
- canonical;
- Open Graph;
- Twitter/X card;
- sitemap.xml;
- hreflang IT/EN;
- favicon;
- share image ~1200×630;
- indicizzabile.

Preview:
- noindex;
- non canonica.

## L7 — Clean install Windows
Provare su PC/VM pulito:
1. Download;
2. ZIP;
3. estrazione;
4. avvio;
5. SmartScreen/Smart App Control;
6. prima configurazione;
7. rilevamento Arena;
8. prima sessione;
9. strumenti principali;
10. riavvio;
11. account opzionale;
12. export/cancellazione;
13. disinstallazione/rimozione.

Se compare un warning, documentarlo esattamente.

## L8 — Test sito
Desktop:
- Chrome
- Edge

Mobile:
- viewport smartphone reale/emulato

Lingue:
- IT
- EN

Pagine:
Home, Download, Meta, archetipo/variante, Draft, Account, Supporto, Privacy, Cosa invia MOX, Note di versione.

Stati:
loading, zero-data, errore API, link, download, navigazione, modali, form, keyboard navigation di base, immagini, overflow/layout.

## L9 — Supporto e feedback loop
Percorso:
scoperta → sito → download → installazione → prova → supporto/feedback → bug/ticket → aggiornamento → comunicazione update.

Verificare canali bug/suggerimenti, privacy allegati/log e link.

## L10 — Materiali di lancio
Prima del primo post ampio:
- screenshot reali aggiornati;
- share image;
- descrizione MOX in una frase;
- descrizione breve;
- lista “Disponibile oggi”;
- lista “In sviluppo”;
- privacy/trust summary;
- link sito/download/supporto;
- known issues essenziali.

Video/GIF: utili ma non blocker assoluto.

## L11 — Community readiness
Per ogni community:
- regole correnti;
- self-promotion;
- flair;
- link;
- AI disclosure se richiesta;
- modmail se utile;
- messaggio adattato;
- domande feedback concrete.

Ordine candidato:
1. piccola community italiana;
2. r/MagicArena se autorizzata;
3. MTG Salvation;
4. r/magicTCG con disclosure;
5. altri Discord/forum;
6. r/spikes solo quando Research produce contenuto metodologicamente interessante.

## L12 — Metriche minime
Non aggiungere tracking invasivo.

Metriche candidate:
- download GitHub;
- ticket/feedback;
- contributi aggregati già consentiti;
- utenti attivi solo se definibili privacy-safe.

Goal candidato: 100 tester/utenti realmente utili, ma non pubblicarlo finché “utente attivo” non è definito.

## PASS FINALE
READY soltanto se:
- L0–L11 PASS o PASS WITH CONDITIONS non bloccanti;
- privacy senza blocker;
- nuova preview launch candidate;
- clean install verificato;
- IT/EN coerenti;
- download corretto;
- nessuna funzione futura venduta come disponibile.

## Stop condition
Stop per:
- mismatch sito/release;
- privacy incompleta;
- preview senza SHA;
- installazione Windows bloccata;
- download errato;
- regressione funzionale;
- funzione futura presentata come disponibile;
- regole community incompatibili.
