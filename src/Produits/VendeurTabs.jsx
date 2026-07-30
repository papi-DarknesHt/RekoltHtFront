import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Package } from "lucide-react";
import { useTranslation } from "../assets/Translate/i18n.jsx";
import "../assets/CSS/VendeurTabs.css";

// Onglets partagés entre TableauDeBordVendeur.jsx et mesProduits.jsx — les
// deux restent des routes distinctes (URL, bouton précédent) mais se
// présentent visuellement comme un seul tableau de bord vendeur à onglets.
export default function VendeurTabs() {
  const { t } = useTranslation();
  const location = useLocation();

  const onglets = [
    { to: "/produits/tableau-de-bord", label: t("dashboard.tabOverview"), Icone: LayoutDashboard },
    { to: "/produits/mesProduits", label: t("dashboard.tabMyProducts"), Icone: Package },
  ];

  return (
    <nav className="vtabs">
      {onglets.map(({ to, label, Icone }) => (
        <Link
          key={to}
          to={to}
          className={`vtabs__onglet ${location.pathname === to ? "vtabs__onglet--actif" : ""}`}
        >
          <Icone size={16} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
