import React, { useState } from 'react';
import { Linking, Platform, Share, Text, View } from 'react-native';
import { ActionButton } from './primitives';

export function ShareMessage({ message, email = '' }: { message: string; email?: string }) {
  const [notice, setNotice] = useState('');
  const [showMessage, setShowMessage] = useState(false);
  const copy = async () => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) { await navigator.clipboard.writeText(message); setNotice('Invitation copied.'); }
      else { setShowMessage(true); setNotice('Select and copy the invitation below.'); }
    } catch { setShowMessage(true); setNotice('Select and copy the invitation below.'); }
  };
  const open = async (url: string) => {
    try { await Linking.openURL(url); } catch { setShowMessage(true); setNotice('Select and copy the message below into your messaging app.'); }
  };
  const share = async () => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) await navigator.share({ text: message });
      else if (Platform.OS !== 'web') await Share.share({ message });
      else if (typeof navigator !== 'undefined' && navigator.clipboard) { await navigator.clipboard.writeText(message); setNotice('Message copied.'); }
      else { setShowMessage(true); setNotice('Select and copy the message below.'); }
    } catch (error) { if (!(error instanceof Error && error.name === 'AbortError')) { setShowMessage(true); setNotice('Use Email or Text, or select and copy the message below.'); } }
  };
  return <View style={{ gap: 12 }}>
    <Text style={{ color: '#c7d1db' }}>Send the invitation with your preferred app.</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <ActionButton label="Email" accessibilityLabel="Email invitation" size="compact" onPress={() => open(`mailto:${encodeURIComponent(email)}?subject=NomNomGo%20plan%20invitation&body=${encodeURIComponent(message)}`)} />
      <ActionButton label="Text" accessibilityLabel="Text invitation" size="compact" onPress={() => open(`sms:${Platform.OS === 'ios' || (typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent)) ? '&' : '?'}body=${encodeURIComponent(message)}`)} />
      <ActionButton label="Share" accessibilityLabel="Share invitation" size="compact" onPress={share} />
      <ActionButton label="Copy" accessibilityLabel="Copy invitation" size="compact" onPress={copy} />
    </View>
    <ActionButton label={showMessage ? 'Hide message' : 'Preview message'} size="compact" tone="ghost" onPress={() => setShowMessage(!showMessage)} />
    {showMessage ? <Text selectable style={{ color: '#c7d1db', lineHeight: 21 }}>{message}</Text> : null}
    {notice ? <Text accessibilityRole="alert" style={{ color: '#c7d1db' }}>{notice}</Text> : null}
  </View>;
}
