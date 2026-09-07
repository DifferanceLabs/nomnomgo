import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { listFriends, removeFriend, type Friend } from '../data/friends';
import { startForegroundRefresh } from '../data/foregroundRefresh';
import { ActionButton as Button } from './primitives';

export function FriendsPanel({ onInvite, excludedEmails = [], disabled = false }: {
  onInvite?: (email: string) => Promise<void>;
  excludedEmails?: string[];
  disabled?: boolean;
}) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [removing, setRemoving] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const refreshRef = useRef<() => void>(() => {});
  useEffect(() => {
    let active = true;
    const poller = startForegroundRefresh(async () => {
      try {
        const incoming = await listFriends();
        if (active) { setFriends(incoming); setLoaded(true); setError(''); }
      } catch (failure) {
        if (active) { setFriends([]); setError(failure instanceof Error ? failure.message : 'Friends could not be refreshed.'); }
      }
    }, { ready: () => !busyRef.current });
    refreshRef.current = poller.refresh;
    return () => { active = false; poller.stop(); };
  }, []);
  const act = async (friend: Friend) => {
    if (busyRef.current || disabled) return;
    busyRef.current = true; setBusy(true);
    try {
      if (onInvite) await onInvite(friend.email);
      else {
        await removeFriend(friend.id);
        setFriends((current) => current.filter((item) => item.id !== friend.id));
        setRemoving('');
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Please try again.'); }
    finally { busyRef.current = false; setBusy(false); refreshRef.current(); }
  };
  const available = friends.filter((friend) => !excludedEmails.includes(friend.email));
  const matches = available.filter((friend) => friend.email.includes(search.trim().toLowerCase()));
  return <View style={styles.panel}>
    <Text style={styles.title}>{onInvite ? 'Invite a friend' : 'Friends'}</Text>
    <Text style={styles.copy}>New invitees become friends with their inviters after their first NomNomGo sign-in. Personal saves stay private.</Text>
    {error ? <Text accessibilityRole="alert" style={styles.copy}>{error}</Text> : null}
    {!loaded && !error ? <Text style={styles.copy}>Loading friends…</Text> : null}
    {loaded && !available.length && !error ? <Text style={styles.copy}>{friends.length && onInvite ? 'Your friends are already invited to this plan.' : 'Friends will appear here after an invitee signs in.'}</Text> : null}
    {available.length > 8 ? <TextInput accessibilityLabel="Search friends" placeholder="Search friends by email" placeholderTextColor="#a8b2bf" value={search} onChangeText={setSearch} style={styles.input} autoCapitalize="none" /> : null}
    {matches.slice(0, 20).map((friend) => <View key={friend.id} style={styles.friend}>
      <Text selectable style={styles.copy}>{friend.email}</Text>
      {removing === friend.id ? <>
        <Text style={styles.copy}>Remove this friendship for both of you? Existing shared plans will stay shared.</Text>
        <Button label="Remove friendship" size="compact" onPress={() => act(friend)} disabled={busy || disabled} />
        <Button label="Keep friend" size="compact" onPress={() => setRemoving('')} disabled={busy} />
      </> : <Button label={onInvite ? `Invite ${friend.email}` : `Remove ${friend.email}`} size="compact" onPress={() => onInvite ? act(friend) : setRemoving(friend.id)} disabled={busy || disabled} />}
    </View>)}
    {matches.length > 20 ? <Text style={styles.copy}>Showing 20 of {matches.length}. Search to find someone.</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  panel: { gap: 10, backgroundColor: '#15202b', padding: 14, borderRadius: 12 },
  title: { color: '#f5f7fa', fontSize: 18, fontWeight: '700' },
  copy: { color: '#c7d1db', fontSize: 14, lineHeight: 20 },
  friend: { gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#667785' },
  input: { borderColor: '#667785', borderWidth: 1, borderRadius: 10, padding: 12, color: '#fff', minHeight: 44 },
});
