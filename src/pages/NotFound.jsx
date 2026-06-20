import { useNavigate } from "react-router-dom";
import NavBar from "../components/NavBar";
import Footer from "../components/Footer";
import "../assets/CSS/NotFound.css";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <>
      <NavBar />
      <div className="nf-root">
        <div className="nf-container">

          <div className="nf-code">404</div>

          <h1 className="nf-title">Paj sa pa egziste</h1>
          <p className="nf-sub">
            Paj ou ap chèche a pa jwenn oswa li pa disponib ankò.
          </p>

          <div className="nf-actions">
            <button className="nf-btn-primary" onClick={() => navigate("/")}>
              Retounen nan paj akèy
            </button>
            <button className="nf-btn-secondary" onClick={() => navigate(-1)}>
              Retounen dèyè
            </button>
          </div>

        </div>
      </div>
      <Footer />
    </>
  );
}
