// import React, {useEffect, useState} from 'react'
// import reactLogo from './assets/react.svg'
// import viteLogo from './assets/vite.svg'
// import heroImg from './assets/hero.png'
// import './App.css'

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useGlobalSocket } from "./api/useGlobalSocket.js";
import TestPage from "./testpage.jsx";

function AppContent() {
useGlobalSocket();

  return (
    <Routes>
        <Route path="/"     element={<TestPage />} />
      <Route path="api/test" element={<TestPage />} />
    </Routes>
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