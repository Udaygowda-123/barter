/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose, { Schema, Types } from 'mongoose';

const oid = Schema.Types.ObjectId;
const mixed = Schema.Types.Mixed;
const now = () => new Date();
const model = (name: string, schema: Schema<any>): mongoose.Model<any> => (mongoose.models[name] as mongoose.Model<any>) ?? mongoose.model(name, schema);
type Id = Types.ObjectId;

const preference = new Schema<any>({
  interests: { type: [String], default: [] }, wantedCategories: { type: [String], default: [] },
  locationConsent: { type: Boolean, default: false }, maxDistanceKm: { type: Number, default: null }, onboardedAt: { type: Date, default: null },
}, { _id: false });

export interface UserDoc { _id: Id; email: string; passwordHash: string; displayName: string; bio: string | null; avatarUrl: string | null; role: 'USER' | 'MODERATOR' | 'ADMIN'; status: 'ACTIVE' | 'RESTRICTED' | 'SUSPENDED'; locationCity: string | null; locationRegion: string | null; locationLat: number | null; locationLng: number | null; emailVerifiedAt: Date | null; createdAt: Date; preference: { interests: string[]; wantedCategories: string[]; locationConsent: boolean; maxDistanceKm: number | null; onboardedAt: Date | null } }
export const User = model('User', new Schema<any>({
  email: { type: String, required: true, unique: true }, passwordHash: { type: String, required: true }, displayName: { type: String, required: true },
  bio: { type: String, default: null }, avatarUrl: { type: String, default: null }, role: { type: String, default: 'USER' }, status: { type: String, default: 'ACTIVE' },
  locationCity: { type: String, default: null }, locationRegion: { type: String, default: null }, locationLat: { type: Number, default: null }, locationLng: { type: Number, default: null },
  emailVerifiedAt: { type: Date, default: null }, createdAt: { type: Date, default: now }, preference: { type: preference, default: () => ({}) },
}));

export const RefreshToken = model('RefreshToken', new Schema<any>({
  userId: { type: oid, index: true }, tokenHash: { type: String, unique: true }, familyId: { type: String, index: true }, expiresAt: { type: Date, index: { expires: 0 } }, revokedAt: { type: Date, default: null },
}));
export const PasswordResetToken = model('PasswordResetToken', new Schema<any>({
  userId: oid, tokenHash: { type: String, unique: true }, expiresAt: { type: Date, index: { expires: 0 } }, usedAt: { type: Date, default: null },
}));

export interface ListingDoc { _id: Id; ownerId: Id; title: string; description: string; category: string; condition: string; estimatedValue: number | null; currency: string; wantedText: string | null; wantedCategories: string[]; cashFlexibility: string; exchangeMethods: string[]; locationCity: string | null; locationRegion: string | null; locationLat: number | null; locationLng: number | null; status: 'ACTIVE' | 'RESERVED' | 'EXCHANGED' | 'REMOVED' | 'UNDER_REVIEW'; isSeedData: boolean; createdAt: Date; updatedAt: Date }
export const Listing = model('Listing', new Schema<any>({
  ownerId: { type: oid, required: true }, title: String, description: String, category: String, condition: String, estimatedValue: { type: Number, default: null }, currency: { type: String, default: 'INR' },
  wantedText: { type: String, default: null }, wantedCategories: { type: [String], default: [] }, cashFlexibility: { type: String, default: 'NONE' }, exchangeMethods: { type: [String], default: [] },
  locationCity: { type: String, default: null }, locationRegion: { type: String, default: null }, locationLat: { type: Number, default: null }, locationLng: { type: Number, default: null },
  status: { type: String, default: 'ACTIVE' }, isSeedData: { type: Boolean, default: false }, createdAt: { type: Date, default: now }, updatedAt: { type: Date, default: now },
}).index({ status: 1, category: 1, _id: -1 }).index({ status: 1, _id: -1 }).index({ ownerId: 1, status: 1, _id: -1 }));

