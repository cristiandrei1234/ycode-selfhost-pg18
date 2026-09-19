'use client';

/**
 * Visible / Hidden toggle over a boolean `visible` value. Shared by the layer
 * Visibility setting, visibility-variable defaults, and instance overrides so
 * the three places always look and behave the same.
 */

import React from 'react';

import ToggleGroup from './ToggleGroup';

interface VisibilityToggleProps {
  visible: boolean;
  onChange: (visible: boolean) => void;
  disabled?: boolean;
}

const VISIBILITY_OPTIONS = [
  { label: 'Visible', value: true },
  { label: 'Hidden', value: false },
];

export default function VisibilityToggle({ visible, onChange, disabled = false }: VisibilityToggleProps) {
  return (
    <ToggleGroup
      options={VISIBILITY_OPTIONS}
      value={visible}
      onChange={(value) => onChange(value === true)}
      disabled={disabled}
    />
  );
}
