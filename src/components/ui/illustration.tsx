/**
 * Small brand illustrations for empty states — flat shapes in the SWAPD palette, decorative (aria-hidden).
 * One visual language (two objects + an exchange motif) so every empty screen feels part of the same product.
 */
export type ArtName = 'swap' | 'inbox' | 'chat' | 'search' | 'heart' | 'bell' | 'box' | 'deal';

const C = { ink: '#17151E', coral: '#FF765E', violet: '#CDB8FF', lilac: '#F3E9FF', mint: '#D8F4DF', cobalt: '#5267FF', paper: '#FAF8F5' };

function Glyph({ name }: { name: ArtName }) {
  switch (name) {
    case 'inbox': return <g><rect x="38" y="30" width="64" height="44" rx="10" fill={C.paper} stroke={C.ink} strokeWidth="3" /><path d="M38 56h18l6 8h16l6-8h18" fill="none" stroke={C.ink} strokeWidth="3" strokeLinejoin="round" /><circle cx="98" cy="30" r="9" fill={C.coral} stroke={C.ink} strokeWidth="3" /></g>;
    case 'chat': return <g><rect x="30" y="28" width="52" height="34" rx="14" fill={C.paper} stroke={C.ink} strokeWidth="3" /><path d="M42 62l-4 10 14-10" fill={C.paper} stroke={C.ink} strokeWidth="3" strokeLinejoin="round" /><rect x="62" y="44" width="48" height="30" rx="13" fill={C.coral} stroke={C.ink} strokeWidth="3" /><circle cx="76" cy="59" r="3" fill={C.ink} /><circle cx="86" cy="59" r="3" fill={C.ink} /><circle cx="96" cy="59" r="3" fill={C.ink} /></g>;
    case 'search': return <g><circle cx="64" cy="48" r="20" fill={C.paper} stroke={C.ink} strokeWidth="3" /><path d="M79 63l16 16" stroke={C.ink} strokeWidth="6" strokeLinecap="round" /><path d="M56 44a9 9 0 0 1 12-6" fill="none" stroke={C.cobalt} strokeWidth="3" strokeLinecap="round" /></g>;
    case 'heart': return <g><path d="M70 78s-26-15-26-33a14 14 0 0 1 26-7 14 14 0 0 1 26 7c0 18-26 33-26 33z" fill={C.coral} stroke={C.ink} strokeWidth="3" strokeLinejoin="round" /><path d="M58 44a6 6 0 0 1 6-4" fill="none" stroke={C.paper} strokeWidth="3" strokeLinecap="round" /></g>;
    case 'bell': return <g><path d="M52 66V50a18 18 0 0 1 36 0v16l6 6H46z" fill={C.paper} stroke={C.ink} strokeWidth="3" strokeLinejoin="round" /><path d="M64 76a6 6 0 0 0 12 0" fill="none" stroke={C.ink} strokeWidth="3" /><circle cx="88" cy="36" r="7" fill={C.coral} stroke={C.ink} strokeWidth="3" /></g>;
    case 'box': return <g><path d="M40 42l30-12 30 12v30l-30 12-30-12z" fill={C.paper} stroke={C.ink} strokeWidth="3" strokeLinejoin="round" /><path d="M40 42l30 12 30-12M70 54v30" fill="none" stroke={C.ink} strokeWidth="3" strokeLinejoin="round" /><path d="M55 36l30 12" stroke={C.coral} strokeWidth="5" strokeLinecap="round" /></g>;
    case 'deal': return <g><rect x="34" y="34" width="34" height="40" rx="8" fill={C.mint} stroke={C.ink} strokeWidth="3" transform="rotate(-8 51 54)" /><rect x="72" y="30" width="34" height="40" rx="8" fill={C.coral} stroke={C.ink} strokeWidth="3" transform="rotate(8 89 50)" /><circle cx="70" cy="76" r="11" fill={C.ink} /><path d="M65 76l4 4 7-8" fill="none" stroke={C.paper} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></g>;
    default: return <g><rect x="30" y="32" width="34" height="42" rx="9" fill={C.coral} stroke={C.ink} strokeWidth="3" transform="rotate(-7 47 53)" /><rect x="76" y="28" width="34" height="42" rx="9" fill={C.mint} stroke={C.ink} strokeWidth="3" transform="rotate(7 93 49)" /><circle cx="70" cy="52" r="12" fill={C.ink} /><path d="M64 49h12l-3-3M76 55H64l3 3" fill="none" stroke={C.paper} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></g>;
  }
}

export function Illustration({ name, className }: { name: ArtName; className?: string }) {
  return (
    <svg viewBox="0 0 140 104" className={className} aria-hidden focusable="false">
      <ellipse cx="70" cy="92" rx="44" ry="6" fill={C.ink} opacity=".08" />
      <circle cx="26" cy="22" r="5" fill={C.violet} /><circle cx="118" cy="84" r="4" fill={C.cobalt} /><path d="M112 18l3 6 6 3-6 3-3 6-3-6-6-3 6-3z" fill={C.violet} />
      <Glyph name={name} />
    </svg>
  );
}
