export function PicksView({ picksByYear }) {
  const years = Object.keys(picksByYear || {}).sort();
  return (
    <div style={{ marginTop: 16 }}>
      {years.map((y) => (
        <div key={y} style={{ marginBottom: 16 }}>
          <h3 style={{ margin: "8px 0" }}>{y} Picks</h3>
          {(picksByYear?.[y]?.length ?? 0) === 0 ? (
            <div style={{ opacity: 0.7 }}>—</div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {picksByYear[y].map((p, i) => (
                <li key={`${y}-${i}`}>{p}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
