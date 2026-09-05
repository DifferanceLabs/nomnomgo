import React, { useState } from 'react';
import { Linking, Platform, Share, Text, View } from 'react-native';
import { ActionButton } from './primitives';

export function ShareMessage({ message, email = '' }: { message: string; email?: string }) {
  const [notice, setNotice] = useState('');
  const open = async (url: string) => {
    try { await Linking.openURL(url); } catch { setNotice('Select and copy the message below into your messaging app.'); }
  };
  const share = async () => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) await navigator.share({ text: message });
      else if (Platform.OS !== 'web') await Share.share({ message });
      else if (typeof navigator !== 'undefined' && navigator.clipboard) { await navigator.clipboard.writeText(message); setNotice('Message copied.'); }
      else setNotice('Select and copy the message below.');
    } catch (error) { if (!(error instanceof Error && error.name === 'AbortError')) setNotice('Use Email or Text, or select and copy the message below.'); }
  };
  return <View style={{ gap: 12 }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <ActionButton label="Email invitation" size="compact" onPress={() => open(`mailto:${encodeURIComponent(email)}?subject=NomNomGo%20plan%20invitation&body=${encodeURIComponent(message)}`)} />
      <ActionButton label="Text invitation" size="compact" onPress={() => open(`sms:${typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(message)}`)} />
      <ActionButton label="Share / copy invitation" size="compact" onPress={share} />
    </View>
    <Text selectable style={{ color: '#c7d1db', lineHeight: 21 }}>{message}</Text>
    {notice ? <Text accessibilityRole="alert" style={{ color: '#c7d1db' }}>{notice}</Text> : null}
  </View>;
}
