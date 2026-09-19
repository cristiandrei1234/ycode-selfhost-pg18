'use client';

import { useDesignSync } from '@/hooks/use-design-sync';
import { useEditorStore } from '@/stores/useEditorStore';
import type { Layer } from '@/types';

const noop = () => {};

export interface ParentLayout {
  /** Parent is a flex (or inline-flex) container */
  isFlex: boolean;
  /** Parent is a grid (or inline-grid) container */
  isGrid: boolean;
  /** Parent is a flex container laid out on the column axis */
  isColumnAxis: boolean;
  /** Parent's align-items, normalized to `start|center|end|stretch|baseline` (browser default: stretch) */
  alignItems: string;
}

/** `items-*` classes may be stored as `flex-start`/`flex-end`; the browser default is `stretch` */
function normalizeAlignItems(value: string): string {
  if (!value) return 'stretch';
  return value.replace(/^flex-/, '');
}

/**
 * Resolve a layer's parent layout (with breakpoint/state inheritance).
 * Flex-child and grid-child controls only apply inside a flex/grid parent,
 * and their axis follows the parent's flex direction, not the layer's own.
 */
export function useParentLayout(parentLayer: Layer | null): ParentLayout {
  const activeBreakpoint = useEditorStore((s) => s.activeBreakpoint);
  const activeUIState = useEditorStore((s) => s.activeUIState);
  const { getDesignProperty } = useDesignSync({
    layer: parentLayer,
    onLayerUpdate: noop,
    activeBreakpoint,
    activeUIState,
  });

  const display = parentLayer ? (getDesignProperty('layout', 'display') || '') : '';
  const flexDirection = getDesignProperty('layout', 'flexDirection') || 'row';
  const alignItems = normalizeAlignItems(getDesignProperty('layout', 'alignItems') || '');
  const isFlex = display === 'flex' || display === 'inline-flex';
  const isGrid = display === 'grid' || display === 'inline-grid';

  return {
    isFlex,
    isGrid,
    isColumnAxis: isFlex && (flexDirection === 'column' || flexDirection === 'column-reverse'),
    alignItems,
  };
}
