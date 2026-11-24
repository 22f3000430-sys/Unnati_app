import type { TailRoomPolicy } from '../types/seating.ts';

export interface TailStrategyDetail {
  id: TailRoomPolicy;
  label: string;
  shortLabel: string;
  summary: string;
  howItWorks: string;
  roomAndInvigilatorImpact: string;
  separationRule: string;
}

export const TAIL_STRATEGY_DETAILS: TailStrategyDetail[] = [
  {
    id: 'smart_tail_absorb',
    label: 'Smart Tail Absorb (Same Class)',
    shortLabel: 'Smart Same-Class',
    summary:
      'Minimizes rooms strictly within the same class using best-fit room sizes, balanced sharing, and single-room relocation.',
    howItWorks:
      'Picks optimal room-capacity sets and rebalances <22 or <60% rooms inside the same class & gender—never mixes Class 10 with 12.',
    roomAndInvigilatorImpact: 'Max same-class savings',
    separationRule: '10 & 12 separate · Boys & Girls separate',
  },
  {
    id: 'rebalance_only',
    label: 'Same-Cohort Subset Lookahead',
    shortLabel: 'Cohort Lookahead',
    summary:
      'Chooses tighter room combinations per cohort without rebalancing full rooms.',
    howItWorks:
      'Swaps oversized rooms for tighter next-floor single halls inside the same class & gender.',
    roomAndInvigilatorImpact: 'Balanced savings',
    separationRule: '10 & 12 separate · Boys & Girls separate',
  },
  {
    id: 'cross_class_tail',
    label: 'Cross-Class Tail Absorb (10+12)',
    shortLabel: 'Cross-Class Mix',
    summary:
      'Allows small Class 10 and Class 12 same-gender tails to share one room when spare halls are scarce.',
    howItWorks:
      'Absorbs tiny 1–6 student tails and merges <22 / <60% same-gender Class 10 + 12 rooms into 1 hall.',
    roomAndInvigilatorImpact: 'Extra savings on tight shifts',
    separationRule: '10 & 12 may share tails · Boys & Girls separate',
  },
  {
    id: 'buffer_gender_merge',
    label: 'Buffer Column Gender Merge',
    shortLabel: 'Buffer Gender',
    summary:
      'Seats a tiny Girls tail and tiny Boys tail in one room divided by an empty bench column.',
    howItWorks:
      'Girls sit on left columns, Boys on right columns, separated by 1 completely empty column.',
    roomAndInvigilatorImpact: 'Merges twin tiny gender tails',
    separationRule: 'Empty column divider · Same-class preferred',
  },
  {
    id: 'strict_separate',
    label: 'Strict Separate',
    shortLabel: 'Strict Separate',
    summary:
      'Keeps every class and gender strictly isolated floor-by-floor with no cross absorption.',
    howItWorks:
      'Fills each cohort independently while still moving <22 / <60% cohorts to tighter single halls.',
    roomAndInvigilatorImpact: 'Standard UP Board room count',
    separationRule: 'Absolute class & gender separation',
  },
];
