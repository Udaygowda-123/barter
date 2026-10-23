import { BookOpen, Footprints, Gamepad2, Gem, Headphones, Lamp, Palette, Shapes, Shirt, type LucideIcon } from 'lucide-react';
import type { Category } from '@/shared/types';

export const CATEGORY_ICON: Record<Category, LucideIcon> = {
  FASHION: Shirt, SNEAKERS: Footprints, ELECTRONICS: Headphones, GAMING: Gamepad2, COLLECTIBLES: Gem, BOOKS: BookOpen, HOBBIES: Palette, HOME: Lamp, OTHER: Shapes,
};
