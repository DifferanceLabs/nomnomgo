import { Platform, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

const systemFont = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  web: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  default: 'System',
});

const darkColors = {
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
  cyan: '#3CCFD1',
  cyanPressed: '#2AA9AE',
  cyanSoft: '#102A2E',
  violet: '#A879F5',
  violetPressed: '#8B5DD5',
  violetSoft: '#271B3B',
  green: '#48C979',
  greenPressed: '#34A963',
  greenSoft: '#142C20',
  red: '#F15D67',
  redPressed: '#D84954',
  redSoft: '#35191D',
  scrim: 'rgba(8, 10, 12, 0.82)',
} as const;

export type ThemeColors = { [Key in keyof typeof darkColors]: string };

const lightColors: ThemeColors = {
  background: '#F8F7F4', backgroundRaised: '#FFFFFF', surface: '#FFFFFF',
  surfaceRaised: '#F2F3F3', surfaceMuted: '#EAEDEE', surfaceInteractive: '#E1E6E8', surfacePressed: '#D3DADF',
  overlay: 'rgba(20, 28, 35, 0.45)', scrim: 'rgba(248, 247, 244, 0.92)',
  textPrimary: '#20252B', textSecondary: '#515B65', textTertiary: '#596570', textInverse: '#FFFFFF',
  border: '#D5DADD', borderStrong: '#84929C', divider: '#DFE3E5', focus: '#08776C',
  coral: '#B9342D', coralPressed: '#982B26', coralSoft: '#FCEAE7',
  amber: '#855600', amberPressed: '#6D4600', amberSoft: '#FFF0D5',
  teal: '#08776C', tealPressed: '#065E55', tealSoft: '#DCF3ED',
  cyan: '#006C70', cyanPressed: '#055E60', cyanSoft: '#DEF2F3',
  violet: '#7441B0', violetPressed: '#5B318E', violetSoft: '#F0E8FC',
  green: '#237842', greenPressed: '#1A5E32', greenSoft: '#E2F3E8',
  red: '#B72E3A', redPressed: '#972430', redSoft: '#FCE8EC',
};

function createSemanticTones(colors: ThemeColors, light: boolean) {
  return {
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
      border: light ? '#D88781' : '#7D3733',
      foreground: colors.textInverse,
      accent: light ? colors.coral : '#FF7A72',
    },
    food: {
      solid: colors.coral,
      pressed: colors.coralPressed,
      soft: colors.coralSoft,
      surface: light ? '#FFF5F2' : '#181011',
      border: light ? '#D88781' : '#7D3733',
      foreground: colors.textInverse,
      accent: light ? colors.coral : '#FF7A72',
    },
    activity: {
      solid: colors.amber,
      pressed: colors.amberPressed,
      soft: colors.amberSoft,
      surface: light ? '#FFF8E9' : '#18150F',
      border: light ? '#C69B55' : '#725422',
      foreground: colors.textInverse,
      accent: colors.amber,
    },
    dessert: {
      solid: colors.teal,
      pressed: colors.tealPressed,
      soft: colors.tealSoft,
      surface: light ? '#EEFAF5' : '#0F1918',
      border: light ? '#66A99D' : '#28655E',
      foreground: colors.textInverse,
      accent: light ? colors.teal : '#56D5C4',
    },
    idea: {
      solid: colors.violet,
      pressed: colors.violetPressed,
      soft: colors.violetSoft,
      surface: light ? '#F8F3FF' : '#15111D',
      border: light ? '#AB8DCD' : '#654B8F',
      foreground: colors.textInverse,
      accent: light ? colors.violet : '#BE9BFF',
    },
    maybe: {
      solid: light ? '#876400' : '#F4D35E',
      pressed: light ? '#6B4F00' : '#D6B643',
      soft: light ? '#FFF3CC' : '#302B14',
      border: light ? '#B39745' : '#78692F',
      foreground: colors.textInverse,
      accent: light ? '#876400' : '#F4D35E',
    },
    people: {
      solid: colors.teal,
      pressed: colors.tealPressed,
      soft: colors.tealSoft,
      border: light ? '#66A99D' : '#28655E',
      foreground: colors.textInverse,
      accent: colors.teal,
    },
    route: {
      solid: colors.teal,
      pressed: colors.tealPressed,
      soft: colors.tealSoft,
      border: light ? '#66A99D' : '#28655E',
      foreground: colors.textInverse,
      accent: colors.teal,
    },
    travel: {
      solid: colors.cyan,
      pressed: colors.cyanPressed,
      soft: colors.cyanSoft,
      border: light ? '#6AA9AC' : '#2B666B',
      foreground: colors.textInverse,
      accent: colors.cyan,
    },
    success: {
      solid: colors.green,
      pressed: colors.greenPressed,
      soft: colors.greenSoft,
      border: light ? '#78AC8B' : '#2F6946',
      foreground: colors.textInverse,
      accent: colors.green,
    },
    going: {
      solid: colors.green,
      pressed: colors.greenPressed,
      soft: colors.greenSoft,
      border: light ? '#78AC8B' : '#2F6946',
      foreground: colors.textInverse,
      accent: colors.green,
    },
    danger: {
      solid: colors.red,
      pressed: colors.redPressed,
      soft: colors.redSoft,
      border: light ? '#D38791' : '#7C323A',
      foreground: colors.textInverse,
      accent: colors.red,
    },
  } as const;
}

export type SemanticTone = keyof ReturnType<typeof createSemanticTones>;

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

const baseBorders = {
  hairline: StyleSheet.hairlineWidth,
  thin: 1,
  strong: 2,
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

function createTheme(mode: 'light' | 'dark', colors: ThemeColors) {
  return {
    mode,
    colors,
    semanticTones: createSemanticTones(colors, mode === 'light'),
    spacing,
    radii,
    borders: { ...baseBorders, color: colors.border, strongColor: colors.borderStrong },
    typography,
    elevations,
    controls,
    iconSizes,
    layout,
  } as const;
}

export const themes = { light: createTheme('light', lightColors), dark: createTheme('dark', darkColors) };
export type NomNomGoTheme = ReturnType<typeof createTheme>;
