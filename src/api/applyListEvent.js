// Applique un évènement WebSocket "<chose>.created|updated|deleted" (voir
// globalStore.js) à une liste locale déjà chargée via l'API REST — ajoute,
// remplace ou retire l'élément par id, sans exiger un rechargement de page.
// Idempotent vis-à-vis de l'auteur de l'action : si l'élément est déjà dans
// la liste (mise à jour optimiste faite par le composant qui a soumis
// l'action), on le remplace au lieu de le dupliquer.
export function applyListEvent(liste, { type, data }) {
  if (type.endsWith(".deleted")) {
    return liste.filter((item) => item.id !== data.id);
  }
  const existe = liste.some((item) => item.id === data.id);
  return existe
    ? liste.map((item) => (item.id === data.id ? { ...item, ...data } : item))
    : [...liste, data];
}
