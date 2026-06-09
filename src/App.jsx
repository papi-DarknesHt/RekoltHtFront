

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useGlobalSocket } from "./api/useGlobalSocket.js";
import TestPage from "./testpage.jsx";
import RekoltHtAuth from "./Registration/Authentification.jsx";
import HomePage from "./Acceuil/HomePage.jsx";
import RoutePrivee from "./components/RoutePrivee";
import NavBar from "./components/NavBar";

function AppContent() {
  useGlobalSocket();

  return (
    <>
      {/* <NavBar /> */}
      <Routes>
        <Route path="/" element={<HomePage />} />
        {/* <Route path="/test" element={<TestPage />} /> */}
        <Route path="/auth" element={<RekoltHtAuth />} />
      </Routes>
    </>
  );

}

// export default App
export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}