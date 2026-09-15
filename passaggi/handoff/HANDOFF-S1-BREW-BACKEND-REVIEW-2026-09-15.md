# Handoff — review indipendente di S1-BREW-BACKEND

Branch `claude/s1-brew-backend-2026-09-15`, baseline `main` `75bcac4`. Il
contratto, le decisioni e i report stanno in
[S1-BREW-CONTRATTO-B1-2026-09-15.md](../sito/S1-BREW-CONTRATTO-B1-2026-09-15.md):
questo foglio dice soltanto cosa guardare. Non autorizza merge, deploy,
migrazioni remote o l'accensione di `BREW_GRUPPI`.

## File

- `src/brew-clustering.js`: firma per nome carta, distanza, piano a raggio.
  Puro.
- `src/brew-gruppi.js`: candidati, dry-run, apply in batch, cron,
  letture dei membri.
- `src/lettura.js`: `gruppi_brew` e `raggruppamento_brew` sulla riga Altro;
  campi legacy invariati.
- `src/dettaglio-archetipo.js`: `?id_brew=`, e `gruppo_brew_id` /
  `variante_brew_id` sul percorso `?impronta=`.
- `src/index.js`: cron, spento senza `BREW_GRUPPI = "on"`.
- `schema.sql` e `migrazioni/2026-09-15-brew-gruppi.sql`: blocco identico,
  additivo.
- `strumenti/brew_gruppi.mjs`: analisi, report k=3/4/5 e apply su SQLite
  locale.
- `prove/brew-*.test.js` e `prove/fixtures/brew-sintetici.js`.

## Da verificare con piu' attenzione

1. **Privacy:** candidata ai gruppi e' solo una lista con 30 partite totali
   nel formato. Un gruppo mostra solo varianti pubbliche nel filtro, e la
   distanza solo verso un rappresentante pubblico. Esiste un modo, con piu'
   richieste e filtri, di sapere qualcosa di una lista sotto soglia che oggi
   non si sappia gia'? (§8 del contratto, con i residui accettati.)
2. **Stabilita':** nessun UPDATE nel codice; batch unico con INSERT semplici;
   retry, concorrenza e limite coperti dalle prove. Il piano e' davvero
   indipendente dall'ordine e dallo spezzettamento in giri con `limite`?
3. **BO1/BO3:** identita' `(formato, algoritmo, impronta)` e conteggi per
   filtro (§6). E' accettabile che un main BO3 entro 4 carte da un BO1 stia
   nello stesso gruppo?
4. **k = 4:** giustificato da fixture e da un corpus pubblico piccolo (§5).
5. **Compatibilita':** campi legacy di `/meta` identici in 12 filtri; build
   del sito identica alla preview (`346ce2023c50e91c`).

## Come rifare le verifiche

```powershell
node --test prove/brew-clustering.test.js prove/brew-gruppi.test.js prove/brew-meta.test.js
npm run prove
npm run sito:build
node strumenti/brew_gruppi.mjs --help
```

La migrazione su D1 locale di Wrangler si rifa' solo con `--local
--persist-to <cartella temporanea>`, mai `--remote`.

## Condizioni gia' note

- La documentazione Cloudflare non cita i trigger su D1; su D1 locale
  funzionano. Da riverificare con la migrazione remota.
- I formati senza catalogo non unificano le stampe diverse; `?id_brew=`
  risponde 409 come `?impronta=`.
- S2/F1 (il sito che mostra i gruppi) e le famiglie Brew via catalogo restano
  fuori.
