import { useTheme, useThemedStyles } from './ThemeProvider';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getAlphaAccount } from '../data/accountStorage';
import { startForegroundRefresh } from '../data/foregroundRefresh';
import { listSharedPlans, planDateRangeLabel, type SharedPlanSummary } from '../data/sharedPlans';
import { dismissHomePlan, loadHomePlanDismissals, upcomingHomePlans, type HomePlanDismissals } from '../data/homePlans';
import { radii, spacing, typography, type NomNomGoTheme } from './theme';
import { ActionButton } from './primitives';

export function SharedPlanActivity({ onOpenPlan }: { onOpenPlan: (id?: string) => void }) {
  const { theme: { colors } } = useTheme();
  const styles = useThemedStyles(createStyles);
  const accountId = getAlphaAccount()?.id;
  const [plans, setPlans] = useState<SharedPlanSummary[]>([]);
  const [dismissed, setDismissed] = useState<HomePlanDismissals | null>(null);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const dismissalVersion = useRef(0);
  const refresh = useRef(() => {});
  useEffect(() => {
    if (!accountId) return;
    let active = true;
    const poller = startForegroundRefresh(async () => {
      try {
        const version = dismissalVersion.current;
        const [incoming, hidden] = await Promise.all([listSharedPlans(), loadHomePlanDismissals()]);
        if (!active) return;
        setPlans(incoming); setError('');
        if (!savingRef.current && version === dismissalVersion.current) setDismissed(hidden);
      } catch (failure) {
        if (!active) return;
        setError('Upcoming plans couldn’t be refreshed.');
        const status = (failure as { status?: number })?.status;
        if (status && [401, 403, 404].includes(status)) setPlans([]);
      }
    }, { ready: () => !savingRef.current });
    refresh.current = poller.refresh;
    return () => { active = false; poller.stop(); };
  }, [accountId]);
  const dismiss = async (plan: SharedPlanSummary) => {
    if (savingRef.current) return;
    dismissalVersion.current++;
    savingRef.current = true; setSaving(true); setSaveError('');
    try { setDismissed(await dismissHomePlan(plan)); }
    catch { setSaveError('Couldn’t save your dismissal. Please try again.'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const upcoming = dismissed ? upcomingHomePlans(plans, dismissed) : [];
  if (!accountId || (!upcoming.length && !error && !saveError)) return null;
  return <View style={styles.panel}>
    <View style={styles.heading}>
      <Text accessibilityRole="header" style={styles.title}>Coming up</Text>
      <TouchableOpacity style={styles.allPlans} onPress={() => onOpenPlan()} accessibilityRole="button" accessibilityLabel="View all plans">
        <Text style={styles.link}>All plans</Text><Ionicons name="arrow-forward" size={16} color={colors.teal} />
      </TouchableOpacity>
    </View>
    {error ? <View style={styles.errorRow}><Text accessibilityRole="alert" style={styles.hint}>{error}</Text><ActionButton label="Retry" onPress={() => refresh.current()} size="compact" /></View> : null}
    {saveError ? <Text accessibilityRole="alert" style={styles.hint}>{saveError}</Text> : null}
    {upcoming.slice(0, 3).map((plan) => <View style={styles.plan} key={plan.id}>
      <TouchableOpacity style={styles.planBody} accessibilityRole="button" accessibilityLabel={`Open ${plan.title}`} onPress={() => onOpenPlan(plan.id)}>
        <Text style={styles.date}>{planDateRangeLabel(plan.dateStart, plan.dateEnd)}{plan.timeWindow ? ` · ${plan.timeWindow}` : ''}</Text>
        <Text style={styles.planTitle}>{plan.title}</Text>
        <Text style={styles.hint}>{plan.locationLabel || 'Location to be decided'}</Text>
        <View style={styles.metadata}>
          <Text style={styles.status}>{plan.status === 'locked' ? 'Confirmed' : 'Planning'}</Text>
          {plan.participants?.length ? <Text style={styles.hint}>{plan.participants.filter((member) => member.rsvp === 'going').length} going</Text> : null}
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={styles.dismiss} accessibilityRole="button" accessibilityLabel={`Dismiss ${plan.title} from Home`} accessibilityHint="Still available in Plans. Major updates can bring this card back." disabled={saving} onPress={() => { void dismiss(plan); }}>
        <Ionicons name="close" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>)}
    {upcoming.length ? <Text style={styles.footer}>Dismissed plans stay in Plans.</Text> : null}
  </View>;
}

const createStyles = ({ colors }: NomNomGoTheme) => StyleSheet.create({
  panel: { gap: spacing.xs, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  title: { ...typography.subheading, color: colors.textPrimary },
  allPlans: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  link: { ...typography.label, color: colors.teal },
  plan: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, flexDirection: 'row', alignItems: 'flex-start' },
  planBody: { flex: 1, minWidth: 0, padding: spacing.sm, paddingRight: 0, gap: spacing.micro },
  date: { ...typography.caption, color: colors.teal },
  planTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  hint: { ...typography.caption, color: colors.textSecondary },
  metadata: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs, marginTop: spacing.micro },
  status: { ...typography.caption, color: colors.textPrimary },
  dismiss: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  footer: { ...typography.caption, color: colors.textTertiary },
  errorRow: { gap: spacing.xs, alignItems: 'flex-start' },
});
