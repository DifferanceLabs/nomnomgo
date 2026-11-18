export type Intent = 'food' | 'activity' | 'both';
export type StarterSelection = { id: string; people: string[]; intent: Intent };
export const starters: readonly { id: string; label: string; intent: Intent }[] = [
  { id: 'family-outing', label: 'Outing with the family', intent: 'both' },
  { id: 'father-son', label: 'Father and son fun', intent: 'both' },
  { id: 'friends', label: 'Get together with friends', intent: 'both' },
];
export type Signal = { starter: string | null; people: string[]; kind: string; at: string;
  intent: Intent | null; context: string; categories: string[] | null; interpretation?: {intent?: string};
  places?: { id: string; types?: string[] | null }[] };
export type StarterProfile = { people: {id:string;label:string}[]; signals: Signal[]; favoriteCategories: string[] };
export const emptyProfile: StarterProfile = {people:[], signals:[], favoriteCategories:[]};

function strength(kind: string) {
  if (['more','different','favorite'].includes(kind)) return 2;
  return kind === 'plan-completed' ? 1 : 0;
}
// Compare explicit responses first, then completed outings, then saved choices and recency.
function score(signals: Signal[]) {
  const scores = [0,0,0,0];
  for (const s of signals) {
    scores[2-strength(s.kind)] += s.kind === 'different' ? -1 : 1;
    scores[3] = Math.max(scores[3], Date.parse(s.at) || 0);
  }
  return scores;
}
function compare(a:number[], b:number[]) {
  for (let i=0;i<a.length;i++) if (a[i]!==b[i]) return b[i]-a[i];
  return 0;
}
function inferredIntent(s:Signal):Intent | null {
  if (s.intent && s.intent !== 'both') return s.intent;
  const interpreted=s.interpretation?.intent;
  if (interpreted==='activity' || interpreted==='food' || interpreted==='both') return interpreted;
  const food=s.categories?.some(c=>c==='food' || c==='dessert');
  const activity=s.categories?.includes('activity');
  if (food || activity) return food && activity ? 'both' : food ? 'food' : 'activity';
  return s.intent;
}
export function starterChoices(profile:StarterProfile, context='local', selectedPeople:string[]=[]) {
  const groupKey=(people:string[])=>[...people].sort().join('|');
  const validPeople=new Set(profile.people.map(p=>p.id));
  const relevant=profile.signals.filter(s=>s.context===context &&
    (!selectedPeople.length || groupKey(s.people)===groupKey(selectedPeople)));
  return starters.map(starter=>{
    const history=relevant.filter(s=>s.starter===starter.id);
    const groups=new Map<string,Signal[]>();
    for (const s of history) {
      if (s.people.some(p=>!validPeople.has(p))) continue;
      const key=groupKey(s.people);
      groups.set(key,[...(groups.get(key) || []),s]);
    }
    const best=[...groups.values()].sort((a,b)=>compare(score(a),score(b)))[0];
    const people=selectedPeople.length ? selectedPeople : best && compare(score(best),[0,0,0,0]) < 0 ? best[0].people : [];
    const matching=relevant.filter(s=>groupKey(s.people)===groupKey(people) && (!s.starter || s.starter===starter.id));
    const intents:Intent[]=[starter.intent,...(['food','activity','both'] as Intent[]).filter(v=>v!==starter.intent)];
    function intentScore(intent:Intent) {
      const result=score(matching.filter(s=>inferredIntent(s)===intent));
      if (!people.length) result[0]+=profile.favoriteCategories.filter(v=>v===intent).length;
      return result;
    }
    const intent=intents.sort((a,b)=>compare(intentScore(a),intentScore(b)))[0];
    return {...starter, people, intent, score:score(history)};
  }).sort((a,b)=>compare(a.score,b.score));
}
