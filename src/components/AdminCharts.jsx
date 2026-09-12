import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import "../assets/CSS/Charts.css";

// tooltip commun à tous les graphiques — même rendu que l'ancienne version
// maison (texte React, pas d'innerHTML), branché sur le `content` de Recharts
// (voir dataviz skill, interaction.md)
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0];
  return (
    <div className="rk-chart-tooltip">
      {item.payload.label ?? label} — <strong>{item.value}</strong>
    </div>
  );
}

// diagramme circulaire (donut) — jusqu'à 3-4 catégories, ordre fixe des
// couleurs jamais permuté (voir --chart-series-* dans Charts.css). Légende +
// étiquettes directes (%) + infobulle au survol, la couleur seule ne porte
// jamais l'identité (voir dataviz skill, marks-and-anatomy.md)
export function DonutChart({ data, colors, centerLabel }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  const segments = data.map((d, i) => ({
    ...d,
    couleur: colors[i % colors.length],
    pourcentage: Math.round((d.value / total) * 100),
  }));

  return (
    <div className="rk-donut">
      <div className="rk-donut__svg" style={{ width: 120, height: 120, position: "relative" }}>
        <ResponsiveContainer width={120} height={120}>
          <PieChart>
            <Pie
              data={segments}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={36}
              outerRadius={60}
              startAngle={90}
              endAngle={-270}
              stroke="var(--rk-card)"
              strokeWidth={2}
              isAnimationActive={true}
            >
              {segments.map((s) => (
                <Cell key={s.label} fill={s.couleur} className="rk-donut__slice" />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} wrapperStyle={{ outline: "none" }} />
          </PieChart>
        </ResponsiveContainer>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <span className="rk-donut__center-value" style={{ fill: undefined, fontSize: "1.3rem", fontWeight: 800, color: "var(--chart-ink)" }}>
            {total}
          </span>
          {centerLabel && (
            <span className="rk-donut__center-label" style={{ fontSize: "0.62rem", color: "var(--chart-ink-muted)" }}>
              {centerLabel}
            </span>
          )}
        </div>
      </div>

      <div className="rk-donut__legend">
        {segments.map((s) => (
          <div className="rk-donut__legend-item" key={s.label}>
            <span className="rk-donut__legend-swatch" style={{ background: s.couleur }} />
            <span className="rk-donut__legend-label">{s.label}</span>
            <span className="rk-donut__legend-value">{s.value}</span>
            <span className="rk-donut__legend-pct">{s.pourcentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// histogramme (barres horizontales) — une seule teinte : ces graphiques
// comparent une magnitude par catégorie (nombre de produits), pas une
// identité de série, donc une seule couleur porte le sens (voir dataviz
// skill, choosing-a-form.md : "compare magnitude -> séquentiel, une teinte")
export function HistogramChart({ data, color }) {
  const hauteur = Math.max(data.length * 34, 60);

  return (
    <div className="rk-hbar">
      <ResponsiveContainer width="100%" height={hauteur}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 32, bottom: 4, left: 4 }} barCategoryGap={12}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            width={120}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--chart-ink)", fontSize: 12 }}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--chart-gridline)", opacity: 0.4 }} wrapperStyle={{ outline: "none" }} />
          <Bar dataKey="value" fill={color} radius={[0, 8, 8, 0]} maxBarSize={16} isAnimationActive={false}>
            <LabelList dataKey="value" position="right" style={{ fill: "var(--chart-ink)", fontSize: 12, fontWeight: 700 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// diagramme de fréquence (barres verticales/colonnes) — une seule teinte,
// même logique que HistogramChart : magnitude par catégorie, pas identité de
// série (voir dataviz skill, choosing-a-form.md). Colonne ≤24px, sommet
// arrondi (marks-and-anatomy.md), valeur directe uniquement sur la barre la
// plus haute (le reste via l'infobulle) ; défile horizontalement si trop de
// catégories pour tenir
export function FrequencyChart({ data, color }) {
  const largeurParBarre = 70;
  const largeur = Math.max(data.length * largeurParBarre, 260);
  const max = Math.max(...data.map((d) => d.value), 1);
  const indexMax = data.reduce((iMax, d, i) => (d.value > data[iMax].value ? i : iMax), 0);

  return (
    <div className="rk-line-scroll">
      <div style={{ width: largeur }}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 24, right: 8, bottom: 44, left: 8 }} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke="var(--chart-gridline)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: "var(--chart-gridline)" }}
              tick={{ fill: "var(--chart-ink-muted)", fontSize: 11 }}
              angle={-38}
              textAnchor="end"
              interval={0}
              tickFormatter={(v) => (v.length > 16 ? `${v.slice(0, 15)}…` : v)}
            />
            <YAxis type="number" hide domain={[0, max * 1.15]} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--chart-gridline)", opacity: 0.4 }} wrapperStyle={{ outline: "none" }} />
            <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={true}>
              <LabelList
                dataKey="value"
                position="top"
                content={({ x, y, width, value, index }) =>
                  index === indexMax ? (
                    <text x={x + width / 2} y={y - 8} textAnchor="middle" className="rk-line__valeur-max">
                      {value}
                    </text>
                  ) : null
                }
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// graphique en ligne — une seule teinte (même logique que HistogramChart :
// magnitude par catégorie, pas identité de série). Aire en dessous à ~10%
// d'opacité pour ancrer la ligne à la base (voir dataviz skill,
// marks-and-anatomy.md), point ≥8px sur l'extremum, étiquette directe
// uniquement sur l'extremum (le reste via l'infobulle) ; défile
// horizontalement si trop de points pour tenir dans la carte
export function LineChart({ data, color }) {
  const largeurParPoint = 70;
  const largeur = Math.max(data.length * largeurParPoint, 260);
  const indexMax = data.reduce((iMax, d, i) => (d.value > data[iMax].value ? i : iMax), 0);

  return (
    <div className="rk-line-scroll">
      <div style={{ width: largeur }}>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={data} margin={{ top: 24, right: 8, bottom: 44, left: 8 }}>
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: "var(--chart-gridline)" }}
              tick={{ fill: "var(--chart-ink-muted)", fontSize: 11 }}
              angle={-38}
              textAnchor="end"
              interval={0}
              tickFormatter={(v) => (v.length > 16 ? `${v.slice(0, 15)}…` : v)}
            />
            <YAxis type="number" hide />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--chart-gridline)" }} wrapperStyle={{ outline: "none" }} />
            <Area type="monotone" dataKey="value" fill={color} fillOpacity={0.1} stroke="none" isAnimationActive={true} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              isAnimationActive={true}
              dot={(props) => {
                const { cx, cy, index } = props;
                return (
                  <circle
                    key={`dot-${index}`}
                    cx={cx}
                    cy={cy}
                    r={index === indexMax ? 6 : 4}
                    fill={color}
                    stroke="var(--rk-card)"
                    strokeWidth={2}
                  />
                );
              }}
              activeDot={{ r: 7, fill: color, stroke: "var(--rk-card)", strokeWidth: 2 }}
              label={({ x, y, value, index }) =>
                index === indexMax ? (
                  <text key={`lbl-${index}`} x={x} y={y - 14} textAnchor="middle" className="rk-line__valeur-max">
                    {value}
                  </text>
                ) : null
              }
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
