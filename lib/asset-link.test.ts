import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getInlineSvgAssetUrl } from './asset-utils';
import {
  generateLinkHref,
  resolveAssetLinkHref,
  resolveCollectionLinkValue,
  resolveFieldLinkValue,
  resolveLinkAttrs,
} from './link-utils';
import type { LinkSettings } from '../types';

const ASSET_ID = '66f9aaa5-364e-4df4-afb4-7b40d27af2c9';
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 223 100"><path d="M0 0h1v1H0z"/></svg>';

// An icon-library SVG: markup in `content`, no storage_path / public_url.
const inlineSvgAsset = { id: ASSET_ID, filename: 'blue-fondue-white', public_url: null, content: svg, width: 223, height: 100 };
const expectedProxyUrl = getInlineSvgAssetUrl(inlineSvgAsset);

const assetLink: LinkSettings = { type: 'asset', asset: { id: ASSET_ID }, download: true };

test('inline-SVG asset links resolve to the /a/ proxy URL', () => {
  assert.equal(resolveAssetLinkHref(ASSET_ID, inlineSvgAsset), expectedProxyUrl);
  assert.match(expectedProxyUrl, /^\/a\/[A-Za-z0-9]{22}\/blue-fondue-white\.svg\?v=[0-9a-f]{8}$/);
});

test('storage-backed assets keep their public_url', () => {
  assert.equal(
    resolveAssetLinkHref(ASSET_ID, { id: ASSET_ID, filename: 'brief.pdf', public_url: '/a/abc/brief.pdf' }),
    '/a/abc/brief.pdf'
  );
  assert.equal(resolveAssetLinkHref(ASSET_ID, null), null);
  assert.equal(resolveAssetLinkHref(ASSET_ID, { id: ASSET_ID, public_url: null, content: null }), null);
});

test('inline-SVG links fall back to the asset id and a placeholder name when the resolver omits them', () => {
  const href = resolveAssetLinkHref(ASSET_ID, { public_url: null, content: svg });
  assert.equal(href, getInlineSvgAssetUrl({ id: ASSET_ID, filename: 'file', content: svg }));
});

test('generateLinkHref builds a downloadable proxy href for inline-SVG asset links', () => {
  const context = { getAsset: () => inlineSvgAsset };
  assert.equal(generateLinkHref(assetLink, context), expectedProxyUrl);
  assert.deepEqual(resolveLinkAttrs(assetLink, context), { href: expectedProxyUrl, target: '_self', download: true });
});

test('SSR resolvedAssets entries holding raw SVG markup resolve to the proxy URL', () => {
  const resolvedAssets = { [ASSET_ID]: { url: svg, filename: 'blue-fondue-white', width: 223, height: 100 } };
  const context = { resolvedAssets };

  assert.equal(resolveCollectionLinkValue({ type: 'asset', asset: { id: ASSET_ID } }, context), expectedProxyUrl);
  assert.equal(
    resolveFieldLinkValue({ fieldId: 'f1', rawValue: ASSET_ID, fieldType: 'image', context }),
    expectedProxyUrl
  );
  assert.equal(
    resolveFieldLinkValue({ fieldId: 'f1', rawValue: ASSET_ID, fieldType: 'image', context: {}, assetMap: { [ASSET_ID]: inlineSvgAsset } }),
    expectedProxyUrl
  );
});
