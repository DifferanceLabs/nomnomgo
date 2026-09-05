import { accountRequest } from './accountStorage';
import type { Plan, PlanParticipant } from '../domain/plan';

export type SharedPlan = Omit<Plan, 'participants'> & { revision: number; participants: (PlanParticipant & { joined: boolean })[] };
export type SharedPlanDraft = Pick<Plan, 'title' | 'intent' | 'locationLabel' | 'dateStart' | 'dateEnd' | 'timeWindow' | 'stops'>;
export type SharedPlanSummary = Pick<SharedPlan, 'id' | 'title' | 'status' | 'dateStart' | 'locationLabel' | 'ownerId'> & { rsvp?: string };

export async function createSharedPlan(sourceKey: string, details: SharedPlanDraft) {
  return (await accountRequest<{ plan: SharedPlan }>({ action: 'plan.create', sourceKey, details })).plan;
}
export async function getSharedPlan(planId: string) {
  return (await accountRequest<{ plan: SharedPlan }>({ action: 'plan.get', planId })).plan;
}
export async function listSharedPlans() {
  return (await accountRequest<{ plans: SharedPlanSummary[] }>({ action: 'plan.list' })).plans;
}
export async function changeSharedPlan(plan: SharedPlan, action: string, data: Record<string, unknown> = {}) {
  return (await accountRequest<{ plan: SharedPlan }>({ ...data, action, planId: plan.id, revision: plan.revision })).plan;
}

export function planIdFromUrl() {
  if (typeof window === 'undefined') return null;
  const id = new URLSearchParams(window.location.search).get('plan');
  return id && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}
export function sharedPlanUrl(id: string) {
  return typeof window !== 'undefined' ? `${window.location.origin}/?plan=${encodeURIComponent(id)}` : '';
}

// A late poll must never replace a more recent mutation response.
export function newerSharedPlan(current: SharedPlan | null, incoming: SharedPlan) {
  return current?.id === incoming.id && current.revision > incoming.revision ? current : incoming;
}
