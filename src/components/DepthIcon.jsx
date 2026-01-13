export function DepthIcon({ size = 20, title = "Dynasty Depth Chart" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      role="img"
      aria-label={title}
      style={{ display: "block" }}
    >
      <rect x="16" y="19" width="96" height="14" rx="4" fill="var(--ddc-logo-accent)" />
      <rect x="16" y="45" width="96" height="14" rx="4" fill="var(--ddc-logo-band)" />
      <rect x="16" y="71" width="96" height="14" rx="4" fill="var(--ddc-logo-band)" />
      <rect x="16" y="97" width="96" height="14" rx="4" fill="var(--ddc-logo-band)" />
    </svg>
  );
}