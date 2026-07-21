

import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import MesProduits from "./Produits/mesProduits.jsx";
import SuprimerProduit from "./Produits/suprimerProduit.jsx"
import copy from "./components/copy.jsx"
import Aide from "./pages/aide.jsx"
import NotFound from "./pages/NotFound.jsx";
import ChatbotVendeur from "./components/ChatbotVendeur.jsx";
function AppContent() {
  useGlobalSocket();
  useInactivityTimeout();

  return (
    <>
      {/* <NavBar /> */}
      <ChatbotVendeur />
      <Routes>
        <Route path="/" element={<HomePage />} />
        {/* <Route path="/test" element={<TestPage />} /> */}
        <Route path="/auth" element={<RekoltHtAuth />} />
        <Route path="/profil" element={<RoutePrivee><ProfilAcheteur /></RoutePrivee>} />
        <Route path="/update_profil" element={<RoutePrivee><ModifierProfil/></RoutePrivee>}/>
        <Route path="/Devenir_Vendeur" element={<RoutePrivee><DevenirVendeur/></RoutePrivee>}/>
        <Route path="/produits/ajouter" element={<RoutePrivee><AjouterProduit/></RoutePrivee>}/>
        <Route path="/produits" element={<RoutePrivee><Produits/></RoutePrivee>}/>
        <Route path="/produits/modifier" element={<RoutePrivee><ModifierProduit/></RoutePrivee>}/>
        <Route path="/produits/mesProduits" element={<RoutePrivee><MesProduits/></RoutePrivee>}/>
        <Route path="/produits/suprimerProduits" element={<RoutePrivee><SuprimerProduit/></RoutePrivee>}/>
        <Route path="/aide" element={<RoutePrivee><Aide/></RoutePrivee>}/>
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