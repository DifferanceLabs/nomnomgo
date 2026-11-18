import { accountRequest, getAlphaAccount } from './accountStorage';
import { venueQuality, type Candidate, type VenueReview } from '../domain/starterOuting';

/** One explicit starter tap owns one review, including across preference edits and retries. */
export type ReviewTicket = { pending?: Promise<VenueReview[]> };
export function reviewStarter(ticket: ReviewTicket, candidates: Candidate[]) {
  if (!getAlphaAccount() || !candidates.length) return Promise.resolve([]);
  if (ticket.pending) return ticket.pending;
  const bySlot = (slot: 'food' | 'activity') =>
    candidates
      .filter((c) => c.slot === slot && !c.item.eventStartMs && /^[A-Za-z0-9_-]{5,200}$/.test(c.item.id))
      .sort((a, b) => venueQuality(b).score - venueQuality(a).score);
  const activity = bySlot('activity'),
    food = bySlot('food');
  // Include one ambiguous outdoor/landmark candidate: its detailed listing can reveal a real attraction.
  const ambiguous = activity.find((c) => !venueQuality(c).score);
  const ordered = [
    ...activity.slice(0, 3),
    ...(ambiguous ? [ambiguous] : []),
    ...food.slice(0, 2),
    ...activity,
    ...food,
  ];
  const seen = new Set<string>();
  const places = ordered
    .flatMap(({ item, slot }) => {
      if (seen.has(item.id)) return [];
      seen.add(item.id);
      return [{ id: item.id, slot }];
    })
    .slice(0, 6);
  if (!places.length) return Promise.resolve([]);
  ticket.pending = accountRequest<{ result: VenueReview[] }>({ action: 'starter.review', places })
    .then((response) => response.result)
    .catch(() => []);
  return ticket.pending;
}
