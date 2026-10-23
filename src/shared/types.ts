export const CATEGORIES = ['FASHION','SNEAKERS','ELECTRONICS','GAMING','COLLECTIBLES','BOOKS','HOBBIES','HOME','OTHER'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  FASHION: 'Fashion', SNEAKERS: 'Sneakers', ELECTRONICS: 'Tech', GAMING: 'Gaming',
  COLLECTIBLES: 'Collectibles', BOOKS: 'Books', HOBBIES: 'Hobbies', HOME: 'Home', OTHER: 'Other',
};

export const CONDITIONS = ['NEW','LIKE_NEW','GOOD','FAIR','WORN'] as const;
export type Condition = (typeof CONDITIONS)[number];
export const CONDITION_LABELS: Record<Condition, string> = {
  NEW: 'New', LIKE_NEW: 'Like new', GOOD: 'Good', FAIR: 'Fair', WORN: 'Well worn',
};

export const EXCHANGE_METHODS = ['LOCAL_HANDOVER','SHIPPING'] as const;
export type ExchangeMethod = (typeof EXCHANGE_METHODS)[number];

export const CASH_FLEXIBILITY = ['NONE','WILL_ADD','WILL_ACCEPT','EITHER'] as const;
export type CashFlexibility = (typeof CASH_FLEXIBILITY)[number];

export type ListingStatus = 'ACTIVE'|'RESERVED'|'EXCHANGED'|'REMOVED'|'UNDER_REVIEW';
export type OfferStatus = 'PENDING'|'COUNTERED'|'ACCEPTED'|'REJECTED'|'WITHDRAWN'|'EXPIRED'|'CANCELLED';
export type DealStatus = 'ACTIVE'|'COMPLETED'|'CANCELLED'|'DISPUTED';

/** Explicit valid offer transitions. Anything not listed is rejected server-side. */
export const OFFER_TRANSITIONS: Record<OfferStatus, OfferStatus[]> = {
  PENDING: ['COUNTERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED', 'CANCELLED'],
  COUNTERED: ['PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED', 'CANCELLED'],
  ACCEPTED: [], REJECTED: [], WITHDRAWN: [], EXPIRED: [], CANCELLED: [], // CANCELLED = closed by the system (item removed / taken by another deal)
};
export const DEAL_TRANSITIONS: Record<DealStatus, DealStatus[]> = {
  ACTIVE: ['COMPLETED', 'CANCELLED', 'DISPUTED'],
  DISPUTED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [], CANCELLED: [],
};
export const canTransition = <S extends string>(table: Record<S, S[]>, from: S, to: S) => table[from].includes(to);

export const CASH_DISCLAIMER =
  'Cash amounts are negotiated proposals between you and the other person. SWAPD does not move money, hold funds in escrow, or guarantee item values.';
export const VALUE_DISCLAIMER = 'Estimated values are set by the owner and are not appraisals.';

// ─── API payload shapes shared with the web app ───
export interface PageInfo { nextCursor: string | null }
export interface Paginated<T> { items: T[]; pageInfo: PageInfo }
export interface ApiError { statusCode: number; code: string; message: string; details?: unknown }
