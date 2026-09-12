// Raccourci clavier "Entrée = valider" pour les formulaires du projet qui ne
// sont PAS de vraies balises <form onSubmit={...}> (la majorité ici : un
// simple conteneur + un bouton type="button" onClick={...}) — Entrée n'y
// déclenche donc rien nativement. À poser en onKeyDown sur le conteneur du
// formulaire (pas sur chaque champ individuellement), avec la fonction de
// soumission à appeler.
//
// Ignore volontairement :
// - Entrée dans un <textarea> (retour à la ligne attendu, jamais un submit) ;
// - Entrée combinée à Maj/Ctrl/Alt/Cmd (laisse la main à un éventuel autre
//   raccourci clavier ailleurs) ;
// - un clic "Entrée" sur un <button>/<a> déjà focus (le navigateur active
//   déjà l'élément lui-même dans ce cas — l'intercepter en plus déclencherait
//   la soumission EN PLUS de l'action du bouton, ex: double-clic involontaire
//   sur "afficher/masquer le mot de passe").
export function soumettreSurEntree(soumettre, { actif = true } = {}) {
  return (e) => {
    if (!actif) return;
    if (e.key !== "Enter") return;
    if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
    const tag = e.target.tagName;
    if (tag === "TEXTAREA" || tag === "BUTTON" || tag === "A") return;
    e.preventDefault();
    soumettre();
  };
}
