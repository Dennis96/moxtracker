import { preparaDownloadLatest } from "./download.js";

// La Home presenta MOX e non carica più il Meta: le serve soltanto il
// download, che risolve sempre lo ZIP della GitHub Release Latest.
preparaDownloadLatest();
