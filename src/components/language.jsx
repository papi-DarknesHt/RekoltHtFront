import { useState, useRef, useEffect } from "react";
import { Languages, ChevronDown } from "lucide-react";
import "../assets/CSS/langue.css";
import { useTranslation } from "../assets/Translate/i18n.jsx";

export default function Language() {
    const { lang, setLang, languages } = useTranslation();
    const [open, setOpen] = useState(false);
    const current = { code: lang, label: languages[lang] };

    const ref = useRef(null);

    // fermer si clic dehors
    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const changeLanguage = (code) => {
        setLang(code);
        setOpen(false);
    };

    return (
        <div className="lang-switcher" ref={ref}>
            <button className="lang-btn" onClick={() => setOpen(!open)}>
                <Languages size={16} />
                {/* {current.short} */}
                <ChevronDown size={14} className={open ? "rotate" : ""} />
            </button>

            {open && (
                <div className="lang-menu">
                    {Object.entries(languages).map(([code, label]) => (
                        <button
                            key={code}
                            className="lang-item"
                            onClick={() => changeLanguage(code)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}