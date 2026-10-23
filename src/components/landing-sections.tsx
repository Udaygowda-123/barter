'use client';
import { Categories, HowItWorks, MotionRoot, SwapShowcase, Trust } from './landing';

export default function Sections() {
  return <MotionRoot><HowItWorks /><SwapShowcase /><Categories /><Trust /></MotionRoot>;
}
