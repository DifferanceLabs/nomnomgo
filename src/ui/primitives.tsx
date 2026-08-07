import type { ComponentProps, PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ScrollViewProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  borders,
  colors,
  controls,
  elevations,
  layout,
  radii,
  semanticTones,
  spacing,
  typography,
  type SemanticTone,
} from './theme';

export type PressHandler = () => void | Promise<void>;

function runPress(handler?: PressHandler) {
  if (handler) void handler();
}

export type ScreenContainerProps = PropsWithChildren<{
  scrollable?: boolean;
  withBottomNavigation?: boolean;
  safeAreaEdges?: ComponentProps<typeof SafeAreaView>['edges'];
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scrollViewProps?: Omit<ScrollViewProps, 'children' | 'contentContainerStyle'>;
  testID?: string;
}>;

export function ScreenContainer({
  children,
  scrollable = true,
  withBottomNavigation = false,
  safeAreaEdges = ['top', 'right', 'bottom', 'left'],
  style,
  contentContainerStyle,
  scrollViewProps,
  testID,
}: ScreenContainerProps) {
  const contentStyle = [
    styles.screenContent,
    withBottomNavigation && styles.screenContentWithNavigation,
    contentContainerStyle,
  ];

  return (
    <SafeAreaView edges={safeAreaEdges} style={[styles.screen, style]} testID={testID}>
      {scrollable ? (
        <ScrollView
          {...scrollViewProps}
          style={[styles.screenScroll, scrollViewProps?.style]}
          contentContainerStyle={styles.screenScrollContent}
          keyboardShouldPersistTaps={scrollViewProps?.keyboardShouldPersistTaps ?? 'handled'}
        >
          <View style={contentStyle}>{children}</View>
        </ScrollView>
      ) : (
        <View style={[styles.screenStaticContent, ...contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export type SurfaceVariant = 'base' | 'raised' | 'muted' | 'interactive';
export type SurfacePadding = 'none' | 'small' | 'medium' | 'large';

export type SurfaceProps = PropsWithChildren<{
  variant?: SurfaceVariant;
  padding?: SurfacePadding;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}>;

const surfaceVariantStyles: Record<SurfaceVariant, ViewStyle> = {
  base: { backgroundColor: colors.surface },
  raised: { backgroundColor: colors.surfaceRaised },
  muted: { backgroundColor: colors.surfaceMuted },
  interactive: { backgroundColor: colors.surfaceInteractive },
};

const surfacePaddingStyles: Record<SurfacePadding, ViewStyle> = {
  none: { padding: 0 },
  small: { padding: spacing.xs },
  medium: { padding: spacing.sm },
  large: { padding: spacing.md },
};

export function Surface({
  children,
  variant = 'base',
  padding = 'medium',
  style,
  accessibilityLabel,
  testID,
}: SurfaceProps) {
  return (
    <View
      style={[styles.surface, surfaceVariantStyles[variant], surfacePaddingStyles[padding], style]}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {children}
    </View>
  );
}

export type AppHeaderProps = {
  logo: ReactNode;
  content?: ReactNode;
  title?: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onBrandPress?: PressHandler;
  brandAccessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function AppHeader({
  logo,
  content,
  title,
  subtitle,
  leading,
  trailing,
  onBrandPress,
  brandAccessibilityLabel = 'Go to home',
  style,
  testID,
}: AppHeaderProps) {
  const brandContent = (
    <>
      <View style={styles.headerLogo}>{logo}</View>
      <View style={styles.headerTextBlock}>
        {content ?? (
          <>
            {title ? <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text> : null}
            {subtitle ? <Text style={styles.headerSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
          </>
        )}
      </View>
    </>
  );

  return (
    <View style={[styles.header, style]} testID={testID}>
      {leading ? <View style={styles.headerEdge}>{leading}</View> : null}
      {onBrandPress ? (
        <TouchableOpacity
          style={styles.headerBrandButton}
          onPress={() => runPress(onBrandPress)}
          activeOpacity={0.78}
          accessibilityRole="button"
          accessibilityLabel={brandAccessibilityLabel}
        >
          {brandContent}
        </TouchableOpacity>
      ) : (
        <View style={styles.headerBrand}>{brandContent}</View>
      )}
      {trailing ? <View style={[styles.headerEdge, styles.headerTrailing]}>{trailing}</View> : null}
    </View>
  );
}

export type ActionButtonTone =
  | 'primary'
  | 'secondary'
  | 'food'
  | 'activity'
  | 'people'
  | 'success'
  | 'danger'
  | 'ghost';

export type ActionButtonProps = {
  label: string;
  onPress: PressHandler;
  tone?: ActionButtonTone;
  size?: 'compact' | 'regular';
  leading?: ReactNode;
  trailing?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

const actionToneMap: Record<ActionButtonTone, SemanticTone> = {
  primary: 'primary',
  secondary: 'neutral',
  food: 'food',
  activity: 'activity',
  people: 'people',
  success: 'success',
  danger: 'danger',
  ghost: 'neutral',
};

export function ActionButton({
  label,
  onPress,
  tone = 'secondary',
  size = 'regular',
  leading,
  trailing,
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  textStyle,
  accessibilityLabel,
  testID,
}: ActionButtonProps) {
  const palette = semanticTones[actionToneMap[tone]];
  const ghost = tone === 'ghost';
  const unavailable = disabled || loading;
  const foreground = ghost ? palette.accent : palette.foreground;

  return (
    <TouchableOpacity
      style={[
        styles.actionButton,
        size === 'compact' ? styles.actionButtonCompact : styles.actionButtonRegular,
        {
          backgroundColor: ghost ? 'transparent' : palette.solid,
          borderColor: ghost ? palette.border : palette.solid,
        },
        fullWidth && styles.fullWidth,
        unavailable && styles.disabled,
        style,
      ]}
      onPress={() => runPress(onPress)}
      activeOpacity={0.8}
      disabled={unavailable}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: unavailable, busy: loading }}
      testID={testID}
    >
      {loading ? <ActivityIndicator color={foreground} size="small" /> : leading}
      <Text
        style={[
          size === 'compact' ? typography.buttonCompact : typography.button,
          { color: foreground },
          textStyle,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {!loading ? trailing : null}
    </TouchableOpacity>
  );
}

export type ChipProps = {
  label: string;
  selected?: boolean;
  tone?: SemanticTone;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: PressHandler;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

export function Chip({
  label,
  selected = false,
  tone = 'neutral',
  leading,
  trailing,
  onPress,
  disabled = false,
  style,
  textStyle,
  accessibilityLabel,
  testID,
}: ChipProps) {
  const palette = semanticTones[tone];
  const chipContent = (
    <>
      {leading}
      <Text
        style={[
          typography.label,
          styles.chipText,
          { color: selected ? palette.accent : colors.textSecondary },
          textStyle,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {trailing}
    </>
  );
  const chipStyle: StyleProp<ViewStyle> = [
    styles.chip,
    {
      backgroundColor: selected ? palette.soft : colors.surfaceRaised,
      borderColor: selected ? palette.border : colors.border,
    },
    disabled && styles.disabled,
    style,
  ];

  if (!onPress) return <View style={chipStyle}>{chipContent}</View>;

  return (
    <TouchableOpacity
      style={chipStyle}
      onPress={() => runPress(onPress)}
      activeOpacity={0.78}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled }}
      testID={testID}
    >
      {chipContent}
    </TouchableOpacity>
  );
}

export type SegmentedControlOption<T extends string> = {
  value: T;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  accessibilityLabel?: string;
};

export type SegmentedControlProps<T extends string> = {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void | Promise<void>;
  tone?: SemanticTone;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  tone = 'primary',
  accessibilityLabel,
  style,
  testID,
}: SegmentedControlProps<T>) {
  const palette = semanticTones[tone];

  return (
    <View style={[styles.segmentedControl, style]} accessibilityLabel={accessibilityLabel} testID={testID}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.segmentedOption,
              selected && { backgroundColor: palette.soft, borderColor: palette.border },
              option.disabled && styles.disabled,
            ]}
            onPress={() => { void onChange(option.value); }}
            activeOpacity={0.78}
            disabled={option.disabled}
            accessibilityRole="tab"
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityState={{ selected, disabled: option.disabled }}
          >
            {option.icon}
            <Text
              style={[
                typography.label,
                styles.segmentedOptionText,
                selected && { color: palette.accent },
              ]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export type FieldShellProps = PropsWithChildren<{
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}>;

export function FieldShell({
  label,
  hint,
  error,
  optional = false,
  trailing,
  children,
  style,
  testID,
}: FieldShellProps) {
  return (
    <View style={[styles.field, style]} testID={testID}>
      <View style={styles.fieldHeader}>
        <Text style={styles.fieldLabel}>
          {label}{optional ? <Text style={styles.fieldOptional}> · Optional</Text> : null}
        </Text>
        {trailing}
      </View>
      {children}
      {error ? (
        <Text style={styles.fieldError} accessibilityLiveRegion="polite">{error}</Text>
      ) : hint ? (
        <Text style={styles.fieldHint}>{hint}</Text>
      ) : null}
    </View>
  );
}

export type MetadataRowProps = {
  label?: string;
  value: string;
  icon?: ReactNode;
  trailing?: ReactNode;
  tone?: SemanticTone;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function MetadataRow({
  label,
  value,
  icon,
  trailing,
  tone = 'neutral',
  style,
  testID,
}: MetadataRowProps) {
  return (
    <View style={[styles.metadataRow, style]} testID={testID}>
      {icon ? <View style={styles.metadataIcon}>{icon}</View> : null}
      <View style={styles.metadataTextBlock}>
        {label ? <Text style={styles.metadataLabel}>{label}</Text> : null}
        <Text style={[styles.metadataValue, { color: semanticTones[tone].accent }]} numberOfLines={2}>{value}</Text>
      </View>
      {trailing}
    </View>
  );
}

export type StatProps = {
  label: string;
  value: string | number;
  tone?: SemanticTone;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Stat({ label, value, tone = 'neutral', style, testID }: StatProps) {
  const palette = semanticTones[tone];
  return (
    <View style={[styles.stat, { backgroundColor: palette.soft, borderColor: palette.border }, style]} testID={testID}>
      <Text style={[styles.statValue, { color: palette.accent }]} numberOfLines={1}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export type PersonRowProps = {
  name: string;
  subtitle?: string;
  avatar?: ReactNode;
  selected?: boolean;
  onPress?: PressHandler;
  trailing?: ReactNode;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function PersonRow({
  name,
  subtitle,
  avatar,
  selected = false,
  onPress,
  trailing,
  disabled = false,
  accessibilityLabel,
  style,
  testID,
}: PersonRowProps) {
  const content = (
    <>
      <View style={[styles.personAvatar, selected && styles.personAvatarSelected]}>
        {avatar ?? (
          <Text style={[styles.personAvatarText, selected && styles.personAvatarTextSelected]}>
            {name.trim().slice(0, 1).toUpperCase()}
          </Text>
        )}
      </View>
      <View style={styles.personTextBlock}>
        <Text style={styles.personName} numberOfLines={1}>{name}</Text>
        {subtitle ? <Text style={styles.personSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {trailing ?? (
        <View style={[styles.personSelection, selected && styles.personSelectionSelected]}>
          {selected ? <Text style={styles.personSelectionText}>✓</Text> : null}
        </View>
      )}
    </>
  );
  const rowStyle: StyleProp<ViewStyle> = [
    styles.personRow,
    selected && styles.personRowSelected,
    disabled && styles.disabled,
    style,
  ];

  if (!onPress) return <View style={rowStyle} testID={testID}>{content}</View>;

  return (
    <TouchableOpacity
      style={rowStyle}
      onPress={() => runPress(onPress)}
      activeOpacity={0.78}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${selected ? 'Remove' : 'Add'} ${name}`}
      accessibilityState={{ selected, disabled }}
      testID={testID}
    >
      {content}
    </TouchableOpacity>
  );
}

export type RsvpStatus = 'going' | 'maybe' | 'cant_make_it';

export type RsvpControlProps = {
  value?: RsvpStatus;
  onChange: (status: RsvpStatus) => void | Promise<void>;
  labels?: Partial<Record<RsvpStatus, string>>;
  icons?: Partial<Record<RsvpStatus, ReactNode>>;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

const rsvpOptions: { status: RsvpStatus; label: string; tone: SemanticTone }[] = [
  { status: 'going', label: 'Going', tone: 'going' },
  { status: 'maybe', label: 'Maybe', tone: 'maybe' },
  { status: 'cant_make_it', label: "Can't make it", tone: 'danger' },
];

export function RsvpControl({
  value,
  onChange,
  labels,
  icons,
  disabled = false,
  style,
  accessibilityLabel = 'RSVP',
  testID,
}: RsvpControlProps) {
  return (
    <View style={[styles.rsvpControl, style]} accessibilityLabel={accessibilityLabel} testID={testID}>
      {rsvpOptions.map((option) => {
        const selected = value === option.status;
        const palette = semanticTones[option.tone];
        const label = labels?.[option.status] ?? option.label;
        return (
          <TouchableOpacity
            key={option.status}
            style={[
              styles.rsvpButton,
              {
                backgroundColor: selected ? palette.solid : palette.soft,
                borderColor: palette.border,
              },
              disabled && styles.disabled,
            ]}
            onPress={() => { void onChange(option.status); }}
            activeOpacity={0.8}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={`RSVP ${label}`}
            accessibilityState={{ selected, disabled }}
          >
            {icons?.[option.status]}
            <Text
              style={[
                typography.buttonCompact,
                styles.rsvpButtonText,
                { color: selected ? palette.foreground : palette.accent },
              ]}
              numberOfLines={2}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  status?: 'empty' | 'loading' | 'error';
  tone?: SemanticTone;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function EmptyState({
  title,
  description,
  icon,
  action,
  status = 'empty',
  tone,
  style,
  testID,
}: EmptyStateProps) {
  const resolvedTone = tone ?? (status === 'error' ? 'danger' : 'neutral');
  const palette = semanticTones[resolvedTone];
  return (
    <View
      style={[styles.emptyState, { backgroundColor: palette.soft, borderColor: palette.border }, style]}
      accessibilityLiveRegion={status === 'loading' || status === 'error' ? 'polite' : 'none'}
      testID={testID}
    >
      {status === 'loading' ? <ActivityIndicator color={palette.accent} size="small" /> : icon}
      <Text style={styles.emptyStateTitle}>{title}</Text>
      {description ? <Text style={styles.emptyStateDescription}>{description}</Text> : null}
      {action ? <View style={styles.emptyStateAction}>{action}</View> : null}
    </View>
  );
}

export type TimelineStopCardProps = {
  title: string;
  index?: number;
  markerLabel?: string;
  category?: string;
  subtitle?: string;
  time?: string;
  duration?: string;
  travel?: string;
  tone?: SemanticTone;
  media?: ReactNode;
  metadata?: ReactNode;
  actions?: ReactNode;
  onPress?: PressHandler;
  selected?: boolean;
  isLast?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function TimelineStopCard({
  title,
  index,
  markerLabel,
  category,
  subtitle,
  time,
  duration,
  travel,
  tone = 'route',
  media,
  metadata,
  actions,
  onPress,
  selected = false,
  isLast = false,
  accessibilityLabel,
  style,
  testID,
}: TimelineStopCardProps) {
  const palette = semanticTones[tone];
  const stopContent = (
    <>
      <View style={styles.timelineCardTop}>
        <View style={styles.timelineCardTextBlock}>
          {category ? <Text style={[styles.timelineCategory, { color: palette.accent }]}>{category}</Text> : null}
          <Text style={styles.timelineTitle} numberOfLines={2}>{title}</Text>
          {subtitle ? <Text style={styles.timelineSubtitle} numberOfLines={2}>{subtitle}</Text> : null}
        </View>
        {media ? <View style={styles.timelineMedia}>{media}</View> : null}
      </View>
      {time || duration || travel ? (
        <View style={styles.timelineMetadata}>
          {time ? <Chip label={time} selected tone={tone} /> : null}
          {duration ? <Chip label={duration} /> : null}
          {travel ? <Chip label={travel} tone="route" /> : null}
        </View>
      ) : null}
      {metadata}
      {actions ? <View style={styles.timelineActions}>{actions}</View> : null}
    </>
  );
  const cardStyle: StyleProp<ViewStyle> = [
    styles.timelineCard,
    selected && { borderColor: palette.accent, backgroundColor: palette.soft },
    style,
  ];

  return (
    <View style={styles.timelineStop} testID={testID}>
      <View style={styles.timelineRail}>
        <View style={[styles.timelineMarker, { backgroundColor: palette.solid, borderColor: palette.border }]}>
          <Text style={[styles.timelineMarkerText, { color: palette.foreground }]}>
            {markerLabel ?? (typeof index === 'number' ? index + 1 : '•')}
          </Text>
        </View>
        {!isLast ? <View style={[styles.timelineLine, { backgroundColor: palette.border }]} /> : null}
      </View>
      {onPress ? (
        <TouchableOpacity
          style={cardStyle}
          onPress={() => runPress(onPress)}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? [category, title, time].filter(Boolean).join(', ')}
          accessibilityState={{ selected }}
        >
          {stopContent}
        </TouchableOpacity>
      ) : (
        <View style={cardStyle}>{stopContent}</View>
      )}
    </View>
  );
}

export type BottomNavigationItem<T extends string> = {
  key: T;
  label: string;
  icon: ReactNode;
  selectedIcon?: ReactNode;
  disabled?: boolean;
  accessibilityLabel?: string;
};

export type BottomNavigationCreateAction = {
  label: string;
  icon: ReactNode;
  onPress: PressHandler;
  disabled?: boolean;
  accessibilityLabel?: string;
};

export type BottomNavigationProps<T extends string> = {
  items: BottomNavigationItem<T>[];
  activeKey?: T;
  onSelect: (key: T) => void | Promise<void>;
  createAction: BottomNavigationCreateAction;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

function BottomNavigationTab<T extends string>({
  item,
  active,
  onSelect,
}: {
  item: BottomNavigationItem<T>;
  active: boolean;
  onSelect: (key: T) => void | Promise<void>;
}) {
  return (
    <TouchableOpacity
      style={[styles.navigationTab, active && styles.navigationTabActive, item.disabled && styles.disabled]}
      onPress={() => { void onSelect(item.key); }}
      activeOpacity={0.76}
      disabled={item.disabled}
      accessibilityRole="tab"
      accessibilityLabel={item.accessibilityLabel ?? item.label}
      accessibilityState={{ selected: active, disabled: item.disabled }}
    >
      <View style={styles.navigationIcon}>{active && item.selectedIcon ? item.selectedIcon : item.icon}</View>
      <Text style={[styles.navigationLabel, active && styles.navigationLabelActive]} numberOfLines={1}>{item.label}</Text>
    </TouchableOpacity>
  );
}

export function BottomNavigation<T extends string>({
  items,
  activeKey,
  onSelect,
  createAction,
  style,
  accessibilityLabel = 'Primary navigation',
  testID,
}: BottomNavigationProps<T>) {
  const insets = useSafeAreaInsets();
  const splitIndex = Math.ceil(items.length / 2);
  const leftItems = items.slice(0, splitIndex);
  const rightItems = items.slice(splitIndex);

  return (
    <View
      style={[
        styles.bottomNavigation,
        { paddingBottom: Math.max(insets.bottom, layout.safeAreaFallbackBottom) },
        style,
      ]}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <View style={styles.navigationSide}>
        {leftItems.map((item) => (
          <BottomNavigationTab key={item.key} item={item} active={item.key === activeKey} onSelect={onSelect} />
        ))}
      </View>
      <View style={styles.navigationCreateSlot}>
        <TouchableOpacity
          style={[styles.navigationCreateButton, createAction.disabled && styles.disabled]}
          onPress={() => runPress(createAction.onPress)}
          activeOpacity={0.82}
          disabled={createAction.disabled}
          accessibilityRole="button"
          accessibilityLabel={createAction.accessibilityLabel ?? createAction.label}
          accessibilityState={{ disabled: createAction.disabled }}
        >
          {createAction.icon}
        </TouchableOpacity>
        <Text style={styles.navigationCreateLabel} numberOfLines={1}>{createAction.label}</Text>
      </View>
      <View style={styles.navigationSide}>
        {rightItems.map((item) => (
          <BottomNavigationTab key={item.key} item={item} active={item.key === activeKey} onSelect={onSelect} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenScroll: {
    flex: 1,
  },
  screenScrollContent: {
    flexGrow: 1,
  },
  screenContent: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingVertical: layout.screenPaddingVertical,
  },
  screenStaticContent: {
    flex: 1,
  },
  screenContentWithNavigation: {
    paddingBottom: layout.bottomNavigationContentInset,
  },
  surface: {
    borderWidth: borders.thin,
    borderColor: colors.border,
    borderRadius: radii.lg,
    ...elevations.low,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.48,
  },
  header: {
    minHeight: layout.headerMinHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  headerBrand: {
    flex: 1,
    minWidth: 0,
    minHeight: controls.minimumTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerBrandButton: {
    flex: 1,
    minWidth: 0,
    minHeight: controls.minimumTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerLogo: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    ...typography.subheading,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.hairline,
  },
  headerEdge: {
    minWidth: controls.minimumTouchTarget,
    minHeight: controls.minimumTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTrailing: {
    alignItems: 'flex-end',
  },
  actionButton: {
    borderWidth: borders.thin,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  actionButtonCompact: {
    minHeight: controls.compactHeight,
    paddingVertical: spacing.xs,
  },
  actionButtonRegular: {
    minHeight: controls.buttonHeight,
    paddingVertical: spacing.sm,
  },
  chip: {
    minHeight: controls.chipHeight,
    alignSelf: 'flex-start',
    borderWidth: borders.thin,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.micro,
  },
  chipText: {
    flexShrink: 1,
  },
  segmentedControl: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.micro,
    padding: spacing.micro,
    borderWidth: borders.thin,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  segmentedOption: {
    flexGrow: 1,
    flexBasis: 88,
    minWidth: 0,
    minHeight: controls.minimumTouchTarget,
    borderWidth: borders.thin,
    borderColor: 'transparent',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.micro,
  },
  segmentedOptionText: {
    color: colors.textSecondary,
    flexShrink: 1,
  },
  field: {
    width: '100%',
    gap: spacing.xs,
  },
  fieldHeader: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  fieldLabel: {
    ...typography.label,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  fieldOptional: {
    color: colors.textTertiary,
    fontWeight: '600',
  },
  fieldHint: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  fieldError: {
    ...typography.caption,
    color: colors.red,
  },
  metadataRow: {
    minHeight: controls.minimumTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metadataIcon: {
    width: controls.iconButtonSize,
    height: controls.iconButtonSize,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metadataTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  metadataLabel: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  metadataValue: {
    ...typography.bodyStrong,
  },
  stat: {
    minWidth: 88,
    minHeight: 68,
    borderWidth: borders.thin,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    justifyContent: 'center',
    gap: spacing.hairline,
  },
  statValue: {
    ...typography.subheading,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  personRow: {
    width: '100%',
    minHeight: 64,
    borderWidth: borders.thin,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  personRowSelected: {
    borderColor: semanticTones.people.border,
    backgroundColor: semanticTones.people.soft,
  },
  personAvatar: {
    width: controls.minimumTouchTarget,
    height: controls.minimumTouchTarget,
    borderRadius: radii.pill,
    borderWidth: borders.thin,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceInteractive,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  personAvatarSelected: {
    borderColor: semanticTones.people.accent,
    backgroundColor: semanticTones.people.solid,
  },
  personAvatarText: {
    ...typography.label,
    color: colors.textPrimary,
  },
  personAvatarTextSelected: {
    color: semanticTones.people.foreground,
  },
  personTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  personName: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  personSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.hairline,
  },
  personSelection: {
    width: controls.minimumTouchTarget,
    height: controls.minimumTouchTarget,
    borderRadius: radii.pill,
    borderWidth: borders.thin,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personSelectionSelected: {
    backgroundColor: semanticTones.people.solid,
    borderColor: semanticTones.people.solid,
  },
  personSelectionText: {
    ...typography.label,
    color: semanticTones.people.foreground,
  },
  rsvpControl: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  rsvpButton: {
    flexGrow: 1,
    flexBasis: 104,
    minWidth: 0,
    minHeight: controls.buttonHeight,
    borderWidth: borders.thin,
    borderRadius: radii.md,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.micro,
  },
  rsvpButtonText: {
    flexShrink: 1,
    textAlign: 'center',
  },
  emptyState: {
    width: '100%',
    minHeight: 180,
    borderWidth: borders.thin,
    borderRadius: radii.lg,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateTitle: {
    ...typography.subheading,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  emptyStateDescription: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    maxWidth: 440,
  },
  emptyStateAction: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  timelineStop: {
    width: '100%',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  timelineRail: {
    width: 34,
    alignItems: 'center',
  },
  timelineMarker: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    borderWidth: borders.thin,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  timelineMarkerText: {
    ...typography.caption,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: spacing.lg,
  },
  timelineCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 112,
    marginBottom: spacing.sm,
    borderWidth: borders.thin,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.md,
    gap: spacing.sm,
  },
  timelineCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  timelineCardTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  timelineCategory: {
    ...typography.eyebrow,
    marginBottom: spacing.micro,
  },
  timelineTitle: {
    ...typography.subheading,
    color: colors.textPrimary,
  },
  timelineSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.micro,
  },
  timelineMedia: {
    width: 80,
    height: 72,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
  },
  timelineMetadata: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.micro,
  },
  timelineActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingTop: spacing.micro,
    borderTopWidth: borders.hairline,
    borderTopColor: colors.divider,
  },
  bottomNavigation: {
    minHeight: layout.bottomNavigationHeight,
    borderTopWidth: borders.thin,
    borderTopColor: colors.border,
    backgroundColor: colors.backgroundRaised,
    paddingTop: layout.bottomNavigationGap,
    paddingHorizontal: spacing.xs,
    flexDirection: 'row',
    alignItems: 'flex-end',
    ...elevations.high,
  },
  navigationSide: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  navigationTab: {
    flex: 1,
    minWidth: controls.minimumTouchTarget,
    minHeight: controls.minimumTouchTarget,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.hairline,
    paddingHorizontal: spacing.micro,
    paddingVertical: spacing.micro,
  },
  navigationTabActive: {
    backgroundColor: colors.surfaceMuted,
  },
  navigationIcon: {
    minHeight: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navigationLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    maxWidth: '100%',
  },
  navigationLabelActive: {
    color: colors.textPrimary,
  },
  navigationCreateSlot: {
    width: 76,
    minHeight: controls.minimumTouchTarget,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  navigationCreateButton: {
    width: controls.createButtonSize,
    height: controls.createButtonSize,
    marginTop: -24,
    borderRadius: radii.pill,
    borderWidth: borders.strong,
    borderColor: colors.backgroundRaised,
    backgroundColor: semanticTones.primary.solid,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevations.medium,
  },
  navigationCreateLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.hairline,
    maxWidth: 72,
  },
});
