'use client';

/**
 * ID Setting
 *
 * Input for a layer's HTML `id` attribute (`settings.id`), shown in the
 * Settings tab. The value is sanitized to a valid HTML id as the user types.
 *
 * Inside a component the setting can be linked to an 'id' variable
 * (`settings.idVariableId`) so each instance carries its own element id (e.g.
 * a per-page tracking id on a shared button); while linked the input is
 * replaced by the variable badge.
 */

import React, { useCallback } from 'react';

import { Input } from '@/components/ui/input';

import ComponentVariableLabel from './ComponentVariableLabel';
import LinkedVariableBadge from './LinkedVariableBadge';

import { useComponentsStore } from '@/stores/useComponentsStore';
import { useEditorStore } from '@/stores/useEditorStore';

import { useControlledInput } from '@/hooks/use-controlled-input';
import { sanitizeHtmlId } from '@/lib/html-utils';

import type { IdSettingsValue, Layer } from '@/types';

interface IdSettingProps {
  layer: Layer;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
  disabled?: boolean;
  onOpenVariablesDialog?: (variableId?: string) => void;
}

export default function IdSetting({
  layer,
  onLayerUpdate,
  disabled = false,
  onOpenVariablesDialog,
}: IdSettingProps) {
  const editingComponentId = useEditorStore((state) => state.editingComponentId);
  const getComponentById = useComponentsStore((state) => state.getComponentById);
  const addIdVariable = useComponentsStore((state) => state.addIdVariable);
  const updateTextVariable = useComponentsStore((state) => state.updateTextVariable);

  // `settings.id` takes priority over a legacy `attributes.id` in the renderer
  const currentId = sanitizeHtmlId(layer.settings?.id || layer.attributes?.id || '');
  // Sanitization happens in the change handler, so skip the hook's space stripping
  const [idInput, setIdInput] = useControlledInput(currentId, undefined, false);

  const editingComponent = editingComponentId ? getComponentById(editingComponentId) : undefined;
  const idVariables = (editingComponent?.variables || []).filter((v) => v.type === 'id');
  const linkedVariableId = layer.settings?.idVariableId;
  const linkedVariable = idVariables.find((v) => v.id === linkedVariableId);

  const handleChange = (value: string) => {
    const sanitizedId = sanitizeHtmlId(value);
    setIdInput(sanitizedId);
    onLayerUpdate(layer.id, {
      settings: { ...layer.settings, id: sanitizedId },
    });
  };

  const handleLinkVariable = useCallback((variableId: string) => {
    onLayerUpdate(layer.id, {
      settings: { ...layer.settings, idVariableId: variableId },
    });
  }, [layer.id, layer.settings, onLayerUpdate]);

  const handleUnlinkVariable = useCallback(() => {
    const { idVariableId: _, ...restSettings } = layer.settings ?? {};
    onLayerUpdate(layer.id, { settings: restSettings });
  }, [layer.id, layer.settings, onLayerUpdate]);

  // New variable starts from the layer's current id so linking is a no-op visually
  const handleCreateVariable = useCallback(async () => {
    if (!editingComponentId) return;
    const newId = await addIdVariable(editingComponentId, 'ID');
    if (!newId) return;
    const defaultValue: IdSettingsValue = { id: currentId };
    await updateTextVariable(editingComponentId, newId, { default_value: defaultValue });
    handleLinkVariable(newId);
    onOpenVariablesDialog?.(newId);
  }, [editingComponentId, addIdVariable, updateTextVariable, currentId, handleLinkVariable, onOpenVariablesDialog]);

  return (
    <div className="grid grid-cols-3">
      <div className="flex items-center gap-1">
        <ComponentVariableLabel
          label="ID"
          isEditingComponent={!!editingComponentId}
          variables={idVariables}
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
          <Input
            type="text"
            value={idInput}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="For in-page linking"
            disabled={disabled}
          />
        )}
      </div>
    </div>
  );
}
