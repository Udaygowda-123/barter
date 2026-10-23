import type { Category, CashFlexibility, Condition, ExchangeMethod, ListingStatus, OfferStatus, DealStatus } from '@/shared/types';

export interface ImageDto {
  id: string; url: string; thumbUrl: string | null; originalUrl: string; enhancedUrl: string | null;
  isCover: boolean; position: number; status: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED'; error: string | null;
  aiEdited: boolean; useEnhanced: boolean; altText: string | null; width: number | null; height: number | null;
}
export interface UserBrief { id: string; displayName: string; avatarUrl: string | null }
export interface Listing {
  id: string; ownerId: string; title: string; description: string; category: Category; condition: Condition;
  estimatedValue: number | null; currency: string; wantedText: string | null; wantedCategories: Category[];
  cashFlexibility: CashFlexibility; exchangeMethods: ExchangeMethod[]; locationCity: string | null; locationRegion: string | null;
  status: ListingStatus; isSeedData: boolean; createdAt: string; images: ImageDto[]; isOwner: boolean; favorited?: boolean;
  owner: UserBrief & { locationCity: string | null; locationRegion: string | null; verified: boolean };
  match?: { score: number; reasons: string[] } | null; related?: Listing[];
}
export interface Page<T> { items: T[]; pageInfo: { nextCursor: string | null } }
export interface ListingBrief { id: string; title: string; status: ListingStatus; ownerId: string; category: Category; estimatedValue: number | null; thumbUrl: string | null }
export interface Revision {
  id: string; number: number; authorId: string; cashAmount: number; currency: string; cashPayerId: string | null; message: string | null; createdAt: string;
  offered: ListingBrief[]; requested: ListingBrief[];
}
export interface Offer {
  id: string; status: OfferStatus; version: number; expiresAt: string; createdAt: string; updatedAt: string;
  sender: UserBrief; recipient: UserBrief; targetListing: ListingBrief; awaitingUserId: string | null; yourTurn: boolean;
  conversationId: string | null; deal: { id: string; status: DealStatus } | null; acceptedRevisionId: string | null; revisions: Revision[];
}
export interface Deal {
  id: string; offerId: string; status: DealStatus; createdAt: string; completedAt: string | null; conversationId: string | null; counterpart: UserBrief;
  terms: { revisionNumber: number; cashAmount: number; currency: string; cashPayerId: string | null; message: string | null; giving: ListingBrief[]; receiving: ListingBrief[] };
  handover: { method: ExchangeMethod | null; notes: string | null; confirmedByMe: boolean; confirmedByOther: boolean };
  completion: { confirmedByMe: boolean; confirmedByOther: boolean };
  cancellation: { byMe: boolean; reason: string | null } | null; dispute: { byMe: boolean; reason: string | null } | null;
  reviews: { mine: Review | null; theirs: Review | null; canReview: boolean };
}
export interface Review { id: string; rating: number; body: string | null; createdAt: string; author?: UserBrief }
export interface Message {
  offerStatus?: OfferStatus; isCurrentRevision?: boolean; yourTurn?: boolean; dealId?: string | null;
  id: string; conversationId: string; type: 'TEXT' | 'OFFER_CARD' | 'SYSTEM'; content: string; clientId: string | null; createdAt: string;
  sender: UserBrief | null; attachments: ImageDto[];
  offerRevision: null | { id: string; number: number; offerId: string; authorId: string; cashAmount: number; currency: string; cashPayerId: string | null; message: string | null; items: { role: 'OFFERED' | 'REQUESTED'; listing: { id: string; title: string; ownerId: string; estimatedValue: number | null; thumbUrl: string | null } }[] };
}
export interface ConversationSummary {
  id: string; updatedAt: string; unreadCount: number; participants: UserBrief[];
  lastMessage: { content: string; type: string; createdAt: string; senderId: string | null } | null;
  offer: { id: string; status: OfferStatus } | null; listing: { id: string; title: string; thumbUrl: string | null } | null;
}
export interface NotificationDto { id: string; type: string; payload: Record<string, unknown>; readAt: string | null; createdAt: string }
export interface Me {
  id: string; email: string; displayName: string; bio: string | null; avatarUrl: string | null; role: 'USER' | 'MODERATOR' | 'ADMIN'; status: string; emailVerifiedAt: string | null;
  locationCity: string | null; locationRegion: string | null; locationLat: number | null; locationLng: number | null;
  preference: { interests: string[]; wantedCategories: Category[]; locationConsent: boolean; maxDistanceKm: number | null; onboardedAt: string | null } | null;
}
export interface PublicProfile {
  id: string; displayName: string; bio: string | null; avatarUrl: string | null; locationCity: string | null; locationRegion: string | null; createdAt: string; verified: boolean;
  stats: { completedSwaps: number; activeListings: number; reviewCount: number; averageRating: number | null };
}
