const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const ts = require('typescript');

function load(path, dependencies) {
  const compiled = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const context = { exports: {}, require: (name) => dependencies[name] || {} };
  vm.runInNewContext(compiled, context);
  return context.exports;
}
const { themes } = load('src/ui/theme.ts', {
  'react-native': { Platform: { select: (options) => options.web }, StyleSheet: { hairlineWidth: 1 } },
});
const { readAppearancePreference, resolveAppearance } = load('src/ui/ThemeProvider.tsx', {
  react: { createContext: () => ({}) }, './theme': { themes },
});

test('new, missing and invalid saved preferences default to System', () => {
  for (const value of [undefined, null, '', 'auto', 'sepia', '{}', 1, false]) assert.equal(readAppearancePreference(value), 'system');
  for (const value of ['system', 'light', 'dark', 'sage']) assert.equal(readAppearancePreference(value), value);
});

test('System follows changes while manual themes remain fixed', () => {
  for (const device of ['light', 'dark', null, undefined]) {
    assert.equal(resolveAppearance('system', device), device === 'dark' ? 'dark' : 'light');
    assert.equal(resolveAppearance('light', device), 'light');
    assert.equal(resolveAppearance('dark', device), 'dark');
    assert.equal(resolveAppearance('sage', device), 'sage');
  }
  assert.equal(resolveAppearance('system', 'light'), 'light');
  assert.equal(resolveAppearance('system', 'dark'), 'dark');
  assert.equal(resolveAppearance('system', 'light'), 'light');
});

function luminance(hex) {
  const parts = hex.slice(1).match(/../g).map((part) => parseInt(part, 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return parts[0] * 0.2126 + parts[1] * 0.7152 + parts[2] * 0.0722;
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
test('all three palettes cover UI tokens and keep text and navigation readable', () => {
  assert.deepEqual(Object.keys(themes.light.colors).sort(), Object.keys(themes.dark.colors).sort());
  for (const theme of Object.values(themes)) {
    assert.deepEqual(Object.keys(theme.colors).sort(), Object.keys(themes.light.colors).sort());
    assert.ok(contrast(theme.navigation.activeForeground, theme.navigation.activeBackground) >= 4.5, `${theme.name} selected navigation`);
    assert.ok(contrast(theme.navigation.inactiveForeground, theme.navigation.background) >= 4.5, `${theme.name} inactive navigation`);
    assert.ok(contrast(theme.navigation.createForeground, theme.navigation.createBackground) >= 4.5, `${theme.name} create button`);
    for (const surface of ['background', 'surface', 'surfaceRaised', 'surfaceMuted', 'surfaceInteractive']) {
      for (const text of ['textPrimary', 'textSecondary', 'textTertiary']) {
        assert.ok(contrast(theme.colors[text], theme.colors[surface]) >= 4.5, `${theme.mode} ${text} on ${surface}`);
      }
    }
    for (const [name, tone] of Object.entries(theme.semanticTones)) {
      assert.ok(contrast(tone.foreground, tone.solid) >= 4.5, `${theme.mode} ${name} button text`);
      assert.ok(contrast(tone.accent, tone.soft) >= 4.5, `${theme.mode} ${name} accent on soft surface`);
      if (tone.surface) assert.ok(contrast(tone.accent, tone.surface) >= 4.5, `${theme.mode} ${name} accent on card`);
    }
  }
});
