const CHIAVE_SESSIONE_PREVIEW = "mox-preview-session";

export function sessioneAccountPreview() {
  const frammento = new URLSearchParams(location.hash.slice(1));
  const dalRitorno = frammento.get("mox_session");
  if (dalRitorno && /^[0-9a-f]{64}$/i.test(dalRitorno)) {
    sessionStorage.setItem(CHIAVE_SESSIONE_PREVIEW, dalRitorno);
    history.replaceState(null, "", `${location.pathname}${location.search}`);
  }
  return sessionStorage.getItem(CHIAVE_SESSIONE_PREVIEW) || "";
}

export function intestazioniSessioneAccount(intestazioni = {}) {
  const token = sessioneAccountPreview();
  return {
    accept: "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...intestazioni,
  };
}

export function eliminaSessioneAccountPreview() {
  sessionStorage.removeItem(CHIAVE_SESSIONE_PREVIEW);
}
