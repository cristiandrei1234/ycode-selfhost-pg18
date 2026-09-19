'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEditorStore } from '@/stores/useEditorStore';
import { getInheritedValue } from '@/lib/tailwind-class-mapper';
import type { Breakpoint, Layer, UIState } from '@/types';

type SpanProperty = 'gridColumnSpan' | 'gridRowSpan';

/** Tailwind ships `col-span-1` … `col-span-12` plus `col-span-full` (`1 / -1`) */
const SPAN_OPTIONS: { value: string; label: string }[] = [
  ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `Span ${i + 1}` })),
  { value: 'full', label: 'Span all' },
];

/** No class (or `auto`) is the browser default of one cell */
function toSelectValue(value: string): string {
  if (!value || value === 'auto') return '1';
  return value;
}

/**
 * True when a wider breakpoint (or the neutral state) already sets this property, so an
 * explicit class is needed at the current breakpoint to override it.
 */
function inheritsFromWiderBreakpoint(layer: Layer, property: SpanProperty, breakpoint: Breakpoint, uiState: UIState): boolean {
  const classes = Array.isArray(layer.classes)
    ? layer.classes
    : (layer.classes || '').split(' ').filter(Boolean);
  const { value, source } = getInheritedValue(classes, property, breakpoint, uiState);
  return Boolean(value) && source !== breakpoint;
}

interface GridSpanRowProps {
  label: string;
  layer: Layer;
  property: SpanProperty;
  /** Resolved span for the current breakpoint/state ('' when unset) */
  value: string;
  onChange: (property: SpanProperty, value: string | null) => void;
}

/**
 * "Columns" / "Rows" span picker for a grid child: Span 1 … Span 12 and Span all.
 * Shows Span 1 when unset (the browser default).
 */
export default function GridSpanRow({ label, layer, property, value, onChange }: GridSpanRowProps) {
  const activeBreakpoint = useEditorStore((s) => s.activeBreakpoint);
  const activeUIState = useEditorStore((s) => s.activeUIState);

  const handleChange = (next: string) => {
    // Span 1 is the default, so it is stored as "no class" — unless a wider breakpoint
    // spans more, in which case `col-span-1` is a real override and must be written.
    const isDefault = next === '1' && !inheritsFromWiderBreakpoint(layer, property, activeBreakpoint, activeUIState);
    onChange(property, isDefault ? null : next);
  };

  return (
    <div className="grid grid-cols-3">
      <Label variant="muted">{label}</Label>
      <div className="col-span-2">
        <Select value={toSelectValue(value)} onValueChange={handleChange}>
          <SelectTrigger
            className="w-full"
            aria-label={property === 'gridColumnSpan' ? 'Column span' : 'Row span'}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {SPAN_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
