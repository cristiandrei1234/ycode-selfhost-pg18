import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Layer } from '@/types';
import { findLcpCandidate, getRenderedWidthPx } from '@/lib/asset-utils';

function image(id: string, classes: string, extra: Partial<Layer> = {}): Layer {
  return {
    id,
    name: 'image',
    classes,
    variables: { image: { src: { type: 'asset', data: { asset_id: `asset-${id}` } } } },
    ...extra,
  } as Layer;
}

function div(id: string, children: Layer[]): Layer {
  return { id, name: 'div', classes: '', children } as Layer;
}

// Every asset is a 300px-wide raster — mirrors the getailicia case where the
// intrinsic width passed the old floor even though the image rendered at 40px.
const assets = {
  'asset-avatar': { width: 300, mimeType: 'image/webp', url: 'https://cdn/avatar.webp' },
  'asset-hero': { width: 1600, mimeType: 'image/jpeg', url: 'https://cdn/hero.jpg' },
};

test('getRenderedWidthPx reads arbitrary px, rem and spacing-scale widths', () => {
  assert.equal(getRenderedWidthPx(image('a', 'w-[40px] h-[40px]')), 40);
  assert.equal(getRenderedWidthPx(image('b', 'w-[2.5rem]')), 40);
  assert.equal(getRenderedWidthPx(image('c', 'w-10 h-10 rounded-full')), 40);
  assert.equal(getRenderedWidthPx(image('d', 'size-10 rounded-full')), 40);
  assert.equal(getRenderedWidthPx(image('e', 'w-px')), 1);
});

test('getRenderedWidthPx treats fluid widths as unknown', () => {
  assert.equal(getRenderedWidthPx(image('a', 'w-full')), null);
  assert.equal(getRenderedWidthPx(image('b', 'w-1/2')), null);
  assert.equal(getRenderedWidthPx(image('c', 'w-auto h-10')), null);
  assert.equal(getRenderedWidthPx(image('d', 'w-[50vw]')), null);
  assert.equal(getRenderedWidthPx(image('e', '')), null);
});

test('getRenderedWidthPx ignores breakpoint and state variants', () => {
  // Desktop is the unprefixed class; the mobile override must not win.
  assert.equal(getRenderedWidthPx(image('a', 'w-full max-md:w-10')), null);
  assert.equal(getRenderedWidthPx(image('b', 'hover:w-10')), null);
  assert.equal(getRenderedWidthPx(image('c', 'max-md:w-[40px] w-[600px]')), 600);
});

test('getRenderedWidthPx caps by max-width and lets later classes win', () => {
  assert.equal(getRenderedWidthPx(image('a', 'w-full max-w-[48px]')), 48);
  assert.equal(getRenderedWidthPx(image('b', 'w-[600px] max-w-[320px]')), 320);
  assert.equal(getRenderedWidthPx(image('c', 'w-[40px] w-[600px]')), 600);
});

test('getRenderedWidthPx falls back to design.sizing when classes are silent', () => {
  const layer = image('a', 'rounded-full', { design: { sizing: { width: '40px' } } });
  assert.equal(getRenderedWidthPx(layer), 40);

  const fluid = image('b', '', { design: { sizing: { width: '100%' } } });
  assert.equal(getRenderedWidthPx(fluid), null);
});

test('findLcpCandidate skips images that render narrower than minWidth', () => {
  const layers = [
    div('social-proof', [image('avatar', 'w-10 h-10 rounded-full')]),
    div('hero', [image('hero', 'w-full')]),
  ];
  assert.equal(findLcpCandidate(layers, assets)?.layerId, 'hero');
});

test('findLcpCandidate still returns nothing when the only image is tiny', () => {
  const layers = [div('social-proof', [image('avatar', 'w-[40px]')])];
  assert.equal(findLcpCandidate(layers, assets), null);
});

test('findLcpCandidate keeps fluid and large rendered images as candidates', () => {
  const fluid = [div('hero', [image('hero', 'w-full object-cover')])];
  assert.equal(findLcpCandidate(fluid, assets)?.layerId, 'hero');

  const fixed = [div('hero', [image('hero', 'w-[640px]')])];
  assert.equal(findLcpCandidate(fixed, assets)?.layerId, 'hero');
});

test('findLcpCandidate keeps the intrinsic-width floor for unsized images', () => {
  const layers = [div('hero', [image('avatar', 'rounded-full')])];
  // Intrinsic 300px asset with no rendered size still passes (unknown != tiny).
  assert.equal(findLcpCandidate(layers, assets)?.layerId, 'avatar');
  // A small intrinsic asset is still rejected by the existing check.
  const small = { 'asset-avatar': { width: 120, mimeType: 'image/webp', url: 'https://cdn/a.webp' } };
  assert.equal(findLcpCandidate(layers, small), null);
});
