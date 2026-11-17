import type { LogoConcept } from '../lib/domain';

export function LogoSvg({ concept }: { concept: LogoConcept }) {
  if (concept === 'clapper') {
    return (
      <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">
        <rect x="10" y="24" width="44" height="32" rx="6" fill="#27272a" stroke="#09090b" strokeWidth="2.5" />
        <g transform="rotate(-12 12 22)">
          <rect x="9" y="12" width="46" height="11" rx="3" fill="#fafafa" stroke="#09090b" strokeWidth="2.5" />
          <polygon points="16,12 24,12 19,23 11,23" fill="#09090b" />
          <polygon points="32,12 40,12 35,23 27,23" fill="#09090b" />
          <polygon points="48,12 54,12 51,23 43,23" fill="#09090b" />
        </g>
        <rect x="16" y="31" width="32" height="19" rx="3" fill="#09090b" />
        <text x="21" y="45" fontFamily="monospace" fontWeight="900" fontSize="13" fill="#10b981">
          &gt;_
        </text>
      </svg>
    );
  }

  if (concept === 'portal') {
    return (
      <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">
        <rect x="16" y="6" width="32" height="52" rx="8" fill="#fafafa" stroke="#09090b" strokeWidth="2.6" />
        <rect x="21" y="13" width="22" height="32" rx="4" fill="#09090b" />
        <rect x="25" y="33" width="4" height="8" fill="#71717a" />
        <rect x="31" y="25" width="4" height="16" fill="#d4d4d8" />
        <rect x="37" y="19" width="4" height="22" fill="#10b981" />
        <circle cx="32" cy="51" r="2.2" fill="#09090b" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">
      <rect x="18" y="4" width="28" height="16" rx="6" fill="#09090b" />
      <rect x="20" y="13" width="24" height="10" rx="3" fill="#fafafa" stroke="#09090b" strokeWidth="2" />
      <rect x="22" y="14" width="8" height="6" rx="1.5" fill="#fff" stroke="#09090b" strokeWidth="1.8" />
      <rect x="34" y="14" width="8" height="6" rx="1.5" fill="#fff" stroke="#09090b" strokeWidth="1.8" />
      <polygon points="32,20 56,31 32,42 8,31" fill="#e4e4e7" stroke="#09090b" strokeWidth="2.4" strokeLinejoin="round" />
      <polygon points="8,31 32,42 32,60 8,49" fill="#52525b" stroke="#09090b" strokeWidth="2.4" strokeLinejoin="round" />
      <polygon points="56,31 32,42 32,60 56,49" fill="#10b981" stroke="#09090b" strokeWidth="2.4" strokeLinejoin="round" />
      <text x="40" y="51" fontFamily="monospace" fontWeight="900" fontSize="11" fill="#09090b">
        &gt;_
      </text>
    </svg>
  );
}
