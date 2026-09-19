'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Icon from '@/components/ui/icon';

import SettingsPanel from './SettingsPanel';

import type { Layer, LayerSettings } from '@/types';

/** Boolean layer settings exposed as opt-in "Advanced" options */
type AdvancedOptionKey = 'keepInHtml';

interface AdvancedOption {
  key: AdvancedOptionKey;
  label: string;
  /** Whether the option makes sense for this layer's current settings */
  isApplicable: (settings: LayerSettings) => boolean;
}

const ADVANCED_OPTIONS: AdvancedOption[] = [
  {
    key: 'keepInHtml',
    label: 'Keep in HTML when hidden',
    isApplicable: (settings) => settings.hidden === true,
  },
];

interface AdvancedSettingsProps {
  layer: Layer;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
  disabled?: boolean;
}

/**
 * "Advanced" settings panel. Works like Custom attributes: the + button lists
 * options not yet enabled, and each enabled option renders as a removable row.
 * Renders nothing when no option applies to the layer (e.g. a visible layer
 * has no use for "Keep in HTML when hidden").
 */
export default function AdvancedSettings({
  layer,
  onLayerUpdate,
  disabled = false,
}: AdvancedSettingsProps) {
  const settings: LayerSettings = layer.settings ?? {};
  const applicableOptions = ADVANCED_OPTIONS.filter((option) => option.isApplicable(settings));
  const enabledOptions = applicableOptions.filter((option) => settings[option.key] === true);
  const availableOptions = applicableOptions.filter((option) => settings[option.key] !== true);

  if (applicableOptions.length === 0) {
    return null;
  }

  const setOption = (key: AdvancedOptionKey, enabled: boolean) => {
    onLayerUpdate(layer.id, { settings: { ...settings, [key]: enabled } });
  };

  const canAdd = !disabled && availableOptions.length > 0;

  const addButton = (
    <Button
      variant="ghost"
      size="xs"
      disabled={!canAdd}
      aria-label="Add advanced option"
    >
      <Icon name="plus" />
    </Button>
  );

  return (
    <SettingsPanel
      title="Advanced"
      isOpen={enabledOptions.length > 0}
      onToggle={() => {}}
      action={
        // Nothing left to add: render a plain disabled button so no menu can open
        canAdd ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>{addButton}</DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {availableOptions.map((option) => (
                <DropdownMenuItem
                  key={option.key}
                  onSelect={() => setOption(option.key, true)}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : addButton
      }
    >
      {enabledOptions.length > 0 && (
        <div className="flex flex-col gap-1">
          {enabledOptions.map((option) => (
            <div
              key={option.key}
              className="flex items-center justify-between pl-3 pr-1 h-8 bg-muted text-muted-foreground rounded-lg"
            >
              <span className="truncate">{option.label}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="xs"
                    disabled={disabled}
                    aria-label={`${option.label} options`}
                  >
                    <Icon name="more" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setOption(option.key, false)}>
                    Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}
    </SettingsPanel>
  );
}
