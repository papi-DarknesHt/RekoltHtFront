

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
import NotFound from "./pages/NotFound.jsx";
function AppContent() {
  useGlobalSocket();
  useInactivityTimeout();

  return (
    <>
      {/* <NavBar /> */}
      <Routes>
        <Route path="/" element={<HomePage />} />
        {/* <Route path="/test" element={<TestPage />} /> */}
        <Route path="/auth" element={<RekoltHtAuth />} />
        <Route path="/profil" element={<ProfilAcheteur />} />
        <Route path="/update_profil" element={<ModifierProfil/>}/>
        <Route path="/Devenir_Vendeur" element={<DevenirVendeur/>}/>
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