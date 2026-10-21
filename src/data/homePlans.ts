import Storage from './accountStorage';
import { groupPlansByDate, type SharedPlanSummary } from './sharedPlans';

export type HomePlanDismissals = Record<string, string>;
// Account storage namespaces this on each device. No prototype/account data mixes.
const key = 'nomNomGoHomePlanDismissalsV1';

export function homePlanVersion(plan: SharedPlanSummary) {
  return plan.homeUpdateKey || JSON.stringify([plan.title, plan.status, plan.dateStart,
    plan.dateEnd || plan.dateStart, plan.timeWindow || '', plan.locationLabel]);
}

export function upcomingHomePlans(plans: readonly SharedPlanSummary[], dismissed: HomePlanDismissals, now = new Date()) {
  return groupPlansByDate(plans, now).future.filter((plan) => dismissed[plan.id] !== homePlanVersion(plan));
}

export async function loadHomePlanDismissals(): Promise<HomePlanDismissals> {
  const raw = await Storage.getItem(key);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, value]) => typeof value === 'string'));
  } catch { return {}; }
}

export async function dismissHomePlan(plan: SharedPlanSummary) {
  const dismissed = { ...await loadHomePlanDismissals(), [plan.id]: homePlanVersion(plan) };
  await Storage.setItem(key, JSON.stringify(dismissed));
  return dismissed;
}
