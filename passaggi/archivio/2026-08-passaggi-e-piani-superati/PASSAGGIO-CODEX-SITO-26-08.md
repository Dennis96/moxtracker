# Passaggio a Codex — il sito, dopo la 2.9.23

> Scritto il **26/08/2026**, subito dopo la pubblicazione di Mox 2 beta 2.9.23.
> Serve a chi riprende il **sito**: cosa è cambiato sotto, cosa tocca davvero
> le pagine, e cosa aspetta un via libera che non è ancora arrivato.
> Per lo stato corrente del server vale sempre [LEGGIMI.md](LEGGIMI.md).

## Il via libera che manca

L'utente gioca **un Draft vero oggi a pranzo** con la 2.9.23. È il collaudo sul
campo che manca da quattro versioni, e riguarda proprio le parti corrette oggi:
i consigli sui pick e il mazzo finale. **Finché non arriva quel riscontro, il
lavoro sul sito non parte.** Se va bene, si comincia; se salta fuori qualcosa,
la priorità torna al Draft.

Non è prudenza generica: la 2.9.23 è stata pubblicata *prima* del Draft per
decisione esplicita dell'utente, quindi gli amici hanno già la build nuova.

## Cosa è cambiato oggi, in due righe

**Mox 2.9.23** chiude quattro difetti visti nei Draft veri del 25–26/08: le
terre duali comuni scambiate per terre base (in Arena hanno la stessa rarità
delle Paludi), un Draft nuovo che ereditava il precedente, «chiudi draft» che
azzerava le carte ma non l'identità, e le statistiche 17lands assenti nella
riserva del deck builder. Dettaglio in
[`Codice\MOX-2.9.23-STATO.md`](../Codice/MOX-2.9.23-STATO.md).

**Il Worker** (versione `face6463-912c-452e-a1c3-29aa8bf44e96`) ha due novità:
il canale `canary` di `/mox/release` e la colonna `sospetto` sulle tracce
Draft. La migrazione è già applicata al database vero.

## Cosa tocca il sito

**1. Il pulsante di download: già a posto, ma sappilo.**
`sito/js/config.js` e i due `<a data-download>` di `index.html` puntano a
`releases/latest/download/Mox-Windows-beta.zip`, che è un nome stabile: la
release `mox-v2-beta2.9.23` è pubblicata con quell'asset e il file è stato
riscaricato e confrontato — **identico byte per byte** alla build locale
(SHA-256 `27c2e260…`). Non serve toccare niente; serve sapere che il pulsante
ora dà la 2.9.23.

**2. `/draft/statistiche` ha un campo nuovo: `tracce_marcate`.**
`sito/js/draft.js` legge già `fasi`, `accordo_mox` e `campione`. Da oggi la
risposta porta anche il numero di tracce tenute **fuori** dalla misura perché
incoerenti — un Draft dichiarato completo a metà, o un pool più grande delle
scelte registrate. Due conseguenze:

- i numeri di `fasi` adesso escludono quelle tracce: sono più puliti di ieri,
  e se il campione mostrato cala un po' è per questo, non per un errore;
- se decidi di mostrare `tracce_marcate`, va detto **cosa significa**, non solo
  il numero. È un dato tecnico: dice che un client ha mandato qualcosa di
  incoerente, non che l'utente abbia fatto qualcosa di sbagliato. Nel dubbio,
  lasciarlo fuori dalle pagine pubbliche è la scelta giusta.

**3. Il canale canary non riguarda il sito.** Serve a provare una release su
una macchina sola prima che vada a tutti; il download del sito resta sempre
l'asset stabile di GitHub. Le due strade erano già separate e restano separate.

## Le decisioni di prodotto già prese, da non riaprire

- **il sito viene prima del lancio**: è la scelta del piano V3, e il
  costruttore/meta è stato accantonato dal programma per portarlo qui;
- **sul sito vanno i mazzi attuali dell'utente, non la sua collezione**. È una
  funzione nuova e ha bisogno di un consenso esplicito, con lo stesso metodo
  usato per il Draft: spento di partenza, acceso da un sì dell'utente;
- **la matrice degli scontri** («contro archetipi») è stata tolta dal
  programma il 18/08 perché con una o due partite per archetipo mostrava 100%
  e 0%. Il calcolo esiste ancora in `riepilogo()` sotto la chiave «archetipi»:
  sarà il sito a farne una matrice **quando le partite saranno abbastanza**, e
  la soglia va dichiarata sulla pagina.

## Confini

- **`Codice\`**: il ramo `claude/draft-difetti-2923` è pubblicato ma **non
  ancora fuso** in `v2-grafica`, e nemmeno `codex/draft-chiusura-2919` lo è.
  Chi fonde rifà l'EXE, sempre: l'utente apre `Mox.exe`, non i sorgenti.
- **`moxtracker\`**: il ramo `codex/draft-recupero-2920` è pubblicato su GitHub
  e deployato, ma non fuso in `main`.
- `LAVORI.md` non ha righe attive sul Draft: i file sono liberi. Chi prende un
  lavoro apre la sua riga prima di toccarli.
- Il materiale in `Non pubblicare\` non entra mai in Git, e i log dei
  diagnostici degli amici nemmeno: in `Codice\prove\fixtures-log\` ci sono solo
  estratti anonimi, prodotti da `replay_draft.py --estrai`, che **copia una
  lista bianca** di campi invece di togliere quelli privati.

## Come si collauda quello che tocchi

```bash
npm run prove              # 142 prove del Worker, nessuna rete
npm run sito-locale        # anteprima del sito
```

Sul lato Mox, se il tuo lavoro tocca il Draft:

```powershell
& "$env:LOCALAPPDATA\Mox\Python\python.exe" strumenti\prove.py
& "$env:LOCALAPPDATA\Mox\Python\python.exe" strumenti\fuzz_draft.py --quante 400
```

E prima di pubblicare qualunque cosa lato Mox, il cancello:
`strumenti\pubblica_release.py` rifiuta senza prove verdi, EXE aggiornato e
collaudo dell'aggiornamento fresco. Non ha un flag per aggirarlo, ed è voluto.

## Cosa resta aperto sul Draft, se te lo chiedono

Il **confronto automatico con MTGA Draft Tool** non è stato fatto. Il P1P1 del
Draft dell'utente — Mox mette La Montagna Solitaria (1.191 partite) davanti a
Dori (6.380), l'altro programma fa il contrario — resta una divergenza **senza
spiegazione dimostrata**: l'ipotesi del campione piccolo è stata misurata e
scartata, perché col limite di Wilson il divario si dimezza ma non si ribalta.
Serve un banco che confronti i due programmi su molti Draft, non a occhio.
