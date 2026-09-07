import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAlphaAccount } from '../data/accountStorage';
import { changeSharedPlan, changedSharedRsvps, createSharedPlan, getSharedPlan, listSharedPlans, newerSharedPlan, sharedPlanUrl, sharedRsvpLabel, sharedRsvpSummary, type SharedPlan, type SharedPlanDraft, type SharedPlanSummary } from '../data/sharedPlans';
import { startForegroundRefresh } from '../data/foregroundRefresh';
import { ActionButton as Button } from './primitives';
import { ShareMessage } from './ShareMessage';

const rsvps = [{ value: 'going', label: 'Going' }, { value: 'maybe', label: 'Maybe' }, { value: 'cant_make_it', label: "Can't make it" }];
const today = () => new Date().toISOString().slice(0, 10);
const emptyDraft = (): SharedPlanDraft => ({ title: '', intent: 'both', locationLabel: '', dateStart: today(), dateEnd: today(), timeWindow: '', stops: [] });
const requestId = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '';
const errorText = (error: unknown) => error instanceof Error ? error.message : 'The plan could not be reached. Please try again.';
const statusOf = (error: unknown) => (error as { status?: number })?.status;

export function SharedPlansScreen({ initialPlan, initialPlanId, onClose }: { initialPlan?: SharedPlan | null; initialPlanId?: string | null; onClose: () => void }) {
  const account = getAlphaAccount()!;
  const [selectedId, setSelectedId] = useState(initialPlan?.id || initialPlanId || '');
  const [plan, setPlan] = useState<SharedPlan | null>(initialPlan || null);
  const planRef = useRef(plan);
  const [plans, setPlans] = useState<SharedPlanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const refreshRef = useRef<() => void>(() => {});
  const [updated, setUpdated] = useState('');
  const [editing, setEditing] = useState(false);
  const [editBase, setEditBase] = useState<SharedPlan | null>(null);
  const [draft, setDraft] = useState<SharedPlanDraft>(emptyDraft);
  const sourceKey = useRef(`shared-${requestId()}`);
  const [inviteEmail, setInviteEmail] = useState('');
  const [preparedEmail, setPreparedEmail] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [slot, setSlot] = useState<'food' | 'activity'>('food');
  const suggestionKey = useRef(requestId());
  const owner = plan?.ownerId === account.id;
  const locked = plan?.status === 'locked';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (selectedId) url.searchParams.set('plan', selectedId); else url.searchParams.delete('plan');
    window.history.replaceState({}, '', url.toString());
  }, [selectedId]);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        if (selectedId) {
          const incoming = await getSharedPlan(selectedId);
          if (active) {
            const latest = newerSharedPlan(planRef.current, incoming);
            const changes = changedSharedRsvps(planRef.current, latest, account.id);
            planRef.current = latest; setPlan(latest);
            if (changes.length) setNotice(`RSVP updated · ${changes.join(' · ')}`);
          }
        } else {
          const incoming = await listSharedPlans();
          if (active) setPlans(incoming);
        }
        if (active) { setSyncError(''); setUpdated(new Date().toLocaleTimeString()); }
      } catch (error) {
        if (active) {
          setSyncError(errorText(error));
          if ([401, 403, 404].includes(statusOf(error) || 0)) { planRef.current = null; setPlan(null); setPlans([]); }
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    setLoading(true);
    const poller = startForegroundRefresh(refresh, { ready: () => !busyRef.current });
    refreshRef.current = poller.refresh;
    return () => {
      active = false; poller.stop();
    };
  }, [selectedId, account.id]);

  const mutate = async (action: string, data: Record<string, unknown> = {}, base = plan) => {
    if (!base || busyRef.current || syncError) return false;
    busyRef.current = true; setBusy(true); setNotice('');
    try {
      const incoming = await changeSharedPlan(base, action, data);
      planRef.current = newerSharedPlan(planRef.current, incoming); setPlan(planRef.current);
      setUpdated(new Date().toLocaleTimeString());
      if (action === 'plan.rsvp') setNotice(`RSVP saved: ${sharedRsvpLabel(String(data.rsvp))}. The organizer can see your response.`);
      return true;
    } catch (error) {
      setNotice(errorText(error));
      if ([401, 403, 404].includes(statusOf(error) || 0)) { setSyncError(errorText(error)); planRef.current = null; setPlan(null); }
      return false;
    } finally { busyRef.current = false; setBusy(false); refreshRef.current(); }
  };
  const openPlan = (id: string) => { planRef.current = null; setPlan(null); setNotice(''); setPreparedEmail(''); setEditing(false); setSelectedId(id); };
  const edit = () => { if (plan) { setDraft(plan); setEditBase(plan); setEditing(true); } };
  const saveDetails = async () => {
    if (plan) {
      if (await mutate('plan.update', { details: draft }, editBase)) setEditing(false);
      return;
    }
    if (busyRef.current || syncError) return;
    busyRef.current = true; setBusy(true); setNotice('');
    try {
      const created = await createSharedPlan(sourceKey.current, draft);
      planRef.current = created; setPlan(created); setSelectedId(created.id); setEditing(false); sourceKey.current = `shared-${requestId()}`;
    } catch (error) { setNotice(errorText(error)); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const invite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (await mutate('plan.invite', { email })) { setPreparedEmail(email); setInviteEmail(''); setNotice('Access is ready. Send the invitation below.'); }
  };
  const suggest = async () => {
    if (await mutate('plan.suggest', { suggestionId: suggestionKey.current, slot, place: { title: suggestion.trim(), provider: 'manual' } })) {
      setSuggestion(''); suggestionKey.current = requestId();
    }
  };
  const field = (label: string, key: 'title' | 'locationLabel' | 'dateStart' | 'dateEnd' | 'timeWindow') => <View style={styles.field} key={key}>
    <Text style={styles.copy}>{label}</Text>
    <TextInput accessibilityLabel={label} style={styles.input} value={draft[key] || ''} onChangeText={(value) => setDraft((current) => ({ ...current, [key]: value }))} editable={!busy} />
  </View>;
  return <SafeAreaView style={styles.screen}>
    <View style={styles.header}>
      <Text style={styles.heading}>Shared plans</Text>
      {plan ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{sharedRsvpSummary(plan.participants)}</Text> : null}
      <Button label="Back to NomNomGo" size="compact" onPress={onClose} disabled={busy} />
    </View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.row}>
        {selectedId ? <Button label="All shared plans" size="compact" onPress={() => openPlan('')} disabled={busy} /> : null}
        <Button label="Refresh shared plans" size="compact" onPress={() => refreshRef.current()} disabled={busy} />
      </View>
      {loading ? <ActivityIndicator color="#ff806f" /> : null}
      <Text style={styles.muted}>{syncError ? 'Connection interrupted. Changes are paused until refresh succeeds.' : updated ? `Updated ${updated} · Refreshes every 5 seconds while open` : 'Connecting…'}</Text>
      {syncError ? <Text accessibilityRole="alert" style={styles.error}>{syncError}</Text> : null}
      {notice ? <Text accessibilityRole="alert" selectable style={styles.notice}>{notice}</Text> : null}

      {!selectedId && !editing ? <>
        <Button label="Create shared plan" onPress={() => { setDraft(emptyDraft()); setEditBase(null); setEditing(true); }} disabled={busy || !!syncError} tone="primary" />
        {!loading && !plans.length ? <Text style={styles.copy}>Plans you organize or are invited to will appear here.</Text> : null}
        {plans.map((item) => <View key={item.id} style={styles.card}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.copy}>{item.dateStart} · {item.locationLabel} · {item.status === 'locked' ? 'Locked' : 'Planning'}</Text>
          <Text style={styles.muted}>Your RSVP: {rsvps.find((rsvp) => rsvp.value === item.rsvp)?.label || 'Not answered'}</Text>
          <Text accessibilityLiveRegion="polite" style={styles.notice}>{sharedRsvpSummary(item.participants)}</Text>
          <Button label={`Open ${item.title}`} onPress={() => openPlan(item.id)} size="compact" />
        </View>)}
      </> : null}

      {editing ? <View style={styles.card}>
        <Text style={styles.title}>{plan ? 'Edit shared plan details' : 'New shared plan'}</Text>
        {field('Shared plan title', 'title')}{field('Meeting area or address', 'locationLabel')}
        {field('Start date (YYYY-MM-DD)', 'dateStart')}{field('End date (YYYY-MM-DD)', 'dateEnd')}{field('Time and timezone', 'timeWindow')}
        <View style={styles.row}>{(['food', 'activity', 'both'] as const).map((intent) => <Button key={intent} label={intent === 'both' ? 'Food & activity' : intent === 'food' ? 'Food' : 'Activity'} tone={draft.intent === intent ? 'primary' : 'secondary'} size="compact" onPress={() => setDraft((current) => ({ ...current, intent }))} />)}</View>
        {plan && editBase?.revision !== plan.revision ? <>
          <Text style={styles.notice}>The plan changed while you were editing. Review the latest details below, then keep your edits or cancel.</Text>
          <Button label="Keep edits with latest version" size="compact" onPress={() => setEditBase(plan)} />
        </> : null}
        <View style={styles.row}>
          <Button label={plan ? 'Save shared details' : 'Save new shared plan'} onPress={saveDetails} loading={busy} disabled={!!syncError || !!(plan && editBase?.revision !== plan.revision)} tone="primary" />
          <Button label="Cancel editing" onPress={() => setEditing(false)} disabled={busy} />
        </View>
      </View> : null}

      {plan ? <>
        <View style={styles.card}>
          <Text style={styles.heading}>{plan.title}</Text>
          <Text style={styles.copy}>{plan.dateStart}{plan.dateEnd !== plan.dateStart ? ` – ${plan.dateEnd}` : ''} · {plan.timeWindow || 'Time to be decided'}</Text>
          <Text style={styles.copy}>{plan.locationLabel}</Text>
          <Text style={styles.notice}>{locked ? 'Locked plan · You can still update your RSVP' : 'Planning together'}</Text>
          {owner ? <View style={styles.row}>
            {!locked ? <Button label="Edit shared details" size="compact" onPress={edit} disabled={busy || !!syncError} /> : null}
            <Button label={locked ? 'Reopen shared plan' : 'Lock shared plan'} size="compact" onPress={async () => { await mutate(locked ? 'plan.reopen' : 'plan.lock'); }} disabled={busy || !!syncError || (!locked && !plan.stops.length)} />
          </View> : null}
        </View>
        <View style={styles.card}>
          <Text style={styles.title}>Your RSVP</Text>
          <View style={styles.row}>{rsvps.map((rsvp) => <Button key={rsvp.value} label={rsvp.label} accessibilityLabel={`RSVP ${rsvp.label}`} tone={plan.participants.find((p) => p.userId === account.id)?.rsvp === rsvp.value ? 'primary' : 'secondary'} size="compact" disabled={busy || !!syncError} onPress={async () => { await mutate('plan.rsvp', { rsvp: rsvp.value }); }} />)}</View>
          {plan.participants.map((person) => <View key={person.displayName} style={styles.person}>
            <Text style={styles.copy}>{person.displayName}{person.role === 'owner' ? ' · Organizer' : ''}</Text>
            <Text style={styles.muted}>{rsvps.find((rsvp) => rsvp.value === person.rsvp)?.label || (person.joined ? 'Not answered' : 'Invited · Not joined yet')}</Text>
            {owner && person.role !== 'owner' ? <Button label={`Remove ${person.displayName}`} size="compact" disabled={busy || !!syncError} onPress={async () => { await mutate('plan.removeMember', { email: person.displayName }); }} /> : null}
          </View>)}
        </View>
        <View style={styles.card}>
          <Text style={styles.title}>Invite someone to this plan</Text>
          <Text style={styles.copy}>Enter their Google account email. If needed, this also invites them to NomNomGo alpha.</Text>
          <TextInput accessibilityLabel="Plan invitee Google email" style={styles.input} value={inviteEmail} onChangeText={setInviteEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} editable={!busy} />
          <Button label="Prepare plan invitation" onPress={invite} disabled={busy || !!syncError || !inviteEmail.trim()} />
          {preparedEmail ? <ShareMessage email={preparedEmail} message={`Join me for ${plan.title}: ${sharedPlanUrl(plan.id)} . Sign in through Differance Labs with Google using ${preparedEmail}, then open NomNomGo. You can RSVP and help choose our stops. Your access is ready.`} /> : null}
        </View>
        <View style={styles.card}>
          <Text style={styles.title}>Itinerary</Text>
          {!plan.stops.length ? <Text style={styles.copy}>Suggest a place below. The organizer can add it to the itinerary.</Text> : null}
          {plan.stops.map((stop, index) => <View key={stop.id} style={styles.person}>
            <Text style={styles.copy}>{index + 1}. {stop.place.title}</Text>
            {stop.arrivalTime ? <Text style={styles.muted}>{stop.arrivalTime}</Text> : null}
            {stop.place.address ? <Text style={styles.muted}>{stop.place.address}</Text> : null}
            <Button label={`Map ${stop.place.title}`} size="compact" onPress={async () => { try { await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.place.latitude !== undefined && stop.place.longitude !== undefined ? `${stop.place.latitude},${stop.place.longitude}` : [stop.place.title, stop.place.address || plan.locationLabel].join(' '))}`); } catch { setNotice('Could not open the map.'); } }} />
            {owner && !locked ? <View style={styles.row}>
              <Button label={`Move ${stop.place.title} up`} size="compact" disabled={busy || !!syncError || index === 0} onPress={async () => { await mutate('plan.moveStop', { stopId: stop.id, direction: -1 }); }} />
              <Button label={`Move ${stop.place.title} down`} size="compact" disabled={busy || !!syncError || index === plan.stops.length - 1} onPress={async () => { await mutate('plan.moveStop', { stopId: stop.id, direction: 1 }); }} />
              <Button label={`Remove stop ${stop.place.title}`} size="compact" disabled={busy || !!syncError} onPress={async () => { await mutate('plan.removeStop', { stopId: stop.id }); }} />
            </View> : null}
          </View>)}
        </View>
        <View style={styles.card}>
          <Text style={styles.title}>Suggestions & votes</Text>
          {!locked ? <>
            <TextInput accessibilityLabel="Suggest a place" placeholder="Place name or activity" placeholderTextColor="#a8b2bf" style={styles.input} value={suggestion} onChangeText={(value) => { setSuggestion(value); suggestionKey.current = requestId(); }} editable={!busy} />
            <View style={styles.row}>
              <Button label="Food suggestion" size="compact" tone={slot === 'food' ? 'primary' : 'secondary'} onPress={() => setSlot('food')} />
              <Button label="Activity suggestion" size="compact" tone={slot === 'activity' ? 'primary' : 'secondary'} onPress={() => setSlot('activity')} />
              <Button label="Add shared suggestion" size="compact" onPress={suggest} disabled={busy || !!syncError || !suggestion.trim()} />
            </View>
          </> : <Text style={styles.muted}>The organizer can reopen the plan to continue suggestions and voting.</Text>}
          {plan.suggestions.map((item) => {
            const voted = item.votes.some((vote) => vote.userId === account.id);
            return <View key={item.id} style={styles.person}>
              <Text style={styles.copy}>{item.place.title} · {item.votes.length} vote{item.votes.length === 1 ? '' : 's'}</Text>
              {!locked ? <View style={styles.row}>
                <Button label={`${voted ? 'Remove vote for' : 'Vote for'} ${item.place.title}`} size="compact" disabled={busy || !!syncError} onPress={async () => { await mutate('plan.vote', { suggestionId: item.id, voted: !voted }); }} />
                {owner ? <Button label={`Add ${item.place.title} to itinerary`} size="compact" disabled={busy || !!syncError || plan.stops.some((stop) => stop.id === item.id)} onPress={async () => { await mutate('plan.pick', { suggestionId: item.id }); }} /> : null}
              </View> : null}
            </View>;
          })}
        </View>
        <Text selectable style={styles.muted}>Plan link (members only): {sharedPlanUrl(plan.id)}</Text>
      </> : null}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0c1117' }, header: { padding: 16, gap: 10, borderBottomWidth: 1, borderColor: '#293440' },
  content: { padding: 16, gap: 16, paddingBottom: 48, width: '100%', maxWidth: 780, alignSelf: 'center' },
  heading: { fontSize: 24, fontWeight: '700', color: '#f5f7fa' }, title: { fontSize: 19, fontWeight: '700', color: '#f5f7fa' },
  copy: { color: '#d7e0e9', fontSize: 15, lineHeight: 22 }, muted: { color: '#a8b2bf', fontSize: 13, lineHeight: 19 },
  notice: { color: '#8fe0d3', lineHeight: 22 }, error: { color: '#ffb3a8', lineHeight: 22 },
  card: { backgroundColor: '#18212b', borderRadius: 16, padding: 16, gap: 14 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { backgroundColor: '#0d1721', borderColor: '#667785', borderWidth: 1, borderRadius: 10, padding: 12, color: '#fff', minHeight: 44 },
  field: { gap: 6 }, person: { gap: 8, borderTopWidth: 1, borderColor: '#344150', paddingTop: 12 },
});
