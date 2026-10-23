import type { Category, CashFlexibility, ExchangeMethod } from '@/shared/types';

/** Starting hypotheses, not validated metrics. Tunable per environment. */
export const MATCH_WEIGHTS = { wanted: 0.4, mutual: 0.25, value: 0.2, proximity: 0.15 } as const;
export type MatchWeights = { [K in keyof typeof MATCH_WEIGHTS]: number };

export interface MatchListing {
  id?: string;
  title: string;
  description?: string;
  category: Category;
  wantedCategories: Category[];
  wantedText?: string | null;
  estimatedValue?: number | null;
  cashFlexibility: CashFlexibility;
  exchangeMethods: ExchangeMethod[];
  lat?: number | null;
  lng?: number | null;
}
export interface Viewer {
  wantedCategories: Category[];
  wantedText: string[]; // free-text wants from the viewer's listings
  listings: MatchListing[]; // viewer's active items they could offer
  lat?: number | null;
  lng?: number | null;
  maxDistanceKm?: number | null;
}
export interface MatchResult { score: number; signals: { wanted: number; mutual: number; value: number; proximity: number }; reasons: string[] }

const STOP = new Set(['the', 'and', 'for', 'with', 'new', 'old', 'any', 'a', 'an', 'of', 'to', 'in', 'on', 'my', 'looking', 'want', 'wanted']);
export const tokens = (s?: string | null) => (s ?? '').toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !STOP.has(t));
const overlap = (a: string[], b: string[]) => { const set = new Set(b); const hits = a.filter((t) => set.has(t)); return a.length ? new Set(hits).size / Math.min(new Set(a).size, 4) : 0; };

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = Math.PI / 180; const dLat = (lat2 - lat1) * r; const dLng = (lng2 - lng1) * r;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

export function scoreMatch(viewer: Viewer, c: MatchListing, w: MatchWeights = MATCH_WEIGHTS): MatchResult {
  const reasons: string[] = [];

  // 1. Does the candidate match something the viewer wants?
  let wanted = 0;
  if (viewer.wantedCategories.includes(c.category)) { wanted += 0.7; reasons.push(`Matches a category you want`); }
  const kw = Math.min(1, overlap(viewer.wantedText, tokens(`${c.title} ${c.description ?? ''}`)));
  if (kw > 0) { wanted += 0.3 * kw; reasons.push('Matches what you said you are looking for'); }
  wanted = Math.min(1, wanted);

  // 2. Would the candidate's owner want something the viewer has?
  let mutual = 0; let mutualWith: string | undefined;
  for (const mine of viewer.listings) {
    let s = 0;
    if (c.wantedCategories.includes(mine.category)) s += 0.6;
    const k = overlap(tokens(c.wantedText), tokens(mine.title));
    s += 0.4 * Math.min(1, k);
    if (s > mutual) { mutual = s; mutualWith = mine.title; }
  }
  if (mutual >= 0.4 && mutualWith) reasons.push(`Owner may want your “${mutualWith}”`);

  // 3. Value compatibility (owner estimates are uncertain; cash flexibility can bridge gaps).
  let value = 0.5;
  const cv = c.estimatedValue ?? null;
  const mine = viewer.listings.map((l) => l.estimatedValue).filter((v): v is number => v != null && v > 0);
  if (cv && cv > 0 && mine.length) {
    value = Math.max(...mine.map((v) => Math.min(v, cv) / Math.max(v, cv)));
    if (value < 1 && c.cashFlexibility !== 'NONE') value = Math.min(1, value + 0.3);
    if (value >= 0.7) reasons.push('Similar estimated value');
    else if (c.cashFlexibility !== 'NONE') reasons.push('Open to adding cash to even things out');
  }

  // 4. Handover / distance.
  let proximity = 0.5;
  if (c.exchangeMethods.includes('SHIPPING')) { proximity = 0.6; reasons.push('Can be shipped'); }
  if (c.exchangeMethods.includes('LOCAL_HANDOVER') && viewer.lat != null && viewer.lng != null && c.lat != null && c.lng != null) {
    const km = haversineKm(viewer.lat, viewer.lng, c.lat, c.lng);
    const near = km <= 10 ? 1 : km <= 50 ? 0.75 : km <= 200 ? 0.4 : 0.2;
    const withinPref = viewer.maxDistanceKm == null || km <= viewer.maxDistanceKm;
    proximity = Math.max(proximity, withinPref ? near : near * 0.5);
    if (km <= 50) reasons.push('Close to you');
  }

  const score = w.wanted * wanted + w.mutual * mutual + w.value * value + w.proximity * proximity;
  return { score: Math.round(score * 1000) / 1000, signals: { wanted, mutual, value, proximity }, reasons };
}
