# S3-B0 — PREFLIGHT FONTI — 17 settembre 2026

**Stato:** `COMPLETATO`  
**Scope:** solo verifica accesso/condizioni delle fonti whitelist S3. Nessuna analisi dei 3 candidati Brew, nessuna decklist raccolta, nessuna decisione A/B/C/D, nessuna modifica al catalogo.

## Baseline

- repository: `Dennis96/moxtracker`
- branch: `chatgpt/s3-meta-catalog-refresh-2026-09-17`
- HEAD remoto iniziale verificato: `bd3670f5f8b4509c52cff4cec905fb0bc2283490`
- `Dennis96/mox-core` invariato sul branch S3 a `c8079dc40c1325c1314d9f283226ab3be10db21d`

## Regola conservativa applicata

Per questo checkpoint una fonte viene considerata utilizzabile soltanto se il canale di consultazione necessario e' chiaramente compatibile con robots.txt e con le condizioni pubblicamente rilevanti. Nessun blocco viene aggirato; nessun User-Agent viene alterato; non vengono usati mirror, cache o proxy per recuperare contenuti non accessibili direttamente.

Se robots.txt non e' verificabile direttamente dal runtime senza ricorrere a un canale alternativo, la fonte viene classificata `NON UTILIZZABILE` per i checkpoint S3 successivi, anche quando singole pagine pubbliche risultano indicizzate dai motori di ricerca.

## Matrice fonti

| Fonte | Verifica | Stato S3 | Modalita' consentite / limiti | Motivo sintetico |
| --- | --- | --- | --- | --- |
| `magic.wizards.com` | 2026-09-17 | `CONSENTITA CON LIMITI` | Consultazione puntuale di pagine pubbliche e risultati di ricerca ordinari; nessun crawling, enumerazione, estrazione massiva, script o scraping. | `robots.txt` e' verificabile e non contiene `Disallow` per `User-agent: *`, ma i General Terms Wizards vietano data mining/scraping tramite agenti, robot, script o spider non autorizzati. |
| `mtgaassistant.net` | 2026-09-17 | `NON UTILIZZABILE` | Nessun uso in S3-B1/B2/B3 finche' robots.txt non e' verificabile direttamente tramite un canale conforme. | Pagine pubbliche e Privacy Policy sono consultabili, ma il runtime non espone direttamente `robots.txt`; inoltre il sito dichiara che il contenuto originale non puo' essere usato o riprodotto senza consenso. Con dubbio residuo, applicata la stop rule conservativa. |
| `aetherhub.com` | 2026-09-17 | `NON UTILIZZABILE` | Nessun uso in S3-B1/B2/B3 finche' robots.txt non e' verificabile direttamente tramite un canale conforme. | Terms e Privacy sono pubbliche e vietano comportamenti che interferiscano/sovraccarichino il servizio, ma il runtime non consente una verifica diretta del robots.txt senza passaggi alternativi. La fonte resta quindi dubbia e viene esclusa. |
| `mtgdecks.net` | 2026-09-17 | `NON UTILIZZABILE` | Nessun uso in S3-B1/B2/B3 finche' robots.txt non e' verificabile direttamente tramite un canale conforme. | Terms pubbliche limitano i contenuti a uso personale/non commerciale e vietano riproduzione/distribuzione oltre le eccezioni indicate; il robots.txt non e' verificabile direttamente dal runtime senza canali alternativi. La fonte viene esclusa per prudenza. |

## Evidenze pubbliche controllate

### magic.wizards.com / Wizards

- `https://magic.wizards.com/robots.txt`: `User-agent: *`; nessuna direttiva `Disallow`; presenti soltanto sitemap.
- General Terms Wizards, ultimo aggiornamento indicato `2025-12-10`: la sezione 2.2 vieta data mining e data scraping tramite mezzi non autorizzati, inclusi agenti, robot, script e spider.

Conseguenza S3: la fonte puo' essere usata solo come fonte ufficiale puntuale, senza automatizzare raccolta o navigazione sistematica.

### mtgaassistant.net

- Privacy Policy pubblica, ultimo aggiornamento indicato `2022-11-07`.
- Il footer pubblico dichiara nel 2026 che il contenuto originale non puo' essere usato o riprodotto senza consenso.
- La richiesta diretta al robots.txt non e' stata resa disponibile dal runtime web; nessun metodo alternativo e' stato usato per superare questo limite.

Conseguenza S3: `NON UTILIZZABILE` finche' la verifica robots non possa essere fatta direttamente e senza aggiramenti.

### aetherhub.com

- Terms and Conditions pubbliche, ultimo aggiornamento indicato `2017-09-03`.
- Privacy Policy pubblica, ultimo aggiornamento indicato `2025-03-18`.
- Le Terms vietano azioni che interferiscano o possano interferire con il funzionamento del sito, incluse attivita' di flooding/overload.
- La richiesta diretta al robots.txt non e' stata resa disponibile dal runtime web; nessun metodo alternativo e' stato usato.

Conseguenza S3: `NON UTILIZZABILE` per questo percorso operativo.

### mtgdecks.net

- Terms of Use pubbliche, versione indicata `2020-11-09`.
- Le Terms dichiarano sito e contenuti destinati a uso personale/non commerciale e limitano riproduzione, pubblicazione, distribuzione, modifica e sfruttamento dei contenuti.
- La richiesta diretta al robots.txt non e' stata resa disponibile dal runtime web; nessun metodo alternativo e' stato usato.

Conseguenza S3: `NON UTILIZZABILE` per questo percorso operativo.

## Fonti disponibili per S3-B1/B2/B3

Alla chiusura di S3-B0:

- utilizzabile con limiti: `magic.wizards.com`;
- escluse per dubbio/accesso non verificabile: `mtgaassistant.net`, `aetherhub.com`, `mtgdecks.net`.

S3-B1/B2/B3 dovranno quindi usare soltanto evidenza Wizards accessibile in modo puntuale e conforme. Se tale evidenza non e' sufficiente per una decisione A/B/C/D, il candidato deve restare non deciso: non e' autorizzato compensare la mancanza di fonti usando mirror, cache, scraping, User-Agent alternativi o fonti fuori whitelist.

## Controlli documentali

- nessun fingerprint o decklist candidato inserito;
- nessun identificativo privato inserito;
- nessuna ricerca Meta generale eseguita;
- nessuna decisione A/B/C/D assegnata;
- nessun file `mox-core` modificato;
- nessun codice o test applicativo modificato.

## Operazioni vietate

- merge: **NO**
- deploy: **NO**
- D1 remoto: **NO**
- produzione: **NO**
- modifica `mox-core/meta/standard.json`: **NO**
