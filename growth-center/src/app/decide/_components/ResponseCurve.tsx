'use client';

/**
 * The spend-response assumption V = V0 × (spend ratio)^k, drawn dotted because it is an assumption, not a measured
 * curve. The dashed diagonal is "no diminishing returns"; markers show halving and doubling spend.
 */
export function ResponseCurve({ k, width = 176, height = 76 }: { k: number; width?: number; height?: number }) {
  const valid = Number.isFinite(k) && k > 0;
  const pad = 6;
  const X = (r: number) => pad + (r / 2) * (width - pad * 2);
  const Y = (v: number) => height - pad - (Math.min(v, 2) / 2) * (height - pad * 2);
  const pts = Array.from({ length: 41 }, (_, i) => i * 0.05);
  const d = valid ? pts.map((r, i) => `${i ? 'L' : 'M'}${X(r).toFixed(1)} ${Y(Math.pow(r, k)).toFixed(1)}`).join('') : '';
  const dbl = valid ? Math.pow(2, k) : NaN;
  const half = valid ? Math.pow(0.5, k) : NaN;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={valid ? `Assumed response: doubling spend gives ${dbl.toFixed(2)} times the visitors, halving it ${half.toFixed(2)} times` : 'No valid elasticity'}
      className="block shrink-0 overflow-visible"
    >
      <line x1={X(0)} y1={Y(0)} x2={X(2)} y2={Y(0)} stroke="var(--stone-3)" strokeWidth="1.5" />
      <line x1={X(0)} y1={Y(0)} x2={X(0)} y2={Y(2)} stroke="var(--stone-3)" strokeWidth="1.5" />
      <line x1={X(0)} y1={Y(0)} x2={X(2)} y2={Y(2)} stroke="var(--stone-3)" strokeWidth="1.2" strokeDasharray="4 3" />
      {valid ? (
        <>
          <path d={d} fill="none" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="0.1 4.2" />
          {[0.5, 1, 2].map((r) => (
            <circle key={r} cx={X(r)} cy={Y(Math.pow(r, k))} r={r === 1 ? 3.2 : 4} fill={r === 1 ? 'var(--ink)' : 'var(--haldi)'} stroke="var(--stone)" strokeWidth="1.5" />
          ))}
          <text x={X(2) - 2} y={Y(dbl) - 8} textAnchor="end" className="tab" style={{ fontSize: 11, fontWeight: 700, fill: 'var(--ink)' }}>
            ×{dbl.toFixed(2)}
          </text>
          <text x={X(0.5) + 6} y={Y(half) + 15} className="tab" style={{ fontSize: 11, fontWeight: 700, fill: 'var(--ink)' }}>
            ×{half.toFixed(2)}
          </text>
        </>
      ) : null}
    </svg>
  );
}
