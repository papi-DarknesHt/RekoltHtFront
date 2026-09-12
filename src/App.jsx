

import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { useGlobalSocket } from "./api/useGlobalSocket.js";
import { useInactivityTimeout } from "./hooks/useInactivityTimeout.js";
import TestPage from "./testpage.jsx";
import RekoltHtAuth from "./Registration/Authentification.jsx";
import ActiverCompte from "./Registration/ActiverCompte.jsx";
import HomePage from "./Acceuil/HomePage.jsx";
import RoutePrivee from "./components/RoutePrivee";
import NavBar from "./components/NavBar";
import ProfilAcheteur from "./Profil/ProfilAcheteur.jsx";
import { TranslationProvider } from "./assets/Translate/i18n.jsx";
import ModifierProfil from "./Profil/ModifierProfil.jsx";
import DevenirVendeur from "./Registration/DevenirVendeur.jsx";
import AjouterProduit from "./Produits/AjouterProduit.jsx";
import ModifierProduit from "./Produits/modifierProduits.jsx";
import Produits from "./Produits/afficherProduits.jsx";
import DetailProduit from "./Produits/DetailProduit.jsx";
import ProfilVendeur from "./Produits/ProfilVendeur.jsx";
import TableauDeBordVendeur from "./Produits/TableauDeBordVendeur.jsx";
import SuprimerProduit from "./Produits/suprimerProduit.jsx"
import copy from "./components/copy.jsx"
import Aide from "./pages/aide.jsx"
import ContacterNous from "./pages/ContacterNous.jsx";
import QuiSommesNous from "./pages/QuiSommesNous.jsx";
import PolitiqueUtilisation from "./pages/PolitiqueUtilisation.jsx";
import NotFound from "./pages/NotFound.jsx";
import ChatbotVendeur from "./components/ChatbotVendeur.jsx";
import NotificationsPermission from "./components/NotificationsPermission.jsx";
import ConfirmModal from "./components/ConfirmModal.jsx";
import RaisonModal from "./components/RaisonModal.jsx";
import AlertModal from "./components/AlertModal.jsx";
import ForcerChangementMotDePasse from "./components/ForcerChangementMotDePasse.jsx";
import AdminDashboard from "./Admin/AdminDashboard.jsx";
import Messagerie from "./Messagerie/Messagerie.jsx";
import ContacterAdmin from "./Support/ContacterAdmin.jsx";
import DemandeAdministrative from "./Support/DemandeAdministrative.jsx";
function AppContent() {
  useGlobalSocket();
  useInactivityTimeout();
  const location = useLocation();

  // React Router (comme tout routeur côté client) ne réinitialise jamais le
  // scroll tout seul en changeant de page — sans ça, cliquer un lien du
  // footer alors qu'on a déjà défilé vers le bas laisse la nouvelle page
  // affichée au milieu de son contenu au lieu de son en-tête (demande
  // explicite). Un vrai changement de page (nouveau pathname) doit toujours
  // ramener en haut — pas déclenché sur un changement de ?query/#hash seul,
  // pour ne pas casser un futur lien d'ancrage.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <>
      {/* <NavBar /> */}
      {/* masquée sur /messages : la bulle de conseils flottante (pas un vrai
          chat, voir ChatbotVendeur.jsx) chevauche le bouton d'envoi de la
          vraie messagerie et n'a plus de raison d'être sur cette page */}
      {location.pathname !== "/messages" && <ChatbotVendeur />}
      <NotificationsPermission />
      <ConfirmModal />
      <RaisonModal />
      <AlertModal />
      <ForcerChangementMotDePasse />
      <Routes>
        <Route path="/" element={<HomePage />} />
        {/* <Route path="/test" element={<TestPage />} /> */}
        <Route path="/auth" element={<RekoltHtAuth />} />
        {/* publique — ouverte depuis le lien reçu par email (voir sinscrire,
            Registration/views.py), l'utilisateur n'est pas encore connecté */}
        <Route path="/activer-compte" element={<ActiverCompte />} />
        <Route path="/profil" element={<RoutePrivee><ProfilAcheteur /></RoutePrivee>} />
        <Route path="/update_profil" element={<RoutePrivee><ModifierProfil/></RoutePrivee>}/>
        <Route path="/Devenir_Vendeur" element={<RoutePrivee><DevenirVendeur/></RoutePrivee>}/>
        {/* réservé aux vendeurs (demande explicite : un acheteur ne doit pas
            accéder à un tableau de bord vendeur même en connaissant l'URL) —
            creerProduit (backend) refuse déjà tout compte non-vendeur, ce
            garde évite juste d'afficher la page côté client dans ce cas */}
        <Route path="/produits/ajouter" element={<RoutePrivee rolesAutorises={["vendeur"]}><AjouterProduit/></RoutePrivee>}/>
        {/* publique, comme la home page et le détail produit : un visiteur
            non connecté doit pouvoir consulter le catalogue (voir
            Produits/views/produitsViews.py::listerProduits, accès public) */}
        <Route path="/produits" element={<Produits/>}/>
        {/* publique, comme la home page : le détail d'un produit est
            consultable sans compte (voir Produits/views/produitsViews.py::detailProduit) */}
        <Route path="/produits/detail" element={<DetailProduit/>}/>
        {/* réservé aux connectés (demande explicite) — infoVendeur (backend,
            Produits/views/produitsViews.py) exige désormais un token, ce
            garde évite juste un aller-retour réseau suivi d'un 401 */}
        <Route path="/vendeur/detail" element={<RoutePrivee><ProfilVendeur/></RoutePrivee>}/>
        <Route path="/produits/modifier" element={<RoutePrivee rolesAutorises={["vendeur"]}><ModifierProduit/></RoutePrivee>}/>
        {/* "Mes produits" est désormais un onglet intégré au tableau de bord
            (voir TableauDeBordVendeur.jsx) — cette route ne survit que pour
            les liens/redirections existants (AjouterProduit.jsx,
            modifierProduits.jsx, HomePage.jsx) qui y renvoyaient encore */}
        <Route path="/produits/mesProduits" element={<Navigate to="/produits/tableau-de-bord?tab=produits" replace />}/>
        {/* le tableau de bord vendeur lui-même — exemple explicite : un
            acheteur qui connaît cette URL ne doit pas pouvoir l'atteindre */}
        <Route path="/produits/tableau-de-bord" element={<RoutePrivee rolesAutorises={["vendeur"]}><TableauDeBordVendeur/></RoutePrivee>}/>
        <Route path="/produits/suprimerProduits" element={<RoutePrivee rolesAutorises={["vendeur"]}><SuprimerProduit/></RoutePrivee>}/>
        {/* publique : un visiteur non connecté doit pouvoir consulter l'aide */}
        <Route path="/aide" element={<Aide/>}/>
        {/* publique : n'importe qui doit pouvoir contacter l'équipe RekoltHt */}
        <Route path="/contact" element={<ContacterNous/>}/>
        {/* publique : page de présentation, accessible sans connexion */}
        <Route path="/qui-sommes-nous" element={<QuiSommesNous/>}/>
        {/* publique : n'importe qui doit pouvoir consulter les conditions d'utilisation */}
        <Route path="/politique-utilisation" element={<PolitiqueUtilisation/>}/>
        {/* tableau de bord admin — même garde par rôle que le tableau de bord
            vendeur ci-dessus (demande explicite) */}
        <Route path="/admin/dashboard" element={<RoutePrivee rolesAutorises={["admin"]}><AdminDashboard/></RoutePrivee>}/>
        <Route path="/messages" element={<RoutePrivee><Messagerie/></RoutePrivee>}/>
        <Route path="/contacter-admin" element={<RoutePrivee><ContacterAdmin/></RoutePrivee>}/>
        <Route path="/demande-administration" element={<RoutePrivee><DemandeAdministrative/></RoutePrivee>}/>
        <Route path="*" element={<NotFound />}/>
      </Routes>
    </>
  );

}

// export default App
export default function App() {
  return (
    <BrowserRouter>
      <TranslationProvider>
        <AppContent />
      </TranslationProvider>
    </BrowserRouter>
  );
}