'use client';

/**
 * Visibility Setting
 *
 * Visible / Hidden toggle for a layer's `settings.hidden` flag.
 * Same flag the layers tree eye icon and Shift+Cmd+H toggle, surfaced in the
 * Settings tab so it can be found without hunting through the tree.
 *
 * Inside a component the setting can be linked to a 'visibility' variable
 * (`settings.visibilityVariableId`) so each instance decides whether the
 * layer shows; while linked the toggle is replaced by the variable badge.
 */

import React, { useCallback } from 'react';

import ComponentVariableLabel from './ComponentVariableLabel';
import LinkedVariableBadge from './LinkedVariableBadge';
import VisibilityToggle from './VisibilityToggle';

import { useComponentsStore } from '@/stores/useComponentsStore';
import { useEditorStore } from '@/stores/useEditorStore';

import type { Layer, VisibilitySettingsValue } from '@/types';

interface VisibilitySettingProps {
  layer: Layer;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
  disabled?: boolean;
  onOpenVariablesDialog?: (variableId?: string) => void;
}

export default function VisibilitySetting({
  layer,
  onLayerUpdate,
  disabled = false,
  onOpenVariablesDialog,
}: VisibilitySettingProps) {
  const editingComponentId = useEditorStore((state) => state.editingComponentId);
  const getComponentById = useComponentsStore((state) => state.getComponentById);
  const addVisibilityVariable = useComponentsStore((state) => state.addVisibilityVariable);
  const updateTextVariable = useComponentsStore((state) => state.updateTextVariable);

  const isHidden = layer.settings?.hidden ?? false;

  const editingComponent = editingComponentId ? getComponentById(editingComponentId) : undefined;
  const visibilityVariables = (editingComponent?.variables || []).filter((v) => v.type === 'visibility');
  const linkedVariableId = layer.settings?.visibilityVariableId;
  const linkedVariable = visibilityVariables.find((v) => v.id === linkedVariableId);

  const handleChange = (visible: boolean) => {
    const hidden = !visible;
    if (hidden === isHidden) return;
    onLayerUpdate(layer.id, {
      settings: { ...layer.settings, hidden },
    });
  };

  const handleLinkVariable = useCallback((variableId: string) => {
    onLayerUpdate(layer.id, {
      settings: { ...layer.settings, visibilityVariableId: variableId },
    });
  }, [layer.id, layer.settings, onLayerUpdate]);

  const handleUnlinkVariable = useCallback(() => {
    const { visibilityVariableId: _, ...restSettings } = layer.settings ?? {};
    onLayerUpdate(layer.id, { settings: restSettings });
  }, [layer.id, layer.settings, onLayerUpdate]);

  // New variable starts from the layer's current state so linking is a no-op visually
  const handleCreateVariable = useCallback(async () => {
    if (!editingComponentId) return;
    const newId = await addVisibilityVariable(editingComponentId, 'Visibility');
    if (!newId) return;
    const defaultValue: VisibilitySettingsValue = { visible: !isHidden };
    await updateTextVariable(editingComponentId, newId, { default_value: defaultValue });
    handleLinkVariable(newId);
    onOpenVariablesDialog?.(newId);
  }, [editingComponentId, addVisibilityVariable, updateTextVariable, isHidden, handleLinkVariable, onOpenVariablesDialog]);

  return (
    <div className="grid grid-cols-3">
      <div className="flex items-center gap-1">
        <ComponentVariableLabel
          label="Visibility"
          isEditingComponent={!!editingComponentId}
          variables={visibilityVariables}
          linkedVariableId={linkedVariableId}
          onLinkVariable={handleLinkVariable}
          onManageVariables={() => onOpenVariablesDialog?.(linkedVariableId)}
          onCreateVariable={editingComponentId ? handleCreateVariable : undefined}
        />
      </div>
      <div className="col-span-2 *:w-full">
        {linkedVariable ? (
          <LinkedVariableBadge
            variable={linkedVariable}
            onOpen={onOpenVariablesDialog}
            onUnlink={handleUnlinkVariable}
          />
        ) : (
          <VisibilityToggle
            visible={!isHidden}
            onChange={handleChange}
            disabled={disabled}
          />
        )}
      </div>
    </div>
  );
}
