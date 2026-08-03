import { useState } from "react";
import "../assets/CSS/Charts.css";

// tooltip commun aux deux graphiques — positionné près du pointeur, jamais
// via innerHTML (labels/valeurs insérés en texte React, pas de concaténation
// de chaîne) ; voir dataviz skill, interaction.md
function ChartTooltip({ x, y, label, value }) {
  if (x == null) return null;
  return (
    <div className="rk-chart-tooltip" style={{ left: x + 12, top: y + 12 }}>
      {label} — <strong>{value}</strong>
    </div>
  );
}

// diagramme circulaire (donut) — jusqu'à 3-4 catégories, ordre fixe des
// couleurs jamais permuté (voir --chart-series-* dans Charts.css). Légende +
// étiquettes directes (%) + infobulle au survol, la couleur seule ne porte
// jamais l'identité (voir dataviz skill, marks-and-anatomy.md)
export function DonutChart({ data, colors, centerLabel }) {
  const [survole, setSurvole] = useState(null); // { x, y, label, value } ou null

  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  const rayon = 60;
  const epaisseur = 24;
  const rayonInterieur = rayon - epaisseur;
  const circonference = 2 * Math.PI * rayon;

  // décalages cumulés calculés sans variable mutable (somme préfixe
  // immuable) — le segment i démarre où le segment i-1 s'est arrêté
  const parts = data.map((d) => d.value / total);
  const debutsCumules = parts.reduce(
    (acc, part) => [...acc, acc[acc.length - 1] + part],
    [0]
  );

  const segments = data.map((d, i) => {
    const part = parts[i];
    const longueur = circonference * part;
    return {
      ...d,
      couleur: colors[i % colors.length],
      dasharray: `${longueur} ${circonference - longueur}`,
      dashoffset: circonference * (1 - debutsCumules[i]),
      pourcentage: Math.round(part * 100),
    };
  });

  return (
    <div className="rk-donut">
      <svg
        className="rk-donut__svg"
        width={rayon * 2}
        height={rayon * 2}
        viewBox={`0 0 ${rayon * 2} ${rayon * 2}`}
      >
        {segments.map((s) => (
          <circle
            key={s.label}
            className="rk-donut__slice"
            cx={rayon}
            cy={rayon}
            r={(rayon + rayonInterieur) / 2}
            fill="none"
            stroke={s.couleur}
            strokeWidth={epaisseur}
            strokeDasharray={s.dasharray}
            strokeDashoffset={s.dashoffset}
            transform={`rotate(-90 ${rayon} ${rayon})`}
            tabIndex={0}
            role="img"
            aria-label={`${s.label} : ${s.value} (${s.pourcentage}%)`}
            onMouseMove={(e) => setSurvole({ x: e.clientX, y: e.clientY, label: s.label, value: s.value })}
            onMouseLeave={() => setSurvole(null)}
            onFocus={(e) => {
              const rect = e.target.getBoundingClientRect();
              setSurvole({ x: rect.left, y: rect.top, label: s.label, value: s.value });
            }}
            onBlur={() => setSurvole(null)}
          />
        ))}
        <text x={rayon} y={rayon - 4} textAnchor="middle" className="rk-donut__center-value">
          {total}
        </text>
        {centerLabel && (
          <text x={rayon} y={rayon + 14} textAnchor="middle" className="rk-donut__center-label">
            {centerLabel}
          </text>
        )}
      </svg>

      <div className="rk-donut__legend">
        {segments.map((s) => (
          <button
            type="button"
            className="rk-donut__legend-item"
            key={s.label}
            onMouseMove={(e) => setSurvole({ x: e.clientX, y: e.clientY, label: s.label, value: s.value })}
            onMouseLeave={() => setSurvole(null)}
          >
            <span className="rk-donut__legend-swatch" style={{ background: s.couleur }} />
            <span className="rk-donut__legend-label">{s.label}</span>
            <span className="rk-donut__legend-value">{s.value}</span>
            <span className="rk-donut__legend-pct">{s.pourcentage}%</span>
          </button>
        ))}
      </div>

      <ChartTooltip {...(survole || {})} />
    </div>
  );
}

