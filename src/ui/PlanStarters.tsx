import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { accountRequest, getAlphaAccount } from '../data/accountStorage';
import { emptyProfile, starterChoices, type StarterProfile, type StarterSelection } from '../domain/planStarters';
import { ActionButton, Chip } from './primitives';
import { useTheme } from './ThemeProvider';

export function PlanStarters({value,onChange,context='local'}:{value:StarterSelection | null;onChange:(s:StarterSelection|null)=>void;context?:string}) {
  const {theme:{colors}}=useTheme();
  const [profile,setProfile]=useState(emptyProfile);
  const [name,setName]=useState('');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const account=getAlphaAccount()?.id;
  useEffect(()=>{
    let active=true;
    if (account) accountRequest<StarterProfile>({action:'learn.profile'}).then(p=>{if(active)setProfile(p);})
      .catch(()=>{if(active)setMessage('History is unavailable. You can still choose a starter.');});
    return ()=>{active=false;};
  },[account]);
  const row={flexDirection:'row' as const,flexWrap:'wrap' as const,gap:6};
  const choices=starterChoices(profile,context,value?.people);
  async function addCompanion() {
    if (!name.trim() || busy || !value) return;
    setBusy(true);
    try {
      const next=await accountRequest<StarterProfile>({action:'learn.companion',label:name.trim()});
      setProfile(next);
      const person=next.people.find(p=>p.label===name.trim());
      if (person) onChange({...value,people:[...new Set([...value.people,person.id])]});
      setName(''); setMessage('');
    } catch {setMessage('Could not save the companion. Try again.');}
    finally {setBusy(false);}
  }
  return <View style={{gap:8}}>
    <Text style={{fontWeight:'700',color:colors.textPrimary}}>Plan starters</Text>
    <View style={row}>{choices.map(s=><Chip key={s.id} label={s.label} selected={value?.id===s.id}
      onPress={()=>onChange(value?.id===s.id ? null : {id:s.id,people:s.people,intent:s.intent})}/>)}</View>
    {value && <><Text style={{color:colors.textSecondary}}>Plan for</Text><View style={row}>{(['food','activity','both'] as const).map(intent=>
      <Chip key={intent} label={{food:'Food',activity:'Activities',both:'Food and activities'}[intent]} selected={value.intent===intent} onPress={()=>onChange({...value,intent})}/>)}</View>
      {account && <><Text style={{color:colors.textSecondary}}>People · private until you choose to share</Text>
        <View style={row}><Chip label="Just me" selected={!value.people.length} onPress={()=>onChange({...value,people:[]})}/>
          {profile.people.map(p=><Chip key={p.id} label={p.label} selected={value.people.includes(p.id)}
            onPress={()=>onChange({...value,people:value.people.includes(p.id) ? value.people.filter(id=>id!==p.id) : [...value.people,p.id]})}/>)}</View>
        <View style={row}><TextInput accessibilityLabel="Private companion name" placeholder="Companion name (optional)" placeholderTextColor={colors.textTertiary}
          value={name} maxLength={60} onChangeText={setName} style={{color:colors.textPrimary,borderBottomWidth:1,borderColor:colors.textTertiary,flexGrow:1}}/>
          <ActionButton label="Add companion" size="compact" disabled={busy || !name.trim()} onPress={addCompanion}/></View></>}
    </>}
    {!!message && <Text accessibilityLiveRegion="polite" style={{color:colors.textSecondary}}>{message}</Text>}
  </View>;
}
