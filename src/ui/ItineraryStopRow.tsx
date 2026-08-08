import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState, type ComponentProps } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type AccessibilityActionEvent,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { FadeInDown, interpolateColor, useAnimatedStyle } from 'react-native-reanimated';
import Sortable, { useItemContext } from 'react-native-sortables';

import {
  MIN_STOP_DURATION_MINUTES,
  adjustStopDurationMinutes,
  formatItineraryDuration,
  snapStopDurationMinutes,
  type ItineraryStopKind,
} from '../domain/itinerary';
import type { TravelMode } from '../domain/plan';
import {
  borders,
  colors,
  controls,
  iconSizes,
  radii,
  semanticTones,
  spacing,
  typography,
} from './theme';

type IconName = ComponentProps<typeof Ionicons>['name'];
type PressHandler = () => void | Promise<void>;

export type ItineraryStopTravelMode = TravelMode;

export type ItineraryTravelToNext = {
  durationMinutes?: number;
  durationLabel?: string;
  label?: string;
  mode?: ItineraryStopTravelMode;
};

export type ItineraryStopRowProps = {
  number: number;
  kind: ItineraryStopKind;
  name: string;
  arrivalTime: string;
  durationMinutes: number;
  location?: string;
  travelToNext?: ItineraryTravelToNext | null;
  expanded: boolean;
  onToggleExpanded: () => void;
  onDurationChange: (durationMinutes: number) => void;
  durationEditorExpanded?: boolean;
  onDurationEditorExpandedChange?: (expanded: boolean) => void;
  onMapPress?: PressHandler;
  onWebsitePress?: PressHandler;
  onSharePress?: PressHandler;
  onEditPress?: PressHandler;
  onDeletePress?: PressHandler;
  onMoveUp?: PressHandler;
  onMoveDown?: PressHandler;
  travelMode?: ItineraryStopTravelMode;
  onTravelModeChange?: (mode: ItineraryStopTravelMode) => void;
  featureOptions?: readonly string[];
  selectedFeatures?: readonly string[];
  onToggleFeature?: (feature: string) => void;
  animateEntrance?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const KIND_ICON: Record<ItineraryStopKind, IconName> = {
  food: 'restaurant-outline',
  activity: 'walk-outline',
  dessert: 'ice-cream-outline',
  idea: 'bulb-outline',
};

const KIND_LABEL: Record<ItineraryStopKind, string> = {
  food: 'Food',
  activity: 'Activity',
  dessert: 'Dessert',
  idea: 'Idea',
};

const TRAVEL_MODES: readonly { mode: ItineraryStopTravelMode; label: string; icon: IconName }[] = [
  { mode: 'car', label: 'Drive', icon: 'car-outline' },
  { mode: 'walk', label: 'Walk', icon: 'walk-outline' },
  { mode: 'bike', label: 'Bike', icon: 'bicycle-outline' },
  { mode: 'train', label: 'Train', icon: 'train-outline' },
  { mode: 'plane', label: 'Plane', icon: 'airplane-outline' },
];

function travelMeta(mode: ItineraryStopTravelMode = 'car') {
  return TRAVEL_MODES.find((option) => option.mode === mode) ?? TRAVEL_MODES[0];
}

function runPress(handler?: PressHandler) {
  if (handler) void handler();
}

type CompactActionProps = {
  label: string;
  accessibilityLabel?: string;
  icon: IconName;
  onPress?: PressHandler;
  danger?: boolean;
  expanded?: boolean;
  testID?: string;
};

function CompactAction({
  label,
  accessibilityLabel,
  icon,
  onPress,
  danger = false,
  expanded,
  testID,
}: CompactActionProps) {
  const disabled = !onPress;
  return (
    <TouchableOpacity
      activeOpacity={0.72}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ disabled, expanded }}
      disabled={disabled}
      onPress={() => runPress(onPress)}
      style={[
        styles.compactAction,
        danger && styles.compactActionDanger,
        disabled && styles.controlDisabled,
      ]}
      testID={testID}
    >
      <Ionicons
        color={danger ? colors.red : colors.textSecondary}
        name={icon}
        size={iconSizes.sm}
      />
      <Text
        numberOfLines={1}
        style={[styles.compactActionLabel, danger && styles.compactActionDangerLabel]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

type MoreActionProps = {
  label: string;
  icon: IconName;
  onPress?: PressHandler;
  disabled?: boolean;
  selected?: boolean;
};

function MoreAction({ label, icon, onPress, disabled = false, selected = false }: MoreActionProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.72}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={() => runPress(onPress)}
      style={[
        styles.moreAction,
        selected && styles.moreActionSelected,
        disabled && styles.controlDisabled,
      ]}
    >
      <Ionicons
        color={selected ? colors.cyan : colors.textSecondary}
        name={icon}
        size={iconSizes.sm}
      />
      <Text numberOfLines={1} style={[styles.moreActionLabel, selected && styles.moreActionLabelSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function ItineraryStopRow({
  number,
  kind,
  name,
  arrivalTime,
  durationMinutes,
  location,
  travelToNext,
  expanded,
  onToggleExpanded,
  onDurationChange,
  durationEditorExpanded,
  onDurationEditorExpandedChange,
  onMapPress,
  onWebsitePress,
  onSharePress,
  onEditPress,
  onDeletePress,
  onMoveUp,
  onMoveDown,
  travelMode,
  onTravelModeChange,
  featureOptions = [],
  selectedFeatures = [],
  onToggleFeature,
  animateEntrance = false,
  style,
  testID,
}: ItineraryStopRowProps) {
  const { width: viewportWidth } = useWindowDimensions();
  const tone = semanticTones[kind];
  const { activationAnimationProgress, isActive } = useItemContext();
  const [internalDurationEditorExpanded, setInternalDurationEditorExpanded] = useState(false);
  const [moreExpanded, setMoreExpanded] = useState(false);
  const durationEditorOpen = expanded && (
    durationEditorExpanded ?? internalDurationEditorExpanded
  );
  const safeDurationMinutes = snapStopDurationMinutes(durationMinutes);
  const kindLabel = KIND_LABEL[kind];
  const nextTravelMode = travelToNext?.mode ?? travelMode ?? 'car';
  const nextTravelMeta = travelMeta(nextTravelMode);
  const travelDuration = travelToNext?.durationLabel ?? (
    typeof travelToNext?.durationMinutes === 'number'
      ? formatItineraryDuration(travelToNext.durationMinutes)
      : undefined
  );
  const travelLabel = travelToNext?.label ?? nextTravelMeta.label.toLowerCase();
  const narrowSummary = viewportWidth <= 340;

  useEffect(() => {
    if (!expanded) {
      setInternalDurationEditorExpanded(false);
      setMoreExpanded(false);
    }
  }, [expanded]);

  const animatedCardStyle = useAnimatedStyle(() => {
    const animationProgress = activationAnimationProgress.value;
    const progress = isActive.value ? Math.max(0.18, animationProgress) : animationProgress;
    const restingBorder = expanded ? tone.border : colors.border;
    const restingSurface = expanded ? tone.soft : tone.surface;

    return {
      backgroundColor: interpolateColor(progress, [0, 1], [restingSurface, colors.surfaceInteractive]),
      borderColor: interpolateColor(progress, [0, 1], [restingBorder, tone.accent]),
      elevation: 2 + progress * 8,
      shadowColor: tone.solid,
      shadowOffset: { width: 0, height: 6 + progress * 6 },
      shadowOpacity: 0.08 + progress * 0.25,
      shadowRadius: 8 + progress * 10,
      transform: [
        { translateY: -2 * progress },
        { scale: 1 + 0.012 * progress },
      ],
    };
  }, [expanded, tone.accent, tone.border, tone.soft, tone.solid, tone.surface]);

  const setDurationEditorOpen = (nextExpanded: boolean) => {
    if (durationEditorExpanded === undefined) setInternalDurationEditorExpanded(nextExpanded);
    onDurationEditorExpandedChange?.(nextExpanded);
  };

  const handleRowPress = () => {
    if (expanded) {
      setDurationEditorOpen(false);
      setMoreExpanded(false);
    }
    onToggleExpanded();
  };

  const handleDurationPress = (event: GestureResponderEvent) => {
    event.stopPropagation();
    if (!expanded) onToggleExpanded();
    setDurationEditorOpen(true);
  };

  const changeDuration = (direction: -1 | 1) => {
    onDurationChange(adjustStopDurationMinutes(safeDurationMinutes, direction));
  };

  const handleReorderAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'decrement') runPress(onMoveUp);
    if (event.nativeEvent.actionName === 'increment') runPress(onMoveDown);
  };

  const timingContent = (
    <View style={[styles.timingRow, narrowSummary && styles.narrowTimingCopy]}>
      <Text accessibilityLabel={`Arrive ${arrivalTime}`} numberOfLines={1} style={styles.arrival}>
        {narrowSummary ? arrivalTime : `Arrive ${arrivalTime}`}
      </Text>
      <Text accessibilityElementsHidden style={styles.timingDivider}>·</Text>
      <TouchableOpacity
        activeOpacity={0.72}
        accessibilityHint="Opens the inline duration editor"
        accessibilityLabel={`Time here ${formatItineraryDuration(safeDurationMinutes)}`}
        accessibilityRole="button"
        onPress={handleDurationPress}
        style={styles.durationButton}
        testID={testID ? `${testID}-duration` : undefined}
      >
        <Text numberOfLines={1} style={[styles.durationLabel, { color: tone.accent }]}>
          {formatItineraryDuration(safeDurationMinutes)}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const travelChipContent = travelDuration ? (
    <View
      accessibilityLabel={`${travelDuration} ${travelLabel} to next stop`}
      style={styles.travelChip}
    >
      <Ionicons color={colors.cyan} name={nextTravelMeta.icon} size={iconSizes.sm} />
      <View style={styles.travelChipCopy}>
        <Text numberOfLines={1} style={styles.travelDuration}>{travelDuration}</Text>
        <Text numberOfLines={1} style={styles.travelLabel}>{travelLabel}</Text>
      </View>
    </View>
  ) : null;

  return (
    <Animated.View
      entering={animateEntrance ? FadeInDown.duration(220) : undefined}
      style={[styles.row, style]}
      testID={testID}
    >
      <Sortable.Handle style={styles.handle}>
        <View
          accessible
          accessibilityActions={[
            ...(onMoveUp ? [{ name: 'decrement', label: `Move ${name} up` }] : []),
            ...(onMoveDown ? [{ name: 'increment', label: `Move ${name} down` }] : []),
          ]}
          accessibilityHint="Drag to reorder. Move up and Move down are also available in More."
          accessibilityLabel={`Reorder stop ${number}, ${name}`}
          accessibilityRole="adjustable"
          accessibilityValue={{ text: `Stop ${number}` }}
          onAccessibilityAction={handleReorderAccessibilityAction}
          style={styles.handleTarget}
        >
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.grip}>
            {Array.from({ length: 6 }, (_, index) => (
              <View key={index} style={styles.gripDot} />
            ))}
          </View>
        </View>
      </Sortable.Handle>

      <Animated.View
        style={[
          styles.card,
          expanded && styles.cardExpanded,
          animatedCardStyle,
        ]}
      >
        <View pointerEvents="none" style={[styles.typeRail, { backgroundColor: tone.solid }]} />

        <TouchableOpacity
          activeOpacity={0.78}
          accessible={false}
          onPress={handleRowPress}
          style={[styles.summary, narrowSummary && styles.summaryNarrow]}
          testID={testID ? `${testID}-summary` : undefined}
        >
          <View style={[styles.numberBadge, { backgroundColor: tone.solid }]}>
            <Text style={[styles.numberText, { color: tone.foreground }]}>{number}</Text>
          </View>

          <View style={[styles.kindIcon, { borderColor: tone.border }]}>
            <Ionicons color={tone.accent} name={KIND_ICON[kind]} size={iconSizes.sm} />
          </View>

          <View style={styles.summaryCopy}>
            <Text numberOfLines={1} style={styles.name}>
              {name}
            </Text>
            {!narrowSummary ? timingContent : null}
          </View>

          {!narrowSummary ? travelChipContent : null}

          <TouchableOpacity
            activeOpacity={0.72}
            accessibilityHint={expanded ? 'Collapses stop details' : 'Expands stop details'}
            accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} ${kindLabel} stop ${number}, ${name}`}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            onPress={(event) => {
              event.stopPropagation();
              handleRowPress();
            }}
            style={styles.chevron}
          >
            <Ionicons
              color={colors.textTertiary}
              name={expanded ? 'chevron-up' : 'chevron-forward'}
              size={iconSizes.sm}
            />
          </TouchableOpacity>

          {narrowSummary ? (
            <View style={styles.narrowTimingStrip}>
              {timingContent}
              {travelChipContent}
            </View>
          ) : null}
        </TouchableOpacity>

        {expanded ? (
          <View style={styles.expandedContent}>
            {location ? (
              <View style={styles.locationRow}>
                <Ionicons color={tone.accent} name="location-outline" size={iconSizes.sm} />
                <Text numberOfLines={2} style={styles.location}>{location}</Text>
              </View>
            ) : null}

            <View style={styles.timeSection}>
              <TouchableOpacity
                activeOpacity={0.74}
                accessibilityLabel={`Time here, ${formatItineraryDuration(safeDurationMinutes)}`}
                accessibilityRole="button"
                accessibilityState={{ expanded: durationEditorOpen }}
                onPress={() => setDurationEditorOpen(!durationEditorOpen)}
                style={styles.timeHeader}
              >
                <Text style={styles.timeHeaderLabel}>Time here</Text>
                <View style={styles.timeHeaderValue}>
                  <Text style={[styles.timeHeaderDuration, { color: tone.accent }]}>
                    {formatItineraryDuration(safeDurationMinutes)}
                  </Text>
                  <Ionicons
                    color={colors.textTertiary}
                    name={durationEditorOpen ? 'chevron-up' : 'chevron-down'}
                    size={iconSizes.xs}
                  />
                </View>
              </TouchableOpacity>

              {durationEditorOpen ? (
                <View style={styles.durationEditor}>
                  <TouchableOpacity
                    activeOpacity={0.72}
                    accessibilityLabel="Decrease time here by 15 minutes"
                    accessibilityRole="button"
                    accessibilityState={{ disabled: safeDurationMinutes <= MIN_STOP_DURATION_MINUTES }}
                    disabled={safeDurationMinutes <= MIN_STOP_DURATION_MINUTES}
                    onPress={() => changeDuration(-1)}
                    style={[
                      styles.stepperButton,
                      safeDurationMinutes <= MIN_STOP_DURATION_MINUTES && styles.controlDisabled,
                    ]}
                    testID={testID ? `${testID}-duration-decrease` : undefined}
                  >
                    <Ionicons color={colors.textPrimary} name="remove" size={iconSizes.md} />
                  </TouchableOpacity>

                  <View accessibilityLiveRegion="polite" style={styles.durationEditorValue}>
                    <Text style={styles.durationEditorText}>
                      {formatItineraryDuration(safeDurationMinutes)}
                    </Text>
                    <Text style={styles.durationEditorHint}>Adjust in 15 min</Text>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.72}
                    accessibilityLabel="Increase time here by 15 minutes"
                    accessibilityRole="button"
                    onPress={() => changeDuration(1)}
                    style={styles.stepperButton}
                    testID={testID ? `${testID}-duration-increase` : undefined}
                  >
                    <Ionicons color={colors.textPrimary} name="add" size={iconSizes.md} />
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>

            <View style={styles.compactActions}>
              <CompactAction
                accessibilityLabel={`Open ${name} in Maps`}
                icon="map-outline"
                label="Map"
                onPress={onMapPress}
                testID={testID ? `${testID}-map` : undefined}
              />
              <CompactAction
                accessibilityLabel={`Open ${name} website`}
                icon="globe-outline"
                label="Website"
                onPress={onWebsitePress}
                testID={testID ? `${testID}-website` : undefined}
              />
              <CompactAction
                accessibilityLabel={`Share ${name}`}
                icon="share-outline"
                label="Share"
                onPress={onSharePress}
                testID={testID ? `${testID}-share` : undefined}
              />
              <CompactAction
                accessibilityLabel={moreExpanded ? 'Hide edit options' : 'Show stop edit options'}
                expanded={moreExpanded}
                icon="ellipsis-horizontal"
                label="Edit"
                onPress={() => setMoreExpanded((current) => !current)}
                testID={testID ? `${testID}-more` : undefined}
              />
              <CompactAction
                accessibilityLabel={`Delete ${name}`}
                danger
                icon="trash-outline"
                label="Delete"
                onPress={onDeletePress}
                testID={testID ? `${testID}-delete` : undefined}
              />
            </View>

            {moreExpanded ? (
              <View style={styles.moreArea}>
                <Text style={styles.moreAreaTitle}>Stop options</Text>
                <View style={styles.moreActionRow}>
                  {onEditPress ? (
                    <MoreAction icon="create-outline" label="Edit stop" onPress={onEditPress} />
                  ) : null}
                  <MoreAction
                    disabled={!onMoveUp}
                    icon="arrow-up-outline"
                    label="Move up"
                    onPress={onMoveUp}
                  />
                  <MoreAction
                    disabled={!onMoveDown}
                    icon="arrow-down-outline"
                    label="Move down"
                    onPress={onMoveDown}
                  />
                </View>

                {onTravelModeChange ? (
                  <View style={styles.moreGroup}>
                    <Text style={styles.moreGroupLabel}>Travel to next stop</Text>
                    <View style={styles.moreActionRow}>
                      {TRAVEL_MODES.map((option) => (
                        <MoreAction
                          key={option.mode}
                          icon={option.icon}
                          label={option.label}
                          onPress={() => onTravelModeChange(option.mode)}
                          selected={nextTravelMode === option.mode}
                        />
                      ))}
                    </View>
                  </View>
                ) : null}

                {featureOptions.length ? (
                  <View style={styles.moreGroup}>
                    <Text style={styles.moreGroupLabel}>Things here</Text>
                    <View style={styles.featureList}>
                      {featureOptions.map((feature) => {
                        const selected = selectedFeatures.includes(feature);
                        return (
                          <TouchableOpacity
                            key={feature}
                            activeOpacity={0.72}
                            accessibilityLabel={feature}
                            accessibilityRole="button"
                            accessibilityState={{ disabled: !onToggleFeature, selected }}
                            disabled={!onToggleFeature}
                            onPress={() => onToggleFeature?.(feature)}
                            style={[
                              styles.featureChip,
                              selected && { backgroundColor: tone.soft, borderColor: tone.border },
                              !onToggleFeature && styles.controlDisabled,
                            ]}
                          >
                            <Ionicons
                              color={selected ? tone.accent : colors.textTertiary}
                              name={selected ? 'checkmark-circle' : 'add-circle-outline'}
                              size={iconSizes.sm}
                            />
                            <Text
                              numberOfLines={2}
                              style={[styles.featureChipLabel, selected && { color: tone.accent }]}
                            >
                              {feature}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'stretch',
    flexDirection: 'row',
    width: '100%',
  },
  handle: {
    alignSelf: 'stretch',
    width: controls.minimumTouchTarget,
  },
  handleTarget: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 68,
    width: controls.minimumTouchTarget,
  },
  grip: {
    columnGap: spacing.micro,
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.micro,
    width: 12,
  },
  gripDot: {
    backgroundColor: colors.textTertiary,
    borderRadius: radii.pill,
    height: 3,
    width: 3,
  },
  card: {
    borderRadius: radii.sm,
    borderWidth: borders.thin,
    flex: 1,
    minWidth: 0,
  },
  cardExpanded: {
    borderWidth: borders.strong,
  },
  typeRail: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
    width: 3,
  },
  summary: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 68,
    paddingLeft: spacing.xs,
  },
  summaryNarrow: {
    flexWrap: 'wrap',
    paddingBottom: spacing.micro,
  },
  numberBadge: {
    alignItems: 'center',
    borderRadius: radii.pill,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  numberText: {
    ...typography.caption,
    fontWeight: '800',
  },
  kindIcon: {
    alignItems: 'center',
    borderRadius: radii.pill,
    borderWidth: borders.thin,
    height: 28,
    justifyContent: 'center',
    marginLeft: spacing.micro,
    width: 28,
  },
  summaryCopy: {
    flex: 1,
    marginLeft: spacing.micro,
    minWidth: 0,
    paddingVertical: spacing.xs,
  },
  name: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  timingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: controls.minimumTouchTarget,
  },
  narrowTimingStrip: {
    alignItems: 'center',
    flexBasis: '100%',
    flexDirection: 'row',
    paddingLeft: spacing.xs,
    paddingRight: spacing.micro,
  },
  narrowTimingCopy: {
    flex: 1,
    minWidth: 0,
  },
  arrival: {
    ...typography.caption,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  timingDivider: {
    ...typography.caption,
    color: colors.textTertiary,
    marginHorizontal: spacing.micro,
  },
  durationButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: controls.minimumTouchTarget,
    minWidth: controls.minimumTouchTarget,
  },
  durationLabel: {
    ...typography.caption,
  },
  travelChip: {
    alignItems: 'center',
    backgroundColor: colors.cyanSoft,
    borderColor: semanticTones.travel.border,
    borderRadius: radii.sm,
    borderWidth: borders.thin,
    flexDirection: 'row',
    minHeight: controls.minimumTouchTarget,
    paddingHorizontal: spacing.micro,
  },
  travelChipCopy: {
    marginLeft: spacing.hairline,
    maxWidth: 44,
  },
  travelDuration: {
    color: colors.cyan,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  travelLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    lineHeight: 13,
  },
  chevron: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: controls.minimumTouchTarget,
    width: controls.minimumTouchTarget,
  },
  expandedContent: {
    borderTopColor: colors.divider,
    borderTopWidth: borders.thin,
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  locationRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
  },
  location: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  timeSection: {
    backgroundColor: colors.backgroundRaised,
    borderColor: colors.divider,
    borderRadius: radii.xs,
    borderWidth: borders.thin,
    marginTop: spacing.xs,
    overflow: 'hidden',
  },
  timeHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: controls.minimumTouchTarget,
    paddingHorizontal: spacing.xs,
  },
  timeHeaderLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  timeHeaderValue: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.micro,
  },
  timeHeaderDuration: {
    ...typography.caption,
  },
  durationEditor: {
    alignItems: 'center',
    borderTopColor: colors.divider,
    borderTopWidth: borders.thin,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.xs,
  },
  stepperButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceInteractive,
    borderColor: colors.borderStrong,
    borderRadius: radii.pill,
    borderWidth: borders.thin,
    height: controls.minimumTouchTarget,
    justifyContent: 'center',
    width: controls.minimumTouchTarget,
  },
  durationEditorValue: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    paddingHorizontal: spacing.xs,
  },
  durationEditorText: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  durationEditorHint: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  compactActions: {
    flexDirection: 'row',
    gap: 0,
    marginHorizontal: -spacing.xs,
    marginTop: spacing.xs,
  },
  compactAction: {
    alignItems: 'center',
    backgroundColor: colors.backgroundRaised,
    borderColor: colors.border,
    borderRadius: 0,
    borderWidth: borders.thin,
    flexBasis: controls.minimumTouchTarget,
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: 50,
    minWidth: controls.minimumTouchTarget,
    paddingHorizontal: spacing.hairline,
  },
  compactActionDanger: {
    backgroundColor: colors.redSoft,
    borderColor: semanticTones.danger.border,
  },
  compactActionLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 13,
    marginTop: spacing.micro,
  },
  compactActionDangerLabel: {
    color: colors.red,
  },
  moreArea: {
    backgroundColor: colors.backgroundRaised,
    borderColor: colors.divider,
    borderRadius: radii.xs,
    borderWidth: borders.thin,
    marginTop: spacing.xs,
    padding: spacing.xs,
  },
  moreAreaTitle: {
    ...typography.caption,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  moreActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.micro,
  },
  moreAction: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.xs,
    borderWidth: borders.thin,
    flexDirection: 'row',
    gap: spacing.micro,
    minHeight: controls.minimumTouchTarget,
    paddingHorizontal: spacing.xs,
  },
  moreActionSelected: {
    backgroundColor: colors.cyanSoft,
    borderColor: semanticTones.travel.border,
  },
  moreActionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  moreActionLabelSelected: {
    color: colors.cyan,
  },
  moreGroup: {
    borderTopColor: colors.divider,
    borderTopWidth: borders.thin,
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
  },
  moreGroupLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  featureList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.micro,
  },
  featureChip: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: borders.thin,
    flexDirection: 'row',
    gap: spacing.micro,
    maxWidth: '100%',
    minHeight: controls.minimumTouchTarget,
    paddingHorizontal: spacing.xs,
  },
  featureChipLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  controlDisabled: {
    opacity: 0.4,
  },
});
