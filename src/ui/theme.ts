import { Platform, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

const systemFont = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  web: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  default: 'System',
});

const darkColors = {
  background: '#11151D',
  backgroundRaised: '#191F2A',
  surface: '#191F2A',
  surfaceRaised: '#202835',
  surfaceMuted: '#283140',
  surfaceInteractive: '#303A4B',
  surfacePressed: '#3A465A',
  overlay: 'rgba(7, 11, 18, 0.64)',
  textPrimary: '#F3F5F8',
  textSecondary: '#BDC6D4',
  textTertiary: '#AAB7C9',
  textInverse: '#11151D',
  border: '#303A48',
  borderStrong: '#526176',
  divider: '#29323F',
  focus: '#96D8CD',
  coral: '#FF9287',
  coralPressed: '#ED7D73',
  coralSoft: '#3E292B',
  amber: '#EAC181',
  amberPressed: '#D7AB69',
  amberSoft: '#393024',
  teal: '#87D3BF',
  tealPressed: '#6CBBA7',
  tealSoft: '#233B38',
  cyan: '#87CFDC',
  cyanPressed: '#6EB9C7',
  cyanSoft: '#233840',
  violet: '#C2ACEE',
  violetPressed: '#AC91DD',
  violetSoft: '#342E47',
  green: '#97D5AB',
  greenPressed: '#79BF90',
  greenSoft: '#263C30',
  red: '#FFA0AC',
  redPressed: '#EC8795',
  redSoft: '#412C35',
  scrim: 'rgba(7, 11, 18, 0.72)',
} as const;

export type ThemeColors = { [Key in keyof typeof darkColors]: string };

const lightColors: ThemeColors = {
  background: '#F5F6F8', backgroundRaised: '#FFFFFF', surface: '#FFFFFF',
  surfaceRaised: '#F0F3F6', surfaceMuted: '#EBEEF3', surfaceInteractive: '#E3E8EF', surfacePressed: '#D6DDE7',
  overlay: 'rgba(27, 35, 48, 0.32)', scrim: 'rgba(27, 35, 48, 0.32)',
  textPrimary: '#202633', textSecondary: '#4D596B', textTertiary: '#566376', textInverse: '#FFFFFF',
  border: '#DDE3EB', borderStrong: '#8B98AA', divider: '#E6EAF0', focus: '#176E63',
  coral: '#C63D33', coralPressed: '#AC3028', coralSoft: '#FFF2EF',
  amber: '#815C14', amberPressed: '#69490B', amberSoft: '#FBF0DB',
  teal: '#176E63', tealPressed: '#105A50', tealSoft: '#E1F2ED',
  cyan: '#146878', cyanPressed: '#0D5361', cyanSoft: '#E1F1F5',
  violet: '#714DA5', violetPressed: '#5C3C8A', violetSoft: '#F0EAF8',
  green: '#2F7449', greenPressed: '#225D37', greenSoft: '#E3F2E8',
  red: '#B8364A', redPressed: '#98293B', redSoft: '#FBE9EF',
};

const sageColors: ThemeColors = {
  background: '#EDF1E9', backgroundRaised: '#F8FAF4', surface: '#FAFCF7',
  surfaceRaised: '#E8EEE3', surfaceMuted: '#E0E8D9', surfaceInteractive: '#D6E1CF', surfacePressed: '#C9D7C2',
  overlay: 'rgba(26, 43, 30, 0.34)', scrim: 'rgba(26, 43, 30, 0.34)',
  textPrimary: '#25382C', textSecondary: '#425747', textTertiary: '#485E4C', textInverse: '#FFFFFF',
  border: '#D0DAC9', borderStrong: '#7D927C', divider: '#D9E2D2', focus: '#315F44',
  coral: '#A94332', coralPressed: '#8D3527', coralSoft: '#F7E7DD',
  amber: '#755713', amberPressed: '#5F450B', amberSoft: '#F4ECCE',
  teal: '#315F44', tealPressed: '#254D35', tealSoft: '#DAE9D5',
  cyan: '#26656B', cyanPressed: '#1B5055', cyanSoft: '#DFEDE7',
  violet: '#6E4D8B', violetPressed: '#573A70', violetSoft: '#EDE5F0',
  green: '#315F44', greenPressed: '#254D35', greenSoft: '#DAE9D5',
  red: '#A83743', redPressed: '#8B2934', redSoft: '#F6E4E5',
};

export type ThemeName = 'light' | 'dark' | 'sage';

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
      surface: colors.surface,
      border: light ? '#D88781' : '#7D3733',
      foreground: colors.textInverse,
      accent: light ? colors.coral : '#FF7A72',
    },
    activity: {
      solid: colors.amber,
      pressed: colors.amberPressed,
      soft: colors.amberSoft,
      surface: colors.surface,
      border: light ? '#C69B55' : '#725422',
      foreground: colors.textInverse,
      accent: colors.amber,
    },
    dessert: {
      solid: colors.teal,
      pressed: colors.tealPressed,
      soft: colors.tealSoft,
      surface: colors.surface,
      border: light ? '#66A99D' : '#28655E',
      foreground: colors.textInverse,
      accent: light ? colors.teal : '#56D5C4',
    },
    idea: {
      solid: colors.violet,
      pressed: colors.violetPressed,
      soft: colors.violetSoft,
      surface: colors.surface,
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

function createTheme(name: ThemeName, colors: ThemeColors) {
  const mode = name === 'dark' ? 'dark' : 'light';
  const baseTones = createSemanticTones(colors, mode === 'light');
  const semanticTones = { ...baseTones, primary: name === 'sage' ? baseTones.people : baseTones.primary };
  return {
    name,
    mode,
    colors,
    semanticTones,
    navigation: {
      background: colors.backgroundRaised,
      border: colors.divider,
      activeBackground: semanticTones.primary.soft,
      activeForeground: semanticTones.primary.accent,
      inactiveForeground: colors.textSecondary,
      createBackground: semanticTones.primary.solid,
      createForeground: semanticTones.primary.foreground,
    },
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

export const themes = { light: createTheme('light', lightColors), dark: createTheme('dark', darkColors), sage: createTheme('sage', sageColors) };
export type NomNomGoTheme = ReturnType<typeof createTheme>;
