const BASE_AXES = [
  { key: "QB", label: "QB", colorVar: "--ddc-pos-QB" },
  { key: "RB", label: "RB", colorVar: "--ddc-pos-RB" },
  { key: "WR", label: "WR", colorVar: "--ddc-pos-WR" },
  { key: "TE", label: "TE", colorVar: "--ddc-pos-TE" },
  { key: "TAXI", label: "TAXI", colorVar: "--ddc-pos-TAXI" },
];

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function polarPoint(cx, cy, radius, angleDeg, scale = 1) {
  const rad = (angleDeg * Math.PI) / 180;

  return {
    x: cx + Math.cos(rad) * radius * scale,
    y: cy + Math.sin(rad) * radius * scale,
  };
}

function pointsToString(points) {
  return points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

export function ValueShape({ shares = {}, showTaxi = true }) {
  const size = 190;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 68;

  const visibleAxes = showTaxi
    ? BASE_AXES
    : BASE_AXES.filter((axis) => axis.key !== "TAXI");

  const angleStep = 360 / visibleAxes.length;

  const observedMaxShare = Math.max(
    ...visibleAxes.map((axis) => Number(shares?.[axis.key]) || 0)
  );

  const maxShare = Math.max(0.4, observedMaxShare * 1.08);

  const axes = visibleAxes.map((axis, idx) => ({
    ...axis,
    angle: -90 + idx * angleStep,
    share: Number(shares?.[axis.key]) || 0,
  }));

  const gridScales = [0.25, 0.5, 0.75, 1];

  const dataPoints = axes.map((axis) =>
    polarPoint(
      cx,
      cy,
      radius,
      axis.angle,
      clamp(axis.share / maxShare, 0, 1)
    )
  );

  return (
    <div className="ddc-panel ddc-value-shape-panel" data-pos="ROSTER">
      <div className="ddc-value-shape">
        <div className="ddc-value-shape-viz">
          <svg
            viewBox={`0 0 ${size} ${size}`}
            role="img"
            aria-label="Roster value shape"
          >
            {gridScales.map((scale) => {
              const points = axes.map((axis) =>
                polarPoint(cx, cy, radius, axis.angle, scale)
              );

              return (
                <polygon
                  key={scale}
                  points={pointsToString(points)}
                  className="ddc-value-shape-grid"
                />
              );
            })}

            {axes.map((axis) => {
              const end = polarPoint(cx, cy, radius, axis.angle, 1);

              return (
                <line
                  key={axis.key}
                  x1={cx}
                  y1={cy}
                  x2={end.x}
                  y2={end.y}
                  className="ddc-value-shape-axis"
                />
              );
            })}

            <polygon
              points={pointsToString(dataPoints)}
              className="ddc-value-shape-data"
            />

            {dataPoints.map((point, idx) => (
              <circle
                key={axes[idx].key}
                cx={point.x}
                cy={point.y}
                r="3"
                className="ddc-value-shape-dot"
                style={{ fill: `var(${axes[idx].colorVar})` }}
              />
            ))}

            {axes.map((axis) => {
              const labelPoint = polarPoint(cx, cy, radius + 22, axis.angle, 1);

              return (
                <text
                  key={axis.key}
                  x={labelPoint.x}
                  y={labelPoint.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="ddc-value-shape-label"
                  style={{ fill: `var(${axis.colorVar})` }}
                >
                  {axis.label}
                </text>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}