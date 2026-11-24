export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 200 300" width={(size * 2) / 3} height={size} aria-hidden>
      <rect x="9" y="9" width="182" height="282" rx="36" fill="#FBF6EE" stroke="#2B1A22" strokeWidth="14" />
      <rect x="31" y="31" width="138" height="48" rx="13" fill="#E2487F" />
      <text x="47" y="60.5" fill="#FBF6EE" style={{ fontFamily: "var(--f-mono)", fontWeight: 500, fontSize: 16, letterSpacing: 2.4 }}>CATA</text>
      <text x="154" y="66" textAnchor="end" fill="#FBF6EE" style={{ fontFamily: "var(--f-display)", fontSize: 29 }}>10</text>
      <rect x="31" y="95" width="138" height="174" rx="20" fill="#F4C3D3" />
      <path d="M150 108 l2.6 7.4 7.4 2.6 -7.4 2.6 -2.6 7.4 -2.6 -7.4 -7.4 -2.6 7.4 -2.6z" fill="#FBF6EE" />
      <path d="M138 128 l1.3 3.7 3.7 1.3 -3.7 1.3 -1.3 3.7 -1.3 -3.7 -3.7 -1.3 3.7 -1.3z" fill="#FBF6EE" />
      <text x="99" y="225" textAnchor="middle" fill="#2B1A22" style={{ fontFamily: "var(--f-display)", fontSize: 118 }}>C</text>
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={36} />
      <span className="font-display text-xl tracking-[.04em] text-ink">CATA</span>
    </span>
  );
}
