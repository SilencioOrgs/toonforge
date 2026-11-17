import type { RigMode } from '../lib/domain';

function TopicGeometry({ slug }: { slug?: string }) {
  const s = (slug || 'dbindex').toLowerCase();

  if (s === 'binary') {
    return (
      <>
        {[18, 34, 50, 66, 82, 98, 114].map((x, idx) => (
          <rect
            key={x}
            x={x}
            y={idx === 3 ? 28 : 42}
            width="10"
            height={idx === 3 ? 52 : 38}
            rx="2"
            fill={idx === 3 ? '#10b981' : '#d4d4d8'}
            stroke="#09090b"
            strokeWidth="1.8"
          />
        ))}
        <polygon points="71,12 76,20 66,20" fill="#10b981" stroke="#09090b" strokeWidth="1.4" className="bob" />
      </>
    );
  }

  if (s === 'redis') {
    return (
      <>
        <rect x="44" y="20" width="52" height="22" rx="4" fill="#10b981" stroke="#09090b" strokeWidth="2.2" />
        <rect x="40" y="64" width="60" height="24" rx="2" fill="#d4d4d8" stroke="#09090b" strokeWidth="2" />
        <line x1="70" y1="42" x2="70" y2="64" stroke="#09090b" strokeWidth="2" strokeDasharray="3 2" />
        <polygon points="70,6 75,13 70,20 65,13" fill="#10b981" stroke="#09090b" strokeWidth="1.5" className="bob" />
      </>
    );
  }

  if (s === 'sqli' || s === 'idor' || s === 'ratelimit') {
    return (
      <>
        <rect x="48" y="26" width="44" height="58" rx="4" fill="#e4e4e7" stroke="#09090b" strokeWidth="2" />
        <polygon points="70,32 86,40 86,58 70,70 54,58 54,40" fill="#10b981" stroke="#09090b" strokeWidth="2" className="bob" />
        <rect x="64" y="45" width="12" height="10" rx="2" fill="#ffffff" stroke="#09090b" strokeWidth="1.5" />
      </>
    );
  }

  return (
    <>
      <line x1="70" y1="28" x2="52" y2="48" stroke="#09090b" strokeWidth="2.5" />
      <line x1="70" y1="28" x2="88" y2="48" stroke="#09090b" strokeWidth="2.5" />
      <rect x="62" y="20" width="16" height="12" rx="2" fill="#ffffff" stroke="#09090b" strokeWidth="2" />
      <rect x="44" y="42" width="15" height="11" rx="2" fill="#d4d4d8" stroke="#09090b" strokeWidth="2" />
      <rect x="81" y="42" width="15" height="11" rx="2" fill="#d4d4d8" stroke="#09090b" strokeWidth="2" />
      <rect x="44" y="68" width="52" height="22" rx="2" fill="#10b981" stroke="#09090b" strokeWidth="2.2" />
      <rect x="52" y="75" width="36" height="6" rx="1.5" fill="#ffffff" stroke="#09090b" strokeWidth="1.2" />
      <polygon points="70,4 76,12 70,20 64,12" fill="#10b981" stroke="#09090b" strokeWidth="1.6" className="bob" />
    </>
  );
}

export function StageSvg({ rigMode, slug }: { rigMode: RigMode; slug?: string }) {
  return (
    <svg viewBox="0 0 140 108" className="stage-svg" aria-label="9:16 stage diorama preview">
      <defs>
        <linearGradient id="stage-mono-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f4f4f5" />
          <stop offset="55%" stopColor="#d4d4d8" />
          <stop offset="100%" stopColor="#a1a1aa" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="140" height="108" rx="8" fill="url(#stage-mono-bg)" />
      <rect x="6" y="92" width="128" height="8" rx="2" fill="#52525b" stroke="#09090b" strokeWidth="2" />

      <TopicGeometry slug={slug} />

      {rigMode === 'chibi' ? (
        <>
          <g className="bob">
            <rect x="16" y="54" width="18" height="14" rx="4" fill="#09090b" />
            <rect x="18" y="62" width="14" height="10" rx="3" fill="#fafafa" stroke="#09090b" strokeWidth="1.5" />
            <rect x="19" y="64" width="5" height="4" rx="1" fill="#fff" stroke="#09090b" strokeWidth="1.2" />
            <rect x="26" y="64" width="5" height="4" rx="1" fill="#fff" stroke="#09090b" strokeWidth="1.2" />
            <rect x="18" y="72" width="14" height="12" rx="2" fill="#27272a" stroke="#09090b" strokeWidth="1.2" />
            <rect x="21" y="75" width="8" height="4" rx="1" fill="#10b981" />
            <rect x="20" y="84" width="10" height="8" fill="#52525b" />
          </g>
          <g className="bob" style={{ animationDelay: '0.35s' }}>
            <rect x="106" y="54" width="18" height="14" rx="4" fill="#18181b" />
            <rect x="108" y="62" width="14" height="10" rx="3" fill="#e4e4e7" stroke="#09090b" strokeWidth="1.5" />
            <rect x="109" y="64" width="5" height="4" rx="1" fill="#fff" stroke="#09090b" strokeWidth="1.2" />
            <rect x="116" y="64" width="5" height="4" rx="1" fill="#fff" stroke="#09090b" strokeWidth="1.2" />
            <rect x="108" y="72" width="14" height="12" rx="2" fill="#71717a" />
            <rect x="110" y="84" width="10" height="8" fill="#27272a" />
          </g>
        </>
      ) : (
        <>
          <g className="bob" stroke="#09090b" strokeWidth="2.2" strokeLinecap="round">
            <ellipse cx="26" cy="60" rx="8" ry="6.5" fill="#ffffff" />
            <circle cx="24" cy="60" r="1" fill="#09090b" stroke="none" />
            <circle cx="29" cy="60" r="1" fill="#09090b" stroke="none" />
            <line x1="26" y1="67" x2="26" y2="81" />
            <line x1="26" y1="72" x2="36" y2="68" stroke="#10b981" strokeWidth="2.6" />
            <line x1="26" y1="72" x2="18" y2="78" />
            <line x1="26" y1="81" x2="22" y2="92" />
            <line x1="26" y1="81" x2="30" y2="92" />
          </g>
          <g className="bob" style={{ animationDelay: '0.35s' }} stroke="#09090b" strokeWidth="2.2" strokeLinecap="round">
            <ellipse cx="114" cy="60" rx="8" ry="6.5" fill="#e4e4e7" />
            <circle cx="111" cy="60" r="1" fill="#09090b" stroke="none" />
            <circle cx="116" cy="60" r="1" fill="#09090b" stroke="none" />
            <line x1="114" y1="67" x2="114" y2="81" />
            <line x1="114" y1="72" x2="104" y2="69" />
            <line x1="114" y1="72" x2="122" y2="78" />
            <line x1="114" y1="81" x2="110" y2="92" />
            <line x1="114" y1="81" x2="118" y2="92" />
          </g>
        </>
      )}
    </svg>
  );
}
