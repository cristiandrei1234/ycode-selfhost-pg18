import { test } from 'node:test';
import assert from 'node:assert/strict';
import { htmlLangFromLocales } from '@/lib/html-lang';

const locales = [
  { code: 'en', is_default: true },
  { code: 'fr', is_default: false },
  { code: 'pt-BR', is_default: false },
];

test('homepage uses the default locale', () => {
  assert.equal(htmlLangFromLocales('', locales), 'en');
});

test('default-locale page paths use the default locale', () => {
  assert.equal(htmlLangFromLocales('about/team', locales), 'en');
});

test('prefixed paths use the matching locale code', () => {
  assert.equal(htmlLangFromLocales('fr', locales), 'fr');
  assert.equal(htmlLangFromLocales('fr/about', locales), 'fr');
});

test('preserves canonical casing from the locale record', () => {
  assert.equal(htmlLangFromLocales('pt-br/contato', locales), 'pt-BR');
});

test('falls back to en when no locales are configured', () => {
  assert.equal(htmlLangFromLocales('fr/about', []), 'en');
});
