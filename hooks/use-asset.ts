/**
 * Custom hook to resolve asset IDs to Asset objects
 * 
 * Provides a simple interface for components to get asset details by ID
 */

import { useEffect } from 'react';
import { useAssetsStore } from '@/stores/useAssetsStore';
import type { Asset } from '@/types';

/**
 * Hook to get an asset by ID
 * Returns the asset object or null if not found
 * Automatically loads assets store if not already loaded
 */
export function useAsset(assetId: string | null | undefined): Asset | null {
  const asset = useAssetsStore(state => (assetId ? state.assetsById[assetId] ?? null : null));
  const getAsset = useAssetsStore(state => state.getAsset);
  const loadAssets = useAssetsStore(state => state.loadAssets);
  const isLoaded = useAssetsStore(state => state.isLoaded);

  useEffect(() => {
    // Load assets if not already loaded
    if (!isLoaded) {
      loadAssets();
    }
  }, [isLoaded, loadAssets]);

  // `getAsset` kicks off a background fetch for ids missing from the cache;
  // the selector above picks the asset up once it lands in the store.
  useEffect(() => {
    if (assetId) {
      getAsset(assetId);
    }
  }, [assetId, getAsset]);

  return asset;
}
