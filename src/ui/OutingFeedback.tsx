import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { outingRequest } from '../data/accountStorage';
import { ActionButton, Chip } from './primitives';
import { useTheme } from './ThemeProvider';

type State=Awaited<ReturnType<typeof outingRequest>>;
export function OutingFeedback({sourceKey,sharedId,onFavorite}:{sourceKey?:string;sharedId?:string;onFavorite:(raw:string)=>void}) {
  const [state,setState]=useState<State|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [actualsOpen,setActualsOpen]=useState(false);
  const [minutes,setMinutes]=useState('');
  const [spend,setSpend]=useState('');
  const {theme:{colors}}=useTheme();
  useEffect(()=>{
    let active=true;
    let timer:ReturnType<typeof setTimeout>;
    setState(null);setError('');
    const read=async(attempt:number)=>{
      try { const next=await outingRequest({action:'learn.outing',sourceKey,sharedId}); if(active)setState(next); }
      catch(e) {
        if(!active)return;
        if((e as {status?:number}).status===404 && attempt<2) timer=setTimeout(()=>void read(attempt+1),400);
        else if ((e as {status?:number}).status!==404) setError('Could not load outing feedback.');
      }
    };
    void read(0);
    return ()=>{active=false;clearTimeout(timer);};
  },[sourceKey,sharedId]);
  async function change(value?:string,placeId?:string) {
    if(busy)return;
    setBusy(true);setError('');
    try {
      const actuals: {durationMinutes?:number;spendMinorUnits?:number;currency?:string}={};
      if (!value && actualsOpen) {
        if (minutes && !/^[0-9]{1,5}$/.test(minutes)) throw new Error('Enter duration in whole minutes.');
        if (spend && !/^[0-9]{1,7}([.][0-9]{1,2})?$/.test(spend)) throw new Error('Enter spending in dollars and cents.');
        if (minutes) actuals.durationMinutes=Number(minutes);
        if (spend) {actuals.spendMinorUnits=Math.round(Number(spend)*100);actuals.currency='USD';}
      }
      const next=await outingRequest({action:value?'learn.feedback':'learn.complete',sourceKey,sharedId,value,placeId,
        actuals:Object.keys(actuals).length ? actuals : undefined});
      setState(next);
      if(next.memory?.value) onFavorite(next.memory.value);
    }catch(e){setError(e instanceof Error ? e.message : 'Please try again.');}
    finally{setBusy(false);}
  }
  return <View style={{gap:6}}>
    {state?.owner && !state.completed && <><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
      <ActionButton label="Mark complete" size="compact" onPress={()=>change()} disabled={busy}/>
      <Chip label="Add actuals" selected={actualsOpen} onPress={()=>setActualsOpen(!actualsOpen)}/></View>
      {actualsOpen && <View style={{gap:6}}>{[{label:'Actual minutes',value:minutes,set:setMinutes},{label:'Actual spending (USD)',value:spend,set:setSpend}].map(({label,value,set})=>
        <TextInput key={label} accessibilityLabel={label} placeholder={label} value={value}
          onChangeText={set} keyboardType="decimal-pad" placeholderTextColor={colors.textTertiary} style={{color:colors.textPrimary,minHeight:36}}/>)}</View>}</>}
    {state?.completed && <><Text style={{fontWeight:'700',color:colors.textPrimary}}>Outing completed</Text>
    <View style={{flexDirection:'row',gap:6,flexWrap:'wrap'}}>
      <Chip label="More like this" selected={state.feedback==='more'} disabled={busy} onPress={()=>change('more')}/>
      <Chip label="Something different" selected={state.feedback==='different'} disabled={busy} onPress={()=>change('different')}/>
    </View>
    {state.stops.filter((s,i,a)=>a.findIndex(other=>other.id===s.id)===i).map(s=><View key={s.id} style={{flexDirection:'row',alignItems:'center',gap:8,flexWrap:'wrap'}}>
      <Text style={{color:colors.textPrimary}}>{s.title}</Text><Chip label={s.favorite?'Favorited':'Favorite this place'} accessibilityLabel={'Favorite this place: '+s.title}
        selected={s.favorite} disabled={busy || s.favorite} onPress={()=>change('favorite',s.id)}/>
    </View>)}</>}
    {!!error && <Text accessibilityLiveRegion="polite" style={{color:colors.textSecondary}}>{error}</Text>}
  </View>;
}
