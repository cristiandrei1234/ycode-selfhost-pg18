'use client';

/**
 * Purple badge shown in place of a control when it is linked to a component
 * variable. Clicking opens the variable in the variables dialog; the "x"
 * unlinks it.
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { VARIABLE_TYPE_ICONS } from './ComponentVariableLabel';

import type { ComponentVariable } from '@/types';

interface LinkedVariableBadgeProps {
  variable: ComponentVariable;
  onOpen?: (variableId: string) => void;
  onUnlink: () => void;
}

export default function LinkedVariableBadge({ variable, onOpen, onUnlink }: LinkedVariableBadgeProps) {
  const iconName = VARIABLE_TYPE_ICONS[variable.type || 'text'];

  return (
    <Button
      asChild
      variant="purple"
      className="justify-between! w-full"
      onClick={() => onOpen?.(variable.id)}
    >
      <div>
        <span className="flex items-center gap-1.5">
          {iconName && <Icon name={iconName} className="size-3 opacity-60" />}
          {variable.name}
        </span>
        <Button
          className="size-4! p-0!"
          variant="outline"
          aria-label={`Unlink ${variable.name}`}
          onClick={(e) => { e.stopPropagation(); onUnlink(); }}
        >
          <Icon name="x" className="size-2" />
        </Button>
      </div>
    </Button>
  );
}
