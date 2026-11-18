import type { Intent } from './planStarters';
import type { AreaLocation } from './searchArea';
import { isInsideSearchArea } from './searchArea';
import type { SearchExecution } from './searchExecution';
import type { Candidate, StarterPlace, StarterSlot } from './starterOuting';

type Sources = Partial<Record<StarterSlot, () => Promise<StarterPlace[]>>>;

/** Preview searches share provider adapters but never publish into the discovery screen. */
export async function starterCandidates(
  intent: Intent,
  center: AreaLocation,
  execution: SearchExecution,
  sources: Sources,
  allowed: (slot: StarterSlot, place: StarterPlace) => boolean,
) {
  const slots = (['food', 'activity'] as const).filter((slot) => intent === 'both' || slot === intent);
  const batches = await Promise.allSettled(slots.map((slot) => sources[slot]?.() ?? Promise.resolve([])));
  execution.check();
  if (batches.every((batch) => batch.status === 'rejected')) throw new Error('Place search unavailable.');
  const candidates: Candidate[] = [];
  batches.forEach((batch, index) => {
    if (batch.status !== 'fulfilled') return;
    const slot = slots[index];
    const seen = new Set<string>();
    for (const item of batch.value) {
      if (
        !item.id ||
        !item.title ||
        seen.has(item.id) ||
        !isInsideSearchArea(center, item) ||
        !allowed(slot, item)
      )
        continue;
      seen.add(item.id);
      candidates.push({ slot, item });
    }
  });
  return candidates;
}
