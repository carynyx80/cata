import { fmt, months } from "@/lib/data";

export function PriceChart({ data }: { data: number[] }) {
  const W = 640, H = 280, L = 64, R = 16, T = 16, B = 36;
  const lo = Math.min(...data), hi = Math.max(...data);
  const step = Math.pow(10, Math.floor(Math.log10(Math.max(hi - lo, 1)))) / 2;
  const min = Math.floor(lo / step) * step, max = Math.ceil(hi / step) * step || min + step;
  const x = (i: number) => L + (i * (W - L - R)) / (data.length - 1);
  const y = (v: number) => T + (1 - (v - min) / (max - min)) * (H - T - B);
  const ticks = Array.from({ length: 5 }, (_, i) => min + ((max - min) * i) / 4);
  const pts = data.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="price history, last 12 months">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#2B1A22" strokeOpacity=".08" />
          <text x={L - 10} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#5E4652" style={{ fontFamily: "var(--f-mono)" }}>{fmt(Math.round(t))}</text>
        </g>
      ))}
      {data.map((_, i) => (
        <text key={i} x={x(i)} y={H - 12} textAnchor="middle" fontSize="11" fill="#5E4652" style={{ fontFamily: "var(--f-mono)" }}>{months[i]}</text>
      ))}
      <polygon points={`${x(0)},${H - B} ${pts} ${x(data.length - 1)},${H - B}`} fill="#E2487F" fillOpacity=".1" />
      <polyline points={pts} fill="none" stroke="#E2487F" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r="5" fill="#E2487F" stroke="#FBF6EE" strokeWidth="2" />
    </svg>
  );
}
