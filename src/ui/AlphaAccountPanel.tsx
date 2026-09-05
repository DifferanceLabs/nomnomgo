import React, { useState } from 'react';
import { Linking, Platform, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { accountRequest, getAlphaAccount } from '../data/accountStorage';
import { ActionButton as Button } from './primitives';

const metricsLabels: Record<string, string> = {
  accounts: 'Accounts', active7Days: 'Active in 7 days', invitations: 'Invitations created',
  acceptedInvitations: 'Invitations accepted', accountLoads: 'Account loads',
  saveOperations: 'Cloud save operations', savedPlans: 'Saved plan copies',
  accountApiRequests: 'Account API requests',
  planningRecords: 'Planning records', favorites: 'Favorite places',
  reportedPlacesCallsMonth: 'Reported Places searches this month',
  sharedPlans: 'Shared plans', lockedPlans: 'Locked shared plans', memberships: 'Plan memberships',
  rsvps: 'Answered RSVPs', suggestions: 'Shared suggestions', votes: 'Shared votes',
  rsvpChanges: 'RSVP changes', planInvitations: 'Plan invitations created',
};

export function AlphaAccountPanel({ onOpenSharedPlans }: { onOpenSharedPlans?: () => void }) {
  const account = getAlphaAccount();
  const [email, setEmail] = useState('');
  const [invitedEmail, setInvitedEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [metrics, setMetrics] = useState<Record<string, number> | null>(null);
  if (!account) return null;
  const url = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : '';
  const invitation = `Join me on NomNomGo to test making plans. Open ${url}, choose Open with Differance Labs, and sign in with Google using ${invitedEmail}. Then choose NomNomGo in your apps. Your alpha access is ready.`;
  const invite = async () => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    setInvitedEmail('');
    try {
      const target = email.trim().toLowerCase();
      await accountRequest({ action: 'invite', email: target });
      setInvitedEmail(target);
      setMessage('Alpha access is ready. Send the invitation below.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not create invitation.'); }
    finally { setBusy(false); }
  };
  const openComposer = async (target: string) => {
    try { await Linking.openURL(target); }
    catch { setMessage('Could not open your messaging app. Copy the invitation instead.'); }
  };
  const share = async () => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: 'NomNomGo alpha invitation', text: invitation });
      } else if (Platform.OS !== 'web') await Share.share({ message: invitation });
      else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(invitation);
        setMessage('Invitation copied. Paste it into your message.');
      } else setMessage(invitation);
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) setMessage('Use Email or Text, or select and copy the invitation below.');
    }
  };
  const loadMetrics = async () => {
    try {
      const [accounts, plans] = await Promise.all([
        accountRequest<Record<string, number>>({ action: 'metrics' }),
        accountRequest<Record<string, number>>({ action: 'plan.metrics' }),
      ]);
      setMetrics({ ...accounts, ...plans });
    }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not load usage.'); }
  };
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Invite someone to alpha</Text>
      <Text style={styles.copy}>Use their Google account email. This grants NomNomGo access; you send the message. Up to 10 invitations per day.</Text>
      <TextInput
        style={styles.input} value={email} onChangeText={setEmail} placeholder="Their Google account email"
        placeholderTextColor="#a8b2bf" accessibilityLabel="Invitee Google account email"
        keyboardType="email-address" autoCapitalize="none" autoCorrect={false} editable={!busy}
      />
      <Button label={busy ? 'Preparing invitation…' : 'Create invitation'} onPress={invite} size="compact" />
      {message ? <Text accessibilityRole="alert" style={styles.copy}>{message}</Text> : null}
      {invitedEmail ? (
        <>
          <View style={styles.actions}>
            <Button label="Email" onPress={() => openComposer(`mailto:${encodeURIComponent(invitedEmail)}?subject=NomNomGo%20alpha%20invitation&body=${encodeURIComponent(invitation)}`)} size="compact" />
            <Button label="Text" onPress={() => openComposer(`sms:${typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(invitation)}`)} size="compact" />
            <Button label="Share / copy" onPress={share} size="compact" />
          </View>
          <Text selectable style={styles.copy}>{invitation}</Text>
        </>
      ) : null}
      <Text style={styles.copy}>Personal saves belong to your account. Shared plans keep RSVPs, suggestions, votes and the group itinerary in sync.</Text>
      {onOpenSharedPlans ? <Button label="Shared plans & RSVPs" onPress={onOpenSharedPlans} size="compact" /> : null}
      {account.isAdmin ? <Button label="Refresh alpha usage" onPress={loadMetrics} size="compact" /> : null}
      {metrics ? (
        <View>
          {Object.entries(metricsLabels).map(([key, label]) => <Text key={key} style={styles.copy}>{label}: {metrics[key] ?? 0}</Text>)}
          <Text style={styles.copy}>Places counts are reported by clients and omit other providers and some request types. They are not billing totals.</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 12, marginVertical: 12 }, title: { color: '#f5f7fa', fontSize: 18, fontWeight: '700' },
  copy: { color: '#c7d1db', fontSize: 14, lineHeight: 20 },
  input: { backgroundColor: '#15202b', borderColor: '#667785', borderWidth: 1, borderRadius: 10, padding: 12, color: '#ffffff', minHeight: 44 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
