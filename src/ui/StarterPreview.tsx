import { useEffect, useMemo, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { SearchExecution } from '../domain/searchExecution';
import type { AreaKind, AreaLocation, AreaMatch } from '../domain/searchArea';
import type { StarterProfile, StarterSelection } from '../domain/planStarters';
import {
  starterOptions,
  swapOptions,
  type Candidate,
  type StarterOuting,
  type VisitTiming,
} from '../domain/starterOuting';
import { ActionButton } from './primitives';
import { SearchAreaPicker } from './SearchAreaPicker';
import { useTheme } from './ThemeProvider';

export type PreviewSettings = {
  areaKey: string;
  requestKey: string;
  timing: Omit<VisitTiming, 'now'>;
  favorites: string[];
  busy: boolean;
  resolveCenter: (query?: string) => Promise<AreaLocation | null | undefined>;
  search: (center: AreaLocation, execution: SearchExecution) => Promise<Candidate[]>;
  loadAreas: (kind: AreaKind, execution: SearchExecution, base: AreaLocation) => Promise<AreaMatch[]>;
  onUse: (outing: StarterOuting) => Promise<void>;
};
type Props = PreviewSettings & { value: StarterSelection; profile: StarterProfile; context: string };

export function StarterPreview(props: Props) {
  const {
    theme: { colors },
  } = useTheme();
  const [area, setArea] = useState<AreaLocation | null>(null);
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [showArea, setShowArea] = useState(false);
  const [phase, setPhase] = useState<'loading' | 'area' | 'error' | 'ready'>('loading');
  const [loaded, setResult] = useState<{
    key: string;
    center: AreaLocation;
    candidates: Candidate[];
    now: number;
  }>();
  const [swap, setSwap] = useState<{ options: ReturnType<typeof starterOptions>; index: number }>();
  const [using, setUsing] = useState(false);
  const submitting = useRef(false);
  const latest = useRef(props);
  latest.current = props;
  const key = JSON.stringify([props.requestKey, props.value.intent, area, submitted, attempt]);
  const result = loaded?.key === key ? loaded : undefined;
  useEffect(() => {
    const exec = new SearchExecution(attempt);
    setResult(undefined);
    setPhase('loading');
    setSwap(undefined);
    const timer = setTimeout(async () => {
      let center: AreaLocation | null | undefined;
      try {
        center = area || (await latest.current.resolveCenter(submitted));
        exec.check();
        if (!center) {
          setPhase('area');
          return;
        }
        const candidates = await latest.current.search(center, exec);
        exec.check();
        setResult({ key, center, candidates, now: Date.now() });
        setPhase('ready');
      } catch {
        if (!exec.controller.signal.aborted) setPhase(center ? 'error' : 'area');
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      exec.cancel();
    };
  }, [area, submitted, attempt, key]);

  const { value, context, profile, favorites, timing } = props;
  const options = useMemo(
    () =>
      result
        ? starterOptions(
            result.candidates,
            result.center,
            { date: timing.date, start: timing.start, end: timing.end, now: result.now },
            profile,
            value,
            context,
            favorites,
          )
        : [],
    [result, timing.date, timing.start, timing.end, profile, value, context, favorites],
  );
  const current = swap?.options === options ? options[swap.index] : options[0];
  const primary = { color: colors.textPrimary, fontWeight: '700' as const };
  const hint = { color: colors.textSecondary };
  const canUse = current && result && phase === 'ready';
  async function useOuting() {
    if (!canUse || submitting.current || props.busy) return;
    submitting.current = true;
    setUsing(true);
    try {
      await props.onUse({ center: result!.center, stops: current.stops, miles: current.miles });
    } finally {
      submitting.current = false;
      setUsing(false);
    }
  }
  return (
    <View style={{ gap: 10, padding: 14, backgroundColor: colors.surfaceInteractive, borderRadius: 12 }}>
      <Text accessibilityRole="header" style={primary}>
        Suggested outing
      </Text>
      {phase === 'loading' && (
        <Text accessibilityLiveRegion="polite" style={hint}>
          Finding nearby stops…
        </Text>
      )}
      {phase === 'area' && <Text style={hint}>Choose an area for your outing.</Text>}
      {phase === 'error' && (
        <Text style={hint}>Places couldn’t be loaded. Try again or keep planning manually.</Text>
      )}
      {result && (
        <Text style={hint}>
          {[result.center.label || 'Your selected area', timing.date].filter(Boolean).join(' · ')}
        </Text>
      )}
      {phase === 'ready' && !current && (
        <Text style={hint}>No stops fit this area and time. Change the area or keep planning manually.</Text>
      )}
      {current?.stops.map((stop, index) => {
        const alternatives = swapOptions(options, current, index);
        const next =
          alternatives.find((option) => options.indexOf(option) > options.indexOf(current)) || alternatives[0];
        return (
          <View key={stop.slot} style={{ gap: 3 }}>
            {index > 0 && current.miles !== undefined && (
              <Text style={hint}>{current.miles.toFixed(1)} mi between stops</Text>
            )}
            <Text style={primary}>{stop.item.title}</Text>
            <Text style={hint}>
              {stop.slot === 'food' ? 'Food' : 'Activity'} · about {stop.durationMinutes} min
            </Text>
            <Text style={hint}>{stop.hours}</Text>
            {stop.reason && <Text style={{ color: colors.textPrimary }}>{stop.reason}</Text>}
            {next && (
              <ActionButton
                label={'Swap ' + (stop.slot === 'food' ? 'food stop' : 'activity')}
                size="compact"
                disabled={using}
                onPress={() => setSwap({ options, index: options.indexOf(next) })}
              />
            )}
          </View>
        );
      })}
      {canUse && (
        <ActionButton
          label={using ? 'Starting outing…' : 'Use this outing'}
          tone="primary"
          disabled={using || props.busy}
          onPress={useOuting}
        />
      )}
      {(phase === 'area' || phase === 'error') && (
        <ActionButton label="Try again" size="compact" onPress={() => setAttempt((a) => a + 1)} />
      )}
      {phase === 'ready' && (
        <ActionButton
          label={showArea ? 'Hide area choices' : 'Change area'}
          size="compact"
          onPress={() => setShowArea(!showArea)}
        />
      )}
      {(phase === 'area' || showArea) && (
        <>
          <TextInput
            accessibilityLabel="Starter search city or ZIP"
            placeholder="City or ZIP"
            placeholderTextColor={colors.textTertiary}
            style={{
              color: colors.textPrimary,
              borderBottomColor: colors.textSecondary,
              borderBottomWidth: 1,
              padding: 8,
            }}
            value={query}
            onChangeText={setQuery}
          />
          {!!query.trim() && (
            <ActionButton
              label="Search this area"
              size="compact"
              onPress={() => {
                setArea(null);
                setSubmitted(query.trim());
                setAttempt((n) => n + 1);
                setShowArea(false);
              }}
            />
          )}
          <SearchAreaPicker
            forPreview
            location={area || result?.center || null}
            contextKey={submitted + '|' + props.requestKey}
            onLoad={async (kind, execution) => {
              const location = result?.center || (await props.resolveCenter(submitted));
              if (!location) throw new Error('Choose a base area.');
              const base = location.areaFocus?.base || location;
              return { base, matches: await props.loadAreas(kind, execution, base) };
            }}
            onSelect={async (next) => {
              setArea(next || area?.areaFocus?.base || null);
              setAttempt((n) => n + 1);
              setShowArea(false);
            }}
          />
        </>
      )}
    </View>
  );
}
