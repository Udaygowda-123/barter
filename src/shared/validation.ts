import { z } from 'zod';
import { CATEGORIES, CONDITIONS, EXCHANGE_METHODS, CASH_FLEXIBILITY } from './types';

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(10, 'Use at least 10 characters').max(128),
  displayName: text(2, 40),
});
export const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(128) });
export const refreshSchema = z.object({ refreshToken: z.string().min(20) });
export const forgotPasswordSchema = z.object({ email: z.string().trim().toLowerCase().email() });
export const resetPasswordSchema = z.object({ token: z.string().min(20), password: z.string().min(10).max(128) });

export const updateProfileSchema = z.object({
  displayName: text(2, 40).optional(),
  bio: z.string().trim().max(300).nullable().optional(),
  avatarUrl: z.string().url().max(500).nullable().optional(),
  locationCity: text(1, 80).nullable().optional(),
  locationRegion: text(1, 80).nullable().optional(),
  locationLat: z.number().min(-90).max(90).nullable().optional(),
  locationLng: z.number().min(-180).max(180).nullable().optional(),
  locationConsent: z.boolean().optional(),
  interests: z.array(text(1, 30)).max(20).optional(),
  wantedCategories: z.array(z.enum(CATEGORIES)).max(9).optional(),
  maxDistanceKm: z.number().int().min(1).max(20000).nullable().optional(),
  completeOnboarding: z.boolean().optional(),
});

export const createListingSchema = z.object({
  title: text(3, 80),
  description: text(10, 2000),
  category: z.enum(CATEGORIES),
  condition: z.enum(CONDITIONS),
  estimatedValue: z.number().int().min(0).max(10_000_000).nullable().optional(),
  wantedText: z.string().trim().max(300).nullable().optional(),
  wantedCategories: z.array(z.enum(CATEGORIES)).max(9).default([]),
  cashFlexibility: z.enum(CASH_FLEXIBILITY).default('NONE'),
  exchangeMethods: z.array(z.enum(EXCHANGE_METHODS)).min(1, 'Pick at least one exchange method'),
  imageIds: z.array(z.string()).min(1, 'Add at least one photo').max(8),
  coverImageId: z.string().optional(),
});
export const updateListingSchema = createListingSchema.partial();

export const listingQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.enum(CATEGORIES).optional(),
  condition: z.enum(CONDITIONS).optional(),
  minValue: z.coerce.number().int().min(0).optional(),
  maxValue: z.coerce.number().int().min(0).optional(),
  ownerId: z.string().optional(),
  city: z.string().trim().max(80).optional(),
  status: z.enum(['ACTIVE', 'RESERVED', 'EXCHANGED']).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const offerTerms = {
  offeredListingIds: z.array(z.string()).max(5).default([]),
  requestedListingIds: z.array(z.string()).min(1).max(5),
  cashAmount: z.number().int().min(0).max(10_000_000).default(0),
  currency: z.literal('INR').default('INR'),
  // Who proposes to pay the difference: the author of this revision, or the counterpart.
  cashPayer: z.enum(['ME', 'THEM']).default('ME'),
  message: z.string().trim().max(500).optional(),
};
export const createOfferSchema = z
  .object(offerTerms)
  .refine((o) => o.offeredListingIds.length > 0 || o.cashAmount > 0, { message: 'Offer at least one item or a cash amount', path: ['offeredListingIds'] });
export const counterOfferSchema = z
  .object({ ...offerTerms, expectedVersion: z.number().int().min(1) })
  .refine((o) => o.offeredListingIds.length > 0 || o.cashAmount > 0, { message: 'Offer at least one item or a cash amount', path: ['offeredListingIds'] });
export const offerActionSchema = z.object({ expectedVersion: z.number().int().min(1) });
/** Accepting names the exact revision being accepted, so a late counter can never be accepted by accident. */
export const acceptOfferSchema = z.object({ expectedVersion: z.number().int().min(1), revisionNumber: z.number().int().min(1) });

export const sendMessageSchema = z.object({
  content: text(1, 2000),
  clientId: z.string().min(8).max(64).optional(),
  attachmentKeys: z.array(z.string().max(300)).max(4).default([]),
});

export const handoverSchema = z.object({
  method: z.enum(EXCHANGE_METHODS),
  notes: z.string().trim().max(500).optional(),
});
export const cancelDealSchema = z.object({ reason: text(3, 300) });
export const disputeDealSchema = z.object({ reason: text(10, 500) });

export const createReviewSchema = z.object({ rating: z.number().int().min(1).max(5), body: z.string().trim().max(500).optional() });

export const createReportSchema = z.object({
  targetType: z.enum(['LISTING', 'USER', 'MESSAGE']),
  targetId: z.string().min(1),
  reason: text(3, 100),
  details: z.string().trim().max(1000).optional(),
});

export const resolveReportSchema = z.object({
  action: z.enum(['DISMISS', 'RESOLVE', 'REMOVE_LISTING', 'RESTRICT_USER', 'SUSPEND_USER']),
  note: z.string().trim().max(500).optional(),
});
export const restoreSchema = z.object({ note: z.string().trim().max(500).optional() });
export const prohibitedTermSchema = z.object({ term: text(2, 60), reason: z.string().trim().max(200).optional() });
export const enhanceSchema = z.object({ useEnhanced: z.boolean() });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateListingInput = z.infer<typeof createListingSchema>;
export type CreateOfferInput = z.infer<typeof createOfferSchema>;
export type CounterOfferInput = z.infer<typeof counterOfferSchema>;
export type CreateOfferFormInput = z.input<typeof createOfferSchema>;
export type CreateListingFormInput = z.input<typeof createListingSchema>;