export interface ImageDoc { _id: Id; listingId: Id | null; uploaderId: Id; originalKey: string; enhancedKey: string | null; thumbKey: string | null; useEnhanced: boolean; aiEdited: boolean; isCover: boolean; position: number; altText: string | null; width: number | null; height: number | null; processingStatus: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED'; processingError: string | null; createdAt: Date }
export const Image = model('Image', new Schema<any>({
  listingId: { type: oid, default: null, index: true }, uploaderId: { type: oid, index: true }, originalKey: String, enhancedKey: { type: String, default: null }, thumbKey: { type: String, default: null },
  useEnhanced: { type: Boolean, default: false }, aiEdited: { type: Boolean, default: false }, isCover: { type: Boolean, default: false }, position: { type: Number, default: 0 },
  altText: { type: String, default: null }, width: { type: Number, default: null }, height: { type: Number, default: null }, processingStatus: { type: String, default: 'READY' }, processingError: { type: String, default: null }, createdAt: { type: Date, default: now },
}));

const pair = (name: string) => model(name, new Schema<any>({ userId: oid, listingId: oid, createdAt: { type: Date, default: now } }).index({ userId: 1, listingId: 1 }, { unique: true }));
export const Favorite = pair('Favorite');
export const Dismissal = pair('Dismissal');

export interface RevisionDoc { number: number; authorId: Id; cashAmount: number; currency: string; cashPayerId: Id | null; message: string | null; offeredListingIds: Id[]; requestedListingIds: Id[]; createdAt: Date }
export interface OfferDoc { _id: Id; targetListingId: Id; senderId: Id; recipientId: Id; status: 'PENDING' | 'COUNTERED' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN' | 'EXPIRED'; open: boolean; version: number; latestRevisionNo: number; acceptedRevisionNo: number | null; expiresAt: Date; conversationId: Id | null; dealId: Id | null; createdAt: Date; updatedAt: Date; revisions: RevisionDoc[] }
const revision = new Schema<any>({ number: Number, authorId: oid, cashAmount: { type: Number, default: 0 }, currency: { type: String, default: 'INR' }, cashPayerId: { type: oid, default: null }, message: { type: String, default: null }, offeredListingIds: [oid], requestedListingIds: [oid], createdAt: { type: Date, default: now } }, { _id: false });
export const Offer = model('Offer', new Schema<any>({
  targetListingId: oid, senderId: { type: oid, index: true }, recipientId: { type: oid, index: true }, status: { type: String, default: 'PENDING' }, open: { type: Boolean, default: true },
  version: { type: Number, default: 1 }, latestRevisionNo: { type: Number, default: 1 }, acceptedRevisionNo: { type: Number, default: null }, expiresAt: Date,
  conversationId: { type: oid, default: null }, dealId: { type: oid, default: null }, createdAt: { type: Date, default: now }, updatedAt: { type: Date, default: now }, revisions: [revision],
}).index({ senderId: 1, targetListingId: 1 }, { unique: true, partialFilterExpression: { open: true } }).index({ status: 1, expiresAt: 1 }));

export interface ConversationDoc { _id: Id; offerId: Id | null; listingId: Id | null; members: { userId: Id; lastReadAt: Date }[]; lastMessage: { senderId: Id | null; type: string; content: string; createdAt: Date } | null; createdAt: Date; updatedAt: Date }
export const Conversation = model('Conversation', new Schema<any>({
  offerId: { type: oid, default: null }, listingId: { type: oid, default: null }, members: [new Schema<any>({ userId: oid, lastReadAt: { type: Date, default: now } }, { _id: false })],
  lastMessage: { type: new Schema<any>({ senderId: { type: oid, default: null }, type: String, content: String, createdAt: Date }, { _id: false }), default: null },
  createdAt: { type: Date, default: now }, updatedAt: { type: Date, default: now },
}).index({ 'members.userId': 1, updatedAt: -1 }));

export interface MessageDoc { _id: Id; conversationId: Id; senderId: Id | null; type: 'TEXT' | 'OFFER_CARD' | 'SYSTEM'; content: string; offerId: Id | null; revisionNumber: number | null; attachmentIds: Id[]; clientId: string | null; createdAt: Date }
export const Message = model('Message', new Schema<any>({
  conversationId: oid, senderId: { type: oid, default: null }, type: { type: String, default: 'TEXT' }, content: String, offerId: { type: oid, default: null }, revisionNumber: { type: Number, default: null },
  attachmentIds: [oid], clientId: { type: String, default: null }, createdAt: { type: Date, default: now },
}).index({ conversationId: 1, _id: 1 }).index({ conversationId: 1, senderId: 1, clientId: 1 }, { unique: true, partialFilterExpression: { clientId: { $type: 'string' } } }));

export interface DealDoc { _id: Id; offerId: Id; acceptedRevisionNo: number; userAId: Id; userBId: Id; listingIds: Id[]; status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED'; handoverMethod: string | null; handoverNotes: string | null; handoverConfirmedByA: Date | null; handoverConfirmedByB: Date | null; completedByA: Date | null; completedByB: Date | null; cancelledById: Id | null; cancelReason: string | null; disputedById: Id | null; disputeReason: string | null; completedAt: Date | null; createdAt: Date; lockVersion: number }
export const Deal = model('Deal', new Schema<any>({
  offerId: { type: oid, unique: true }, acceptedRevisionNo: Number, userAId: { type: oid, index: true }, userBId: { type: oid, index: true }, listingIds: [oid], status: { type: String, default: 'ACTIVE' },
  handoverMethod: { type: String, default: null }, handoverNotes: { type: String, default: null }, handoverConfirmedByA: { type: Date, default: null }, handoverConfirmedByB: { type: Date, default: null },
  completedByA: { type: Date, default: null }, completedByB: { type: Date, default: null }, cancelledById: { type: oid, default: null }, cancelReason: { type: String, default: null },
  disputedById: { type: oid, default: null }, disputeReason: { type: String, default: null }, completedAt: { type: Date, default: null }, createdAt: { type: Date, default: now }, lockVersion: { type: Number, default: 0 },
}));
/** One row per listing locked by an active deal. The unique index is the database-level "no two active deals per item" guarantee. */
export const ListingLock = model('ListingLock', new Schema<any>({ listingId: { type: oid, unique: true }, dealId: oid }));

export const EmailVerifyToken = model('EmailVerifyToken', new Schema<any>({
  userId: { type: oid, index: true }, tokenHash: { type: String, unique: true }, expiresAt: { type: Date, index: { expires: 0 } }, usedAt: { type: Date, default: null },
}));

export const Review = model('Review', new Schema<any>({
  dealId: oid, authorId: oid, subjectId: { type: oid, index: true }, rating: { type: Number, min: 1, max: 5 }, body: { type: String, default: null }, createdAt: { type: Date, default: now },
}).index({ dealId: 1, authorId: 1 }, { unique: true }));

export const Notification = model('Notification', new Schema<any>({
  userId: oid, type: String, payload: mixed, dedupeKey: { type: String, default: null }, readAt: { type: Date, default: null }, createdAt: { type: Date, default: now },
}).index({ userId: 1, createdAt: -1 }).index({ userId: 1, dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } }));

export const Report = model('Report', new Schema<any>({
  reporterId: oid, targetType: String, targetId: String, reason: String, details: { type: String, default: null }, status: { type: String, default: 'OPEN' }, resolvedById: { type: oid, default: null }, resolution: { type: String, default: null }, createdAt: { type: Date, default: now }, resolvedAt: Date,
}).index({ status: 1, createdAt: 1 }));
export const Block = model('Block', new Schema<any>({ blockerId: oid, blockedId: oid, createdAt: { type: Date, default: now } }).index({ blockerId: 1, blockedId: 1 }, { unique: true }).index({ blockedId: 1 }));
export const ProhibitedTerm = model('ProhibitedTerm', new Schema<any>({ term: { type: String, unique: true }, reason: { type: String, default: null }, createdAt: { type: Date, default: now } }));
export const AuditLog = model('AuditLog', new Schema<any>({
  actorId: { type: oid, default: null }, action: String, targetType: { type: String, default: null }, targetId: { type: String, default: null }, meta: mixed, createdAt: { type: Date, default: now },
}).index({ createdAt: -1 }));
export const IdempotencyKey = model('IdempotencyKey', new Schema<any>({
  userId: oid, key: String, route: String, statusCode: Number, response: mixed, createdAt: { type: Date, default: now, index: { expires: 172800 } },
}).index({ userId: 1, key: 1, route: 1 }, { unique: true }));
/** Serverless-safe rate limiting: counters live in the database, not in process memory. */
export const RateLimit = model('RateLimit', new Schema<any>({ key: { type: String, unique: true }, count: Number, resetAt: { type: Date, index: { expires: 0 } } }));
export { Types };
