export const labels: Record<string, string>;
export function venueFacts(
  slot: 'food' | 'activity',
  place: {
    types?: string[];
    primaryType?: string;
    businessStatus?: string;
    eventStartMs?: number;
    editorialSummary?: { text?: string };
    liveMusic?: boolean;
    dineIn?: boolean;
    rating?: number;
    ratingCount?: number;
    userRatingCount?: number;
  },
): { features: string[]; quality: number; stars: number; confidence: number };
