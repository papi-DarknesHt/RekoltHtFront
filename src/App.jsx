

import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { useGlobalSocket } from "./api/useGlobalSocket.js";
import { useInactivityTimeout } from "./hooks/useInactivityTimeout.js";
import TestPage from "./testpage.jsx";
import RekoltHtAuth from "./Registration/Authentification.jsx";
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
import ConfirmModal from "./components/ConfirmModal.jsx";
import ForcerChangementMotDePasse from "./components/ForcerChangementMotDePasse.jsx";
import AdminDashboard from "./Admin/AdminDashboard.jsx";
import Messagerie from "./Messagerie/Messagerie.jsx";
import ContacterAdmin from "./Support/ContacterAdmin.jsx";
function AppContent() {
  useGlobalSocket();
  useInactivityTimeout();
  const location = useLocation();

  return (
    <>
      {/* <NavBar /> */}
      {/* masquée sur /messages : la bulle de conseils flottante (pas un vrai
          chat, voir ChatbotVendeur.jsx) chevauche le bouton d'envoi de la
          vraie messagerie et n'a plus de raison d'être sur cette page */}
      {location.pathname !== "/messages" && <ChatbotVendeur />}
      <ConfirmModal />
      <ForcerChangementMotDePasse />
      <Routes>
        <Route path="/" element={<HomePage />} />
        {/* <Route path="/test" element={<TestPage />} /> */}
        <Route path="/auth" element={<RekoltHtAuth />} />
        <Route path="/profil" element={<RoutePrivee><ProfilAcheteur /></RoutePrivee>} />
        <Route path="/update_profil" element={<RoutePrivee><ModifierProfil/></RoutePrivee>}/>
        <Route path="/Devenir_Vendeur" element={<RoutePrivee><DevenirVendeur/></RoutePrivee>}/>
        <Route path="/produits/ajouter" element={<RoutePrivee><AjouterProduit/></RoutePrivee>}/>
        {/* publique, comme la home page et le détail produit : un visiteur
            non connecté doit pouvoir consulter le catalogue (voir
            Produits/views/produitsViews.py::listerProduits, accès public) */}
        <Route path="/produits" element={<Produits/>}/>
        {/* publique, comme la home page : le détail d'un produit est
            consultable sans compte (voir Produits/views/produitsViews.py::detailProduit) */}
        <Route path="/produits/detail" element={<DetailProduit/>}/>
        {/* publique : le profil complet d'un vendeur (toutes ses offres) est
            consultable sans compte, même logique que /produits/detail (voir
            Produits/views/produitsViews.py::infoVendeur/listerProduits) */}
        <Route path="/vendeur/detail" element={<ProfilVendeur/>}/>
        <Route path="/produits/modifier" element={<RoutePrivee><ModifierProduit/></RoutePrivee>}/>
        {/* "Mes produits" est désormais un onglet intégré au tableau de bord
            (voir TableauDeBordVendeur.jsx) — cette route ne survit que pour
            les liens/redirections existants (AjouterProduit.jsx,
            modifierProduits.jsx, HomePage.jsx) qui y renvoyaient encore */}
        <Route path="/produits/mesProduits" element={<Navigate to="/produits/tableau-de-bord?tab=produits" replace />}/>
        <Route path="/produits/tableau-de-bord" element={<RoutePrivee><TableauDeBordVendeur/></RoutePrivee>}/>
        <Route path="/produits/suprimerProduits" element={<RoutePrivee><SuprimerProduit/></RoutePrivee>}/>
        {/* publique : un visiteur non connecté doit pouvoir consulter l'aide */}
        <Route path="/aide" element={<Aide/>}/>
        {/* publique : n'importe qui doit pouvoir contacter l'équipe RekoltHt */}
        <Route path="/contact" element={<ContacterNous/>}/>
        {/* publique : page de présentation, accessible sans connexion */}
        <Route path="/qui-sommes-nous" element={<QuiSommesNous/>}/>
        {/* publique : n'importe qui doit pouvoir consulter les conditions d'utilisation */}
        <Route path="/politique-utilisation" element={<PolitiqueUtilisation/>}/>
        <Route path="/admin/dashboard" element={<RoutePrivee><AdminDashboard/></RoutePrivee>}/>
        <Route path="/messages" element={<RoutePrivee><Messagerie/></RoutePrivee>}/>
        <Route path="/contacter-admin" element={<RoutePrivee><ContacterAdmin/></RoutePrivee>}/>
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