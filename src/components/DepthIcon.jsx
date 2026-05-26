// Small "depth" mark used in the header brand lockup — three stacked bars
// suggesting a depth chart, plus an amber accent bar. Renders inside the
// .ddc-logo box (32px border + 3px amber halo) defined in index.css.

export function DepthIcon({ size = 22, title = "Dynasty Depth Chart" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label={title}
      style={{ display: "block" }}
      fill="currentColor"
    >
      <rect x="5"  y="6"  width="22" height="3" rx="1" />
      <rect x="5"  y="12" width="22" height="3" rx="1" opacity="0.55" />
      <rect x="5"  y="18" width="22" height="3" rx="1" opacity="0.55" />
      <rect x="5"  y="24" width="22" height="3" rx="1" opacity="0.55" />
    </svg>
  );
}
