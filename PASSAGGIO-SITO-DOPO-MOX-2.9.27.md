# Passaggio sito dopo Mox 2.9.27

Data: **28/08/2026**.

Da leggere prima di riprendere il sito, insieme a
`PASSAGGIO-A-CLAUDE-SITO-BETA-2026-08-27.md`.

## Cosa è stato pubblicato

Mox **v2 beta 2.9.27** è online su canary, stable e GitHub. Corregge A111:
Arena può riusare sia il nome dell'evento sia il `draftId` fra due Draft
consecutivi, soprattutto PickTwo. Prima il secondo Draft poteva arrivare al
client senza set/formato, senza dati 17Lands e senza traccia inviabile.

Il client ora:

- riconosce l'ingresso strutturale nel nuovo tavolo anche quando `EventJoin`
  non ha etichetta nel Player.log;
- prepara set e formato prima del primo pacchetto;
- usa l'UUID di sessione locale insieme all'impronta Arena per separare le
  tracce, quindi due Draft con lo stesso `draftId` non condividono più il file;
- conserva il protocollo del pacchetto Draft già accettato dal Worker: non ci
  sono schema, migrazioni D1 o cambi API da applicare lato sito.

La correzione è coperta da 512 sequenze automatiche di tre Draft, comprese
ripetizioni, transizioni fra forme riconosciute e un evento speciale; canary,
stable e GitHub sono stati riscaricati e confrontati.

## Cosa è cambiato online lato sito

Solo la distribuzione dell'app Mox:

- l'oggetto R2 `moxtracker-releases/Mox-Installer-win-x64.exe` è ora
  l'installer 2.9.27;
- i secret Worker `MOX_RELEASE_MANIFEST_CANARY` e
  `MOX_RELEASE_MANIFEST` contengono i manifesti firmati 2.9.27;
- è pubblicata la release GitHub
  `mox-v2-beta2.9.27` con lo ZIP completo.

Nessun file del Worker è stato modificato o distribuito, nessuna migrazione D1
è stata eseguita, nessun dato Draft/R2 privato è stato letto o cambiato e Pages
non è stato pubblicato.

Impronte verificate:

- installer: `cd3c558d1e73678b34557157b93b8bb97070917bb0d1fee3561df690a27fef6e`
  (68.548.557 byte);
- ZIP GitHub: `4c3afd7510c957c182ce488c2591fa6a0add6a76b506d629860976fed1b9f224`.

## Dato storico da non alterare

Il PickTwo che ha scoperto A111 **non è stato retroinviato**. La sua vecchia
traccia era già finalizzata e le nuove scelte non vi erano mai finite: non si
deve ricostruire né spedire un Draft inventando dati. Il Player.log conserva
la sequenza reale; un eventuale recupero richiede uno strumento dedicato che
ricostruisca il pacchetto completo e superi gli stessi controlli del Worker.

## Cosa serve dal collaudo degli amici

I Draft reali con 2.9.27 servono a confermare, senza bloccare il sito:

1. qualunque evento Draft, anche speciale, mostra subito set, modalità e dati;
2. due Draft consecutivi uguali e due diversi restano separati;
3. al termine ogni Draft appare nel flusso normale del sito senza rifiuti;
4. se compare un rifiuto, conservare il rapporto diagnostico e non ritentare
   modificando manualmente la traccia.

Prima di toccare il sito, verificare eventuali segnalazioni contro questo
contratto. Non dedurre da un dato incompleto che la 2.9.27 abbia cambiato il
protocollo: non lo ha fatto.

## Limiti operativi per la prossima chat

- Il sito resta nel suo stato di preview descritto nel passaggio del 27/08.
- Non pubblicare Pages, non fare migrazioni D1, non cancellare oggetti R2 e
  non toccare account/ticket senza una nuova autorizzazione dell'utente.
- La cartella `build/` non tracciata nella worktree del sito è materiale locale
  preesistente: non eliminarla né aggiungerla a Git.
