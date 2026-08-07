import { Platform, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

const systemFont = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  web: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  default: 'System',
});

export const colors = {
  background: '#080A0C',
  backgroundRaised: '#0C0F12',
  surface: '#111417',
  surfaceRaised: '#171B1F',
  surfaceMuted: '#1C2126',
  surfaceInteractive: '#22282E',
  surfacePressed: '#2A3138',
  overlay: 'rgba(0, 0, 0, 0.72)',
  textPrimary: '#FFF9F1',
  textSecondary: '#AEB3B8',
  textTertiary: '#8A929A',
  textInverse: '#090B0D',
  border: '#292F35',
  borderStrong: '#3A434B',
  divider: '#20252A',
  focus: '#FFF2DE',
  coral: '#F25A52',
  coralPressed: '#D94943',
  coralSoft: '#351A19',
  amber: '#F2AD3D',
  amberPressed: '#D89329',
  amberSoft: '#302513',
  teal: '#35B8A7',
  tealPressed: '#269586',
  tealSoft: '#112D2A',
  green: '#48C979',
  greenPressed: '#34A963',
  greenSoft: '#142C20',
  red: '#F15D67',
  redPressed: '#D84954',
  redSoft: '#35191D',
  scrim: 'rgba(8, 10, 12, 0.82)',
} as const;

export const semanticTones = {
  neutral: {
    solid: colors.surfaceInteractive,
    pressed: colors.surfacePressed,
    soft: colors.surfaceMuted,
    border: colors.borderStrong,
    foreground: colors.textPrimary,
    accent: colors.textSecondary,
  },
  primary: {
    solid: colors.coral,
    pressed: colors.coralPressed,
    soft: colors.coralSoft,
    border: '#7D3733',
    foreground: colors.textInverse,
    accent: '#FF7A72',
  },
  food: {
    solid: colors.coral,
    pressed: colors.coralPressed,
    soft: colors.coralSoft,
    border: '#7D3733',
    foreground: colors.textInverse,
    accent: '#FF7A72',
  },
  activity: {
    solid: colors.amber,
    pressed: colors.amberPressed,
    soft: colors.amberSoft,
    border: '#725422',
    foreground: colors.textInverse,
    accent: colors.amber,
  },
  maybe: {
    solid: colors.amber,
    pressed: colors.amberPressed,
    soft: colors.amberSoft,
    border: '#725422',
    foreground: colors.textInverse,
    accent: colors.amber,
  },
  people: {
    solid: colors.teal,
    pressed: colors.tealPressed,
    soft: colors.tealSoft,
    border: '#28655E',
    foreground: colors.textInverse,
    accent: colors.teal,
  },
  route: {
    solid: colors.teal,
    pressed: colors.tealPressed,
    soft: colors.tealSoft,
    border: '#28655E',
    foreground: colors.textInverse,
    accent: colors.teal,
  },
  success: {
    solid: colors.green,
    pressed: colors.greenPressed,
    soft: colors.greenSoft,
    border: '#2F6946',
    foreground: colors.textInverse,
    accent: colors.green,
  },
  going: {
    solid: colors.green,
    pressed: colors.greenPressed,
    soft: colors.greenSoft,
    border: '#2F6946',
    foreground: colors.textInverse,
    accent: colors.green,
  },
  danger: {
    solid: colors.red,
    pressed: colors.redPressed,
    soft: colors.redSoft,
    border: '#7C323A',
    foreground: colors.textInverse,
    accent: colors.red,
  },
} as const;

export type SemanticTone = keyof typeof semanticTones;

export const spacing = {
  none: 0,
  hairline: 2,
  micro: 4,
  xs: 8,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 40,
  xxl: 48,
  xxxl: 56,
  huge: 64,
} as const;

export const radii = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  pill: 999,
} as const;

export const borders = {
  hairline: StyleSheet.hairlineWidth,
  thin: 1,
  strong: 2,
  color: colors.border,
  strongColor: colors.borderStrong,
} as const;

export const typography = {
  display: {
    fontFamily: systemFont,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  title: {
    fontFamily: systemFont,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heading: {
    fontFamily: systemFont,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    letterSpacing: -0.25,
  },
  subheading: {
    fontFamily: systemFont,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
  },
  body: {
    fontFamily: systemFont,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  bodyStrong: {
    fontFamily: systemFont,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  label: {
    fontFamily: systemFont,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  caption: {
    fontFamily: systemFont,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  eyebrow: {
    fontFamily: systemFont,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  button: {
    fontFamily: systemFont,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  buttonCompact: {
    fontFamily: systemFont,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
} as const satisfies Record<string, TextStyle>;

export const elevations = {
  none: {
    shadowColor: '#000000',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  low: {
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  medium: {
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 7,
  },
  high: {
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },
} as const satisfies Record<string, ViewStyle>;

export const controls = {
  minimumTouchTarget: 44,
  compactHeight: 44,
  buttonHeight: 52,
  inputHeight: 52,
  chipHeight: 44,
  iconButtonSize: 44,
  createButtonSize: 60,
} as const;

export const iconSizes = {
  xs: 14,
  sm: 18,
  md: 22,
  lg: 26,
  xl: 32,
  xxl: 40,
} as const;

export const layout = {
  contentMaxWidth: 760,
  screenPaddingHorizontal: spacing.md,
  screenPaddingVertical: spacing.sm,
  headerMinHeight: 64,
  bottomNavigationHeight: 72,
  bottomNavigationGap: spacing.xs,
  bottomNavigationContentInset: 104,
  safeAreaFallbackTop: spacing.sm,
  safeAreaFallbackBottom: spacing.xs,
} as const;

export const theme = {
  colors,
  semanticTones,
  spacing,
  radii,
  borders,
  typography,
  elevations,
  controls,
  iconSizes,
  layout,
} as const;

export type NomNomGoTheme = typeof theme;
