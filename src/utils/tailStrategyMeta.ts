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
    label: 'Smart Tail Absorb (Recommended)',
    shortLabel: 'Smart Tail Absorb',
    summary:
      'Minimizes open rooms and invigilators by choosing best-fit capacities, merging <22 / <60% rooms into next-floor single halls, and absorbing leftover 1–6 student tails into compatible empty benches.',
    howItWorks:
      'Runs capacity subset lookahead (e.g. 36+30 instead of 30+30+1), consolidates underfilled (<22 or <60%) cohorts without ever splitting into 2 rooms, and tucks tiny tails into empty same-gender desks of another class.',
    roomAndInvigilatorImpact: 'Maximum room savings (saves 2 invigilators per closed tail room).',
    separationRule:
      'Same-school zero orthogonal conflict and 1-seat gap rules remain 100% intact; boys and girls stay separated.',
  },
  {
    id: 'cross_class_tail',
    label: 'Cross-Class Same-Gender Absorb',
    shortLabel: 'Cross-Class Absorb',
    summary:
      'Absorbs small trailing batches of one class (Class 10 or Class 12) into compatible open seats of the other class sharing the same gender.',
    howItWorks:
      'Uses standard floor-by-floor filling first, then moves leftover same-gender tails and merges compatible <22 / <60% same-gender rooms across Class 10 & Class 12.',
    roomAndInvigilatorImpact: 'High savings whenever Class 10 and Class 12 both run in the same shift.',
    separationRule: 'Keeps boys and girls in separate rooms while allowing Class 10 + 12 sharing in tail rooms.',
  },
  {
    id: 'buffer_gender_merge',
    label: 'Buffer Column Gender Merge',
    shortLabel: 'Buffer Gender Merge',
    summary:
      'Runs Smart Tail Absorb first; if both a tiny Boys tail and a tiny Girls tail still remain, seats both in one room separated by an empty buffer column.',
    howItWorks:
      'Seats Girls on the left columns and Boys on the right columns with at least one completely empty desk column between them, avoiding two half-empty rooms.',
    roomAndInvigilatorImpact: 'Eliminates twin 1–6 student boys/girls tail rooms into 1 room (saves 2 invigilators).',
    separationRule: 'Physical empty bench column divider enforces strict Boys/Girls separation inside the merged room.',
  },
  {
    id: 'rebalance_only',
    label: 'Subset + Same-Cohort Rebalance',
    shortLabel: 'Rebalance Same-Cohort',
    summary:
      'Optimizes room sizes and next-floor single-room fits strictly within the exact same class and gender cohort.',
    howItWorks:
      'Replaces poor room sequences with better fitting room combinations (same or next floor) without cross-mixing Class 10/12 or Boys/Girls.',
    roomAndInvigilatorImpact: 'Moderate room savings while preserving strict cohort boundaries.',
    separationRule: 'Zero cross-class and zero cross-gender mixing.',
  },
  {
    id: 'strict_separate',
    label: 'Strict Separate (No Cross Mix)',
    shortLabel: 'Strict Separate',
    summary:
      'Keeps every class and gender strictly isolated even when a trailing room ends up with only 1–5 students.',
    howItWorks:
      'Disables cross-class tail absorption and gender buffer merges; still avoids unnecessary 2-room splits and prefers tighter single rooms.',
    roomAndInvigilatorImpact: 'May require extra rooms and 2 invigilators per trailing tail batch.',
    separationRule: 'Absolute class and gender separation across every room.',
  },
];
