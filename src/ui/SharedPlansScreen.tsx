import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAlphaAccount } from '../data/accountStorage';
import { changeSharedPlan, changedSharedRsvps, createSharedPlan, getSharedPlan, groupPlansByDate, listSharedPlans, newerSharedPlan, planDateRangeLabel, sharedPlanUrl, sharedPlanDraftError, sharedRsvpLabel, type SharedPlan, type SharedPlanDraft, type SharedPlanSummary } from '../data/sharedPlans';
import { startForegroundRefresh } from '../data/foregroundRefresh';
import { ActionButton as Button, BottomNavigation, RsvpControl } from './primitives';
import { RsvpBadge, RsvpSummary } from './RsvpSummary';
import { colors } from './theme';
import { DateField } from './DateField';
import { ShareMessage } from './ShareMessage';
import { FriendsPanel } from './FriendsPanel';
import { PlanWorkspaceHeader } from './PlanWorkspaceHeader';

const today = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
const emptyDraft = (): SharedPlanDraft => ({ title: '', intent: 'both', locationLabel: '', dateStart: today(), dateEnd: today(), timeWindow: '', stops: [] });
const requestId = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '';
const errorText = (error: unknown) => error instanceof Error ? error.message : 'The plan could not be reached. Please try again.';
const statusOf = (error: unknown) => (error as { status?: number })?.status;

