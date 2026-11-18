import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Text, TextInput, View } from 'react-native';
import { SearchExecution } from '../domain/searchExecution';
import { areaDistanceMeters, METERS_PER_MILE, type AreaLocation } from '../domain/searchArea';
import { plannedHoursDisplay } from '../../placeHours';
import type { Candidate, OutingOption, StarterPlace, StarterSlot } from '../domain/starterOuting';
import { ActionButton } from './primitives';
import { useTheme } from './ThemeProvider';

export type SwapSearchProps = {
  searchReplacements: (
    slot: StarterSlot,
    query: string,
    area: AreaLocation,
    execution: SearchExecution,
  ) => Promise<Candidate[]>;
  renderSearchResult: (place: StarterPlace, slot: StarterSlot, index: number, distance: string) => ReactNode;
};
type Props = SwapSearchProps & {
  current: OutingOption;
  index: number;
  area: AreaLocation;
  nearby: Candidate[];
  fit: (candidate: Candidate) => OutingOption | undefined;
  onChoose: (option: OutingOption) => void;
  onClose: () => void;
};
export function StarterSwapSearch({
  current,
  index,
  area,
  nearby,
  searchReplacements,
  renderSearchResult,
  fit,
  onChoose,
  onClose,
}: Props) {
  const {
    theme: { colors },
  } = useTheme();
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<Candidate[]>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [visible, setVisible] = useState(6);
  const pending = useRef<SearchExecution | null>(null);
  useEffect(() => () => pending.current?.cancel(), []);
  const slot = current.stops[index].slot;
  async function search() {
    pending.current?.cancel();
    setVisible(6);
    setError(false);
    if (!query.trim()) {
      setMatches(undefined);
      setLoading(false);
      return;
    }
    const exec = new SearchExecution(0);
    pending.current = exec;
    setLoading(true);
    setMatches([]);
    try {
      const found = await searchReplacements(slot, query.trim(), area, exec);
      exec.check();
      setMatches(found);
    } catch {
      if (!exec.controller.signal.aborted) setError(true);
    } finally {
      if (!exec.controller.signal.aborted) setLoading(false);
    }
  }
  const list = (matches ?? nearby).filter(
    (c) => c.slot === slot && !current.stops.some((s) => s.item.id === c.item.id),
  );
  return (
    <View style={{ gap: 8 }}>
      <Text accessibilityRole="header" style={{ fontWeight: '700', color: colors.textPrimary }}>
        Replace {current.stops[index].item.title}
      </Text>
      <TextInput
        accessibilityLabel="Search replacement places"
        placeholder={slot === 'food' ? 'Restaurant, cuisine or café' : 'Activity or place name'}
        placeholderTextColor={colors.textTertiary}
        value={query}
        maxLength={120}
        onChangeText={(text) => {
          pending.current?.cancel();
          setQuery(text);
          setMatches(undefined);
          setLoading(false);
          setError(false);
          setVisible(6);
        }}
        onSubmitEditing={() => void search()}
        returnKeyType="search"
        style={{
          color: colors.textPrimary,
          borderColor: colors.textSecondary,
          borderWidth: 1,
          borderRadius: 8,
          padding: 10,
        }}
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <ActionButton label="Search" size="compact" onPress={search} />
        <ActionButton label="Cancel" size="compact" onPress={onClose} />
      </View>
      {loading || error || !list.length ? (
        <Text accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>
          {loading
            ? 'Searching…'
            : error
              ? 'Places couldn’t be loaded. Try searching again.'
              : 'No matching places. Try a different search.'}
        </Text>
      ) : null}
      {list.slice(0, visible).map((candidate, rank) => {
        const { item } = candidate;
        const option = fit(candidate);
        const visit = option?.stops[index] || current.stops[index];
        const clock = (m: number) =>
          String(Math.floor((m % 1440) / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
        const display = {
          ...item,
          ...plannedHoursDisplay(
            item,
            visit.date,
            clock(visit.minute) + ' - ' + clock(visit.minute + visit.durationMinutes),
          ),
        };
        const meters = areaDistanceMeters(area, { latitude: item.lat!, longitude: item.lng! });
        const distance = Number.isFinite(meters) ? (meters / METERS_PER_MILE).toFixed(1) + ' mi' : '';
        return (
          <View
            key={item.id}
            style={{ padding: 10, gap: 8, backgroundColor: colors.surface, borderRadius: 10 }}
          >
            {renderSearchResult(display, slot, rank, distance)}
            <ActionButton
              label={option ? 'Choose this stop' : 'Doesn’t fit this outing'}
              accessibilityLabel={'Choose ' + item.title}
              size="compact"
              disabled={!option}
              onPress={() => {
                if (option) onChoose(option);
              }}
            />
          </View>
        );
      })}
      {list.length > visible && (
        <ActionButton label="Load more" size="compact" onPress={() => setVisible((v) => v + 6)} />
      )}
    </View>
  );
}
