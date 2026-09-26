import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  INLINE_SVG_MAX_BYTES,
  generateImageSrcset,
  getInlineSvgAssetUrl,
  getInlineSvgAssetVersion,
  getOptimizedImageUrl,
  resolveInlineSvgAssetSrc,
  withSvgIntrinsicSize,
} from './asset-utils';

const ASSET_ID = '6dd2b750-3757-4c8c-ad6c-c6adca2d0af6';
const smallSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>';
const largeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 649 450">${'<path d="M0 0h1v1H0z"/>'.repeat(400)}</svg>`;

test('small inline SVGs stay embedded as data URIs', () => {
  assert.ok(smallSvg.length <= INLINE_SVG_MAX_BYTES);
  const src = resolveInlineSvgAssetSrc({ id: ASSET_ID, filename: 'icon.svg', content: smallSvg, content_hash: 'abcdef1234567890' });
  assert.ok(src?.startsWith('data:image/svg+xml,'));
});

test('large inline SVGs resolve to a versioned /a/ proxy URL', () => {
  assert.ok(largeSvg.length > INLINE_SVG_MAX_BYTES);
  const asset = { id: ASSET_ID, filename: 'ai_licia background.svg', content: largeSvg, width: 649, height: 450 };
  const src = resolveInlineSvgAssetSrc(asset);
  assert.equal(src, getInlineSvgAssetUrl(asset));
  assert.match(src ?? '', /^\/a\/[A-Za-z0-9]{22}\/ai-licia-background\.svg\?v=[0-9a-f]{8}$/);
});

test('large inline SVGs fall back to a data URI when the asset cannot be addressed', () => {
  const src = resolveInlineSvgAssetSrc({ content: largeSvg });
  assert.ok(src?.startsWith('data:image/svg+xml,'));
  assert.equal(resolveInlineSvgAssetSrc({ id: ASSET_ID, filename: 'x.svg', content: null }), null);
});

test('proxy URL is versioned from the markup even without a stored content hash', () => {
  const url = getInlineSvgAssetUrl({ id: ASSET_ID, filename: 'logo.svg', content: largeSvg });
  assert.match(url, /^\/a\/[A-Za-z0-9]{22}\/logo\.svg\?v=[0-9a-f]{8}$/);
  assert.match(getInlineSvgAssetUrl({ id: ASSET_ID, filename: 'logo.svg' }), /^\/a\/[A-Za-z0-9]{22}\/logo\.svg$/);
});

test('proxy version changes when the served bytes change (content or dimensions)', () => {
  const base = getInlineSvgAssetVersion({ content: largeSvg, width: 649, height: 450 });
  assert.equal(base, getInlineSvgAssetVersion({ content: largeSvg, width: 649, height: 450 }));
  assert.notEqual(base, getInlineSvgAssetVersion({ content: largeSvg, width: 100, height: 100 }));
  assert.notEqual(base, getInlineSvgAssetVersion({ content: `${largeSvg} `, width: 649, height: 450 }));
  assert.equal(getInlineSvgAssetVersion({ content: null }), null);
});

test('withSvgIntrinsicSize injects missing width/height so viewBox-only SVGs keep an intrinsic size', () => {
  const sized = withSvgIntrinsicSize(smallSvg, 148, 28);
  assert.match(sized, /^<svg width="148" height="28" xmlns=/);
  // Existing dimensions are left alone, and unknown dimensions change nothing.
  const explicit = '<svg width="10" height="10" viewBox="0 0 10 10"></svg>';
  assert.equal(withSvgIntrinsicSize(explicit, 148, 28), explicit);
  assert.equal(withSvgIntrinsicSize(smallSvg, null, 28), smallSvg);
});

test('svg proxy URLs are never given resize params or a srcset ladder', () => {
  const url = '/a/0NxmdVej9rDMpouZnUb4qZ/background.svg?v=abcdef12';
  assert.equal(getOptimizedImageUrl(url, 1920, 85), url);
  assert.equal(generateImageSrcset(url), '');
  // Bitmaps through the proxy keep working as before.
  assert.equal(getOptimizedImageUrl('/a/0NxmdVej9rDMpouZnUb4qZ/hero.webp', 640, 80), '/a/0NxmdVej9rDMpouZnUb4qZ/hero.webp?width=640&quality=80');
});
