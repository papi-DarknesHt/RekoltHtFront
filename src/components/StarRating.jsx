import { Star } from "lucide-react";

// affichage en lecture seule d'une note moyenne (1-5) — chaque étoile est
// remplie proportionnellement à l'écart avec la moyenne réelle (ex: 3.4
// remplit la 4e étoile à 40%), donc le rendu suit fidèlement la moyenne
// calculée côté backend plutôt que d'arrondir à l'étoile pleine la plus
// proche — pas de sélection ici, voir le sélecteur cliquable inline dans
// DetailProduit.jsx pour poser un avis
export default function StarRating({ note, taille = 13 }) {
  const valeur = Math.max(0, Math.min(5, note || 0));
  return (
    <span className="star-rating" aria-label={`${note}/5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const remplissage = Math.round(Math.max(0, Math.min(1, valeur - (n - 1))) * 100);
        return (
          <span key={n} className="star-rating__etoile" style={{ width: taille, height: taille }}>
            <Star size={taille} strokeWidth={1.5} className="star-rating__vide" />
            <span className="star-rating__remplissage" style={{ width: `${remplissage}%` }}>
              <Star size={taille} strokeWidth={1.5} fill="currentColor" className="star-rating__pleine" />
            </span>
          </span>
        );
      })}
    </span>
  );
}
