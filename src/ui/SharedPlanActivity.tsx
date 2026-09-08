import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getAlphaAccount } from '../data/accountStorage';
import { startForegroundRefresh } from '../data/foregroundRefresh';
import { changedSharedRsvps, listSharedPlans, type SharedPlanSummary } from '../data/sharedPlans';
import { RsvpSummary } from './RsvpSummary';
import { ActionButton } from './primitives';

// Home shows recent shared responses; personal copies link to the canonical
// workspace so prototype state cannot be mistaken for another person's RSVP.
export function SharedPlanActivity({ onOpenPlan }: { onOpenPlan: (id?: string) => void }) {
  const accountId = getAlphaAccount()?.id;
  const [plans, setPlans] = useState<SharedPlanSummary[]>([]);
  const previous = useRef<SharedPlanSummary[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const refresh = useRef(() => {});
  useEffect(() => {
    if (!accountId) return;
    let active = true;
    const poller = startForegroundRefresh(async () => {
      try {
        const incoming = await listSharedPlans();
        if (!active) return;
        const changes = incoming.flatMap((plan) => changedSharedRsvps(previous.current.find((old) => old.id === plan.id) || null, plan, accountId)
          .map((change) => `${plan.title} · ${change}`));
        previous.current = incoming; setPlans(incoming); setError('');
        if (changes.length) setNotice(`RSVP updated · ${changes.join(' · ')}`);
      } catch (failure) {
        if (!active) return;
        setError('Shared responses could not be refreshed. Retry to see the latest RSVPs.');
        const status = (failure as { status?: number })?.status;
        if (status && [401, 403, 404].includes(status)) { previous.current = []; setPlans([]); setNotice(''); }
      }
    });
    refresh.current = poller.refresh;
    return () => { active = false; poller.stop(); };
  }, [accountId]);
  if (!accountId || (!plans.length && !error)) return null;
  return <View style={styles.panel}>
    <Text style={styles.title}>Plan updates</Text>
    {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}
    {error ? <><Text accessibilityRole="alert" style={styles.copy}>{error}</Text><ActionButton label="Refresh RSVPs" onPress={() => refresh.current()} size="compact" /></> : null}
    {plans.slice(0, 3).map((plan) => <TouchableOpacity style={styles.plan} key={plan.id} accessibilityRole="button" accessibilityLabel={`Open responses for ${plan.title}`} onPress={() => onOpenPlan(plan.id)}>
      <Text style={styles.copy}>{plan.title}</Text>
      <RsvpSummary participants={plan.participants} />
    </TouchableOpacity>)}
    {plans.length > 3 ? <ActionButton label="View all shared plans" onPress={() => onOpenPlan()} size="compact" /> : null}
  </View>;
}

const styles = StyleSheet.create({
  panel: { backgroundColor: '#18212b', borderRadius: 16, padding: 16, gap: 12 },
  title: { color: '#f5f7fa', fontSize: 17, fontWeight: '700' },
  copy: { color: '#d7e0e9', fontSize: 15, lineHeight: 21 },
  notice: { color: '#8fe0d3', fontSize: 14, lineHeight: 21 },
  hint: { color: '#a8b2bf', fontSize: 12 }, plan: { gap: 8 },
});