// histogramme (barres horizontales) — une seule teinte : ces graphiques
// comparent une magnitude par catégorie (nombre de produits), pas une
// identité de série, donc une seule couleur porte le sens (voir dataviz
// skill, choosing-a-form.md : "compare magnitude -> séquentiel, une teinte")
export function HistogramChart({ data, color }) {
  const [survole, setSurvole] = useState(null);

  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="rk-hbar">
      {data.map((d) => (
        <div className="rk-hbar__row" key={d.label}>
          <span className="rk-hbar__label" title={d.label}>{d.label}</span>
          <div
            className="rk-hbar__track"
            tabIndex={0}
            role="img"
            aria-label={`${d.label} : ${d.value}`}
            onMouseMove={(e) => setSurvole({ x: e.clientX, y: e.clientY, label: d.label, value: d.value })}
            onMouseLeave={() => setSurvole(null)}
            onFocus={(e) => {
              const rect = e.target.getBoundingClientRect();
              setSurvole({ x: rect.left, y: rect.top, label: d.label, value: d.value });
            }}
            onBlur={() => setSurvole(null)}
          >
            <div
              className="rk-hbar__fill"
              style={{ width: `${(d.value / max) * 100}%`, background: color }}
            />
          </div>
          <span className="rk-hbar__value">{d.value}</span>
        </div>
      ))}

      <ChartTooltip {...(survole || {})} />
    </div>
  );
}

// graphique en ligne — une seule teinte (même logique que HistogramChart :
// magnitude par catégorie, pas identité de série). Aire en dessous à ~10%
// d'opacité pour ancrer la ligne à la base (voir dataviz skill,
// marks-and-anatomy.md), points ≥8px avec anneau de la couleur de surface,
// étiquette directe uniquement sur l'extremum (le reste via l'infobulle) ;
// défile horizontalement si trop de points pour tenir dans la carte
export function LineChart({ data, color }) {
  const [survole, setSurvole] = useState(null);

  const max = Math.max(...data.map((d) => d.value), 1);
  const largeurParPoint = 70;
  const largeur = Math.max(data.length * largeurParPoint, 260);
  const hauteur = 160;
  const marge = { haut: 24, bas: 56 };
  const hauteurTrace = hauteur - marge.haut - marge.bas;

  const points = data.map((d, i) => ({
    ...d,
    x: data.length === 1 ? largeur / 2 : (i / (data.length - 1)) * (largeur - largeurParPoint) + largeurParPoint / 2,
    y: marge.haut + hauteurTrace - (d.value / max) * hauteurTrace,
  }));

  const indexMax = points.reduce((iMax, p, i) => (p.value > points[iMax].value ? i : iMax), 0);

  const chemin = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const cheminAire = `${chemin} L ${points[points.length - 1].x} ${marge.haut + hauteurTrace} L ${points[0].x} ${marge.haut + hauteurTrace} Z`;

  return (
    <div className="rk-line-scroll">
      <svg
        className="rk-line__svg"
        width={largeur}
        height={hauteur}
        viewBox={`0 0 ${largeur} ${hauteur}`}
      >
        {/* ligne de base */}
        <line
          x1={0} y1={marge.haut + hauteurTrace} x2={largeur} y2={marge.haut + hauteurTrace}
          className="rk-line__baseline"
        />
        <path d={cheminAire} fill={color} className="rk-line__aire" />
        <path d={chemin} fill="none" stroke={color} className="rk-line__trace" />

        {points.map((p, i) => (
          <g key={p.label}>
            {i === indexMax && (
              <text x={p.x} y={p.y - 12} textAnchor="middle" className="rk-line__valeur-max">
                {p.value}
              </text>
            )}
            {/* cible de survol/focus agrandie (>=24px), rendue AVANT le
                point pour que le combinateur ~ ci-dessous (Charts.css)
                puisse l'agrandir visuellement au survol/focus — voir
                dataviz skill, interaction.md */}
            <circle
              cx={p.x} cy={p.y} r={13}
              className="rk-line__hitzone"
              tabIndex={0}
              role="img"
              aria-label={`${p.label} : ${p.value}`}
              onMouseMove={(e) => setSurvole({ x: e.clientX, y: e.clientY, label: p.label, value: p.value })}
              onMouseLeave={() => setSurvole(null)}
              onFocus={(e) => {
                const rect = e.target.getBoundingClientRect();
                setSurvole({ x: rect.left, y: rect.top, label: p.label, value: p.value });
              }}
              onBlur={() => setSurvole(null)}
            />
            <circle cx={p.x} cy={p.y} r={5} className="rk-line__point" fill={color} />
            <text
              x={p.x} y={hauteur - marge.bas + 14}
              textAnchor="end"
              className="rk-line__label"
              transform={`rotate(-38 ${p.x} ${hauteur - marge.bas + 14})`}
            >
              {p.label.length > 16 ? `${p.label.slice(0, 15)}…` : p.label}
            </text>
          </g>
        ))}
      </svg>

      <ChartTooltip {...(survole || {})} />
    </div>
  );
}