export function SharedPlansScreen({ initialPlan, initialPlanId, initialSection, onOpenEditor, onClose, onOpenFriends, onNavigate }: { initialSection?: 'plan' | 'people'; onOpenEditor?: (plan: SharedPlan) => void; initialPlan?: SharedPlan | null; initialPlanId?: string | null; onClose: () => void; onOpenFriends?: () => void; onNavigate?: (key: 'home' | 'saved' | 'profile') => void }) {
  const account = getAlphaAccount()!;
  const [selectedId, setSelectedId] = useState(initialPlan?.id || initialPlanId || '');
  const [plan, setPlan] = useState<SharedPlan | null>(initialPlan || null);
  const planRef = useRef(plan);
  const [plans, setPlans] = useState<SharedPlanSummary[]>([]);
  const [section, setSection] = useState<'plan' | 'people'>(initialSection || 'plan');
  const [search, setSearch] = useState('');
  const [removingMember, setRemovingMember] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const draftSnapshot = useRef('');
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const refreshRef = useRef<() => void>(() => {});
  const [updated, setUpdated] = useState('');
  const [editing, setEditing] = useState(false);
  const [formError, setFormError] = useState('');
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
  const filteredPlans = plans.filter((item) => `${item.title} ${item.locationLabel}`.toLowerCase().includes(search.trim().toLowerCase()));
  const planGroups = groupPlansByDate(filteredPlans);
  useEffect(() => {
    if (plan && section === 'plan' && !editing && !loading && !syncError && onOpenEditor) onOpenEditor(plan);
  }, [plan, section, editing, loading, syncError, onOpenEditor]);

  useEffect(() => {
    if (typeof window === 'undefined' || !editing || JSON.stringify(draft) === draftSnapshot.current) return;
    const preventUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', preventUnload);
    return () => window.removeEventListener('beforeunload', preventUnload);
  }, [editing, draft]);

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
      if (action === 'plan.rsvp') setNotice(`RSVP saved: ${sharedRsvpLabel(String(data.rsvp))}`);
      return true;
    } catch (error) {
      setNotice(errorText(error));
      if ([401, 403, 404].includes(statusOf(error) || 0)) { setSyncError(errorText(error)); planRef.current = null; setPlan(null); }
      return false;
    } finally { busyRef.current = false; setBusy(false); refreshRef.current(); }
  };
  const navigate = (action: () => void) => {
    if (busyRef.current) return;
    if (editing && JSON.stringify(draft) !== draftSnapshot.current) { setPendingNavigation(() => action); return; }
    action();
  };
  const openPlan = (id: string) => { planRef.current = null; setPlan(null); setNotice(''); setPreparedEmail(''); setEditing(false); setFormError(''); setSelectedId(id); setSection('plan'); setRemovingMember(''); setInviteOpen(false); };
  const create = () => { openPlan(''); const next = emptyDraft(); draftSnapshot.current = JSON.stringify(next); setDraft(next); setEditBase(null); setEditing(true); };
  const saveDetails = async () => {
    const error = sharedPlanDraftError(draft);
    if (error) { setFormError(error); return; }
    setFormError('');
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
  const invite = async (target = inviteEmail) => {
    const email = target.trim().toLowerCase();
    if (await mutate('plan.invite', { email })) { setPreparedEmail(email); setInviteEmail(''); setNotice('Added to the plan. Send them the invitation below.'); }
  };
  const suggest = async () => {
    if (await mutate('plan.suggest', { suggestionId: suggestionKey.current, slot, place: { title: suggestion.trim(), provider: 'manual' } })) {
      setSuggestion(''); suggestionKey.current = requestId();
    }
  };
  const field = (label: string, key: 'title' | 'locationLabel' | 'dateStart' | 'dateEnd' | 'timeWindow') => <View style={styles.field} key={key}>
    <Text style={styles.copy}>{label}</Text>
    {key === 'dateStart' || key === 'dateEnd' ? <DateField label={label} value={draft[key]} disabled={busy} onChange={(value) => { setFormError(''); setDraft((current) => ({ ...current, [key]: value, ...(key === 'dateStart' && current.dateEnd < value ? { dateEnd: value } : {}) })); }} />
      : <TextInput accessibilityLabel={label} style={styles.input} value={draft[key] || ''} onChangeText={(value) => { setFormError(''); setDraft((current) => ({ ...current, [key]: value })); }} editable={!busy} placeholder={key === 'timeWindow' ? 'e.g. 6–8 PM Central' : undefined} placeholderTextColor="#a8b2bf" />}
  </View>;
  return <SafeAreaView style={styles.screen}>
    {!plan || editing ? <View style={styles.header}>
      <View style={styles.headerRow}>
        <Button label={selectedId || editing ? 'Back' : 'Home'} accessibilityLabel={selectedId || editing ? 'Back to plans' : 'Back to NomNomGo'} size="compact" onPress={() => navigate(selectedId || editing ? () => openPlan('') : onClose)} disabled={busy} />
        <Text style={[styles.heading, { flex: 1 }]} numberOfLines={1}>{editing ? (plan ? 'Edit plan' : 'New plan') : 'Plans'}</Text>
        {onOpenFriends ? <Button label="Friends" size="compact" onPress={() => navigate(onOpenFriends)} disabled={busy} /> : null}
      </View>
      {pendingNavigation ? <View accessibilityRole="alert" style={{ gap: 8 }}>
        <Text style={styles.copy}>Discard your unsaved plan changes?</Text>
        <View style={styles.row}><Button label="Keep editing" size="compact" onPress={() => setPendingNavigation(null)} /><Button label="Discard changes" size="compact" tone="danger" onPress={() => { const action = pendingNavigation; setPendingNavigation(null); action(); }} /></View>
      </View> : null}
    </View> : null}
    <ScrollView contentContainerStyle={[styles.content, plan && !editing && styles.planContent]} keyboardShouldPersistTaps="handled">
      {plan && !editing ? <PlanWorkspaceHeader section={section === 'plan' ? 'plan' : 'friends'} count={plan.participants.length}
        title={plan.title} dateLabel={planDateRangeLabel(plan.dateStart, plan.dateEnd)} timeLabel={plan.timeWindow || 'Time to be decided'}
        locationLabel={plan.locationLabel} stopCount={plan.stops.length} locked={locked} participants={plan.participants}
        statusLabel={!owner ? 'Organizer edits' : undefined} disabled={busy}
        onBack={() => navigate(() => openPlan(''))} onPlan={() => setSection('plan')} onFriends={() => setSection('people')} /> : null}
      {loading ? <ActivityIndicator color="#ff806f" /> : null}
      {syncError ? <><Text accessibilityRole="alert" style={styles.error}>{syncError}</Text><Button label="Retry connection" onPress={() => refreshRef.current()} disabled={busy} /></> : null}
      {notice ? <Text accessibilityRole="alert" selectable style={styles.notice}>{notice}</Text> : null}

      {!selectedId && !editing ? <>
        <Button label="Create plan" accessibilityLabel="Create shared plan" onPress={create} disabled={busy || !!syncError} tone="primary" />
        {plans.length > 5 || search ? <TextInput accessibilityLabel="Search plans" placeholder="Search plans" placeholderTextColor="#a8b2bf" style={styles.input} value={search} onChangeText={setSearch} /> : null}
        {!loading && !plans.length ? <Text style={styles.copy}>Plans you organize or are invited to will appear here.</Text> : null}
        {plans.length > 0 && !plans.some((item) => `${item.title} ${item.locationLabel}`.toLowerCase().includes(search.trim().toLowerCase())) ? <Text style={styles.copy}>No plans match. Try another name or place.</Text> : null}
        {(['future', 'past'] as const).map((group) => <View key={group} style={{ gap: 12 }}>
        <Text accessibilityRole="header" style={styles.title}>{group === 'future' ? 'Future' : 'Past'} ({planGroups[group].length})</Text>
        {!planGroups[group].length && !loading ? <Text style={styles.muted}>{search ? 'No matching plans.' : group === 'future' ? 'No future plans yet.' : 'No past plans yet.'}</Text> : null}
        {planGroups[group].map((item) => <TouchableOpacity key={item.id} style={styles.card} accessibilityRole="button" accessibilityLabel={`Open ${item.title}`} onPress={() => openPlan(item.id)}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.copy}>{item.dateStart}{item.dateEnd && item.dateEnd !== item.dateStart ? ` – ${item.dateEnd}` : ''}{item.timeWindow ? ` · ${item.timeWindow}` : ''}</Text>
          <Text style={styles.muted}>{item.locationLabel} · {item.status === 'locked' ? 'Locked' : 'Planning'}</Text>
          <View style={styles.row}><Text style={styles.muted}>You:</Text><RsvpBadge value={item.rsvp} /></View>
          <RsvpSummary participants={item.participants} />
        </TouchableOpacity>)}
        </View>)}
      </> : null}

      {editing ? <View style={styles.card}>
        <Text style={styles.title}>{plan ? 'Edit shared plan details' : 'New shared plan'}</Text>
        {field('Plan name', 'title')}{field('Meeting place', 'locationLabel')}
        {field('Start date', 'dateStart')}{field('End date', 'dateEnd')}{field('Time (optional)', 'timeWindow')}
        {formError ? <Text accessibilityRole="alert" style={styles.error}>{formError}</Text> : null}
        <View style={styles.row}>{(['food', 'activity', 'both'] as const).map((intent) => <Button key={intent} label={intent === 'both' ? 'Food & activity' : intent === 'food' ? 'Food' : 'Activity'} tone={draft.intent === intent ? 'primary' : 'secondary'} size="compact" onPress={() => setDraft((current) => ({ ...current, intent }))} />)}</View>
        {plan && editBase?.revision !== plan.revision ? <>
          <Text style={styles.notice}>This plan changed while you were editing. Review the current details before saving your edits.</Text>
          <Text style={styles.copy}>{plan.title}{'\n'}{plan.locationLabel}{'\n'}{plan.dateStart} – {plan.dateEnd}{'\n'}{plan.timeWindow || 'Time to be decided'}</Text>
          <Button label="Keep my edits" accessibilityLabel="Keep edits with latest version" size="compact" onPress={() => setEditBase(plan)} />
        </> : null}
        <View style={styles.row}>
          <Button label={plan ? 'Save changes' : 'Create plan'} onPress={saveDetails} loading={busy} disabled={!!syncError || !!(plan && editBase?.revision !== plan.revision)} tone="primary" />
          <Button label="Cancel" accessibilityLabel="Cancel editing" onPress={() => navigate(() => setEditing(false))} disabled={busy} />
        </View>
      </View> : null}

      {plan && !editing && section === 'people' ? <>
        {section === 'people' ? <View style={styles.card}>
          <Text style={styles.title}>Your RSVP</Text>
          <RsvpControl value={plan.participants.find((p) => p.userId === account.id)?.rsvp || undefined} disabled={busy || !!syncError} onChange={async (rsvp) => { await mutate('plan.rsvp', { rsvp }); }} />
        </View> : null}
        {section === 'people' ? <>
        {onOpenFriends ? <Button label="Manage my friends" size="compact" onPress={() => navigate(onOpenFriends)} disabled={busy} /> : null}
        <Button label={inviteOpen ? 'Done inviting' : 'Invite people'} tone="primary" onPress={() => setInviteOpen(!inviteOpen)} disabled={busy} />
        {inviteOpen ? <View style={styles.card}>
          <Text style={styles.title}>Invite people</Text>
          <FriendsPanel onInvite={invite} excludedEmails={plan.participants.map((member) => member.displayName)} disabled={busy || !!syncError} />
          <Text style={styles.copy}>Or invite someone new using their Google email. First sign-in connects you as friends.</Text>
          <TextInput accessibilityLabel="Plan invitee Google email" style={styles.input} value={inviteEmail} onChangeText={setInviteEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} editable={!busy} />
          <Button label="Invite by email or text" onPress={() => invite()} loading={busy} disabled={!!syncError || !inviteEmail.trim()} />
          {preparedEmail ? <ShareMessage email={preparedEmail} message={`Join me for ${plan.title}: ${sharedPlanUrl(plan.id)} . Sign in through Differance Labs with Google using ${preparedEmail}, then open NomNomGo. You can RSVP and help choose our stops. Your access is ready. If you are new to NomNomGo, your first sign-in connects us as friends for future plans.`} /> : null}
        </View> : null}
        <View style={styles.card}>
          <Text style={styles.title}>People</Text>
          {plan.participants.map((person) => <View key={person.displayName} style={styles.person}>
            <Text style={styles.copy}>{person.displayName}{person.role === 'owner' ? ' · Organizer' : ''}</Text>
            <RsvpBadge value={person.rsvp} pendingLabel={person.joined ? 'Awaiting reply' : 'Invited'} />
            {owner && person.role !== 'owner' ? removingMember === person.displayName ? <>
              <Text style={styles.copy}>Remove {person.displayName} from this plan?</Text>
              <View style={styles.row}><Button label="Keep person" size="compact" onPress={() => setRemovingMember('')} disabled={busy} /><Button label="Remove from plan" tone="danger" size="compact" disabled={busy || !!syncError} onPress={async () => { if (await mutate('plan.removeMember', { email: person.displayName })) setRemovingMember(''); }} /></View>
            </> : <Button label="Manage" accessibilityLabel={`Manage ${person.displayName}`} size="compact" disabled={busy || !!syncError} onPress={() => setRemovingMember(person.displayName)} /> : null}
          </View>)}
        </View>
        <View style={styles.card}>
          <Text style={styles.title}>Suggestions & votes</Text>
          {!locked ? <>
            <TextInput accessibilityLabel="Suggest a place" placeholder="Place name or activity" placeholderTextColor="#a8b2bf" style={styles.input} value={suggestion} onChangeText={(value) => { setSuggestion(value); suggestionKey.current = requestId(); }} editable={!busy} />
            <View style={styles.row}>
              <Button label="Food" accessibilityLabel="Food suggestion" size="compact" tone={slot === 'food' ? 'primary' : 'secondary'} onPress={() => setSlot('food')} />
              <Button label="Activity" accessibilityLabel="Activity suggestion" size="compact" tone={slot === 'activity' ? 'primary' : 'secondary'} onPress={() => setSlot('activity')} />
              <Button label="Suggest" accessibilityLabel="Add shared suggestion" size="compact" onPress={suggest} disabled={busy || !!syncError || !suggestion.trim()} />
            </View>
          </> : <Text style={styles.muted}>The organizer can reopen the plan to continue suggestions and voting.</Text>}
          {plan.suggestions.map((item) => {
            const voted = item.votes.some((vote) => vote.userId === account.id);
            return <View key={item.id} style={styles.person}>
              <Text style={styles.copy}>{item.place.title} · {item.votes.length} vote{item.votes.length === 1 ? '' : 's'}</Text>
              {!locked ? <View style={styles.row}>
                <Button label={voted ? '✓ Voted' : 'Vote'} accessibilityLabel={`${voted ? 'Remove vote for' : 'Vote for'} ${item.place.title}`} size="compact" disabled={busy || !!syncError} onPress={async () => { await mutate('plan.vote', { suggestionId: item.id, voted: !voted }); }} />
                {owner ? <Button label={plan.stops.some((stop) => stop.id === item.id) ? 'Added to plan' : 'Add to plan'} accessibilityLabel={`Add ${item.place.title} to itinerary`} size="compact" disabled={busy || !!syncError || plan.stops.some((stop) => stop.id === item.id)} onPress={async () => { await mutate('plan.pick', { suggestionId: item.id }); }} /> : null}
              </View> : null}
            </View>;
          })}
        </View>
        </> : null}
      </> : null}
      {updated && !syncError ? <Text style={styles.muted}>Updated {updated} · Syncs automatically while open</Text> : null}
    </ScrollView>
    {onNavigate ? <BottomNavigation<'home' | 'plans' | 'saved' | 'profile'> activeKey="plans" onSelect={(key) => navigate(() => key === 'plans' ? openPlan('') : onNavigate(key))} items={[
      {key:'home',label:'Home',icon:<Ionicons name="home-outline" size={22} color={colors.textTertiary} />},
      {key:'plans',label:'Plans',icon:<Ionicons name="calendar" size={22} color={colors.coral} />},
      {key:'saved',label:'Saved',icon:<Ionicons name="heart-outline" size={22} color={colors.textTertiary} />},
      {key:'profile',label:'Profile',icon:<Ionicons name="person-outline" size={22} color={colors.textTertiary} />},
    ]} createAction={{label:'Create',accessibilityLabel:'Create a plan',icon:<Ionicons name="add" size={28} color={colors.textInverse} />,onPress:() => navigate(create)}} /> : null}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, header: { padding: 16, gap: 10, borderBottomWidth: 1, borderColor: '#293440' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  content: { padding: 16, gap: 16, paddingBottom: 48, width: '100%', maxWidth: 780, alignSelf: 'center' },
  planContent: { paddingTop: 0 },
  heading: { fontSize: 24, fontWeight: '700', color: '#f5f7fa' }, title: { fontSize: 19, fontWeight: '700', color: '#f5f7fa' },
  copy: { color: '#d7e0e9', fontSize: 15, lineHeight: 22 }, muted: { color: '#a8b2bf', fontSize: 13, lineHeight: 19 },
  notice: { color: '#8fe0d3', lineHeight: 22 }, error: { color: '#ffb3a8', lineHeight: 22 },
  card: { backgroundColor: '#18212b', borderRadius: 16, padding: 16, gap: 14 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { backgroundColor: '#0d1721', borderColor: '#667785', borderWidth: 1, borderRadius: 10, padding: 12, color: '#fff', minHeight: 44 },
  field: { gap: 6 }, person: { gap: 8, borderTopWidth: 1, borderColor: '#344150', paddingTop: 12 },
});
