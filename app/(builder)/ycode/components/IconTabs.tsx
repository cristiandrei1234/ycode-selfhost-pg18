'use client';

import Icon, { type IconProps } from '@/components/ui/icon';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface IconOption<T extends string> {
  value: T;
  /** Icon to render; when omitted the label is rendered as text instead */
  icon?: IconProps['name'];
  /** Tooltip for icon options, visible text for text options */
  label: string;
}

interface IconTabsProps<T extends string> {
  /** Current option; an empty string selects nothing (value has no preset) */
  value: T | '';
  options: IconOption<T>[];
  onChange: (value: T) => void;
  /** Applied to every icon, e.g. to rotate axis icons to match a flex direction */
  iconClassName?: string;
}

/** Compact tab group: icon options get a tooltip, text options render their label */
export default function IconTabs<T extends string>({ value, options, onChange, iconClassName }: IconTabsProps<T>) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => onChange(next as T)}
      className="w-full"
    >
        <TabsList className="w-full">
            {options.map((option) => {
              if (!option.icon) {
                return (
                  <TabsTrigger key={option.value} value={option.value}>
                      {option.label}
                  </TabsTrigger>
                );
              }

              return (
                <Tooltip key={option.value}>
                    {/* Wrap in a span: Tooltip and Tabs both write `data-state`, so
                        sharing one element via asChild would drop the active tab style */}
                    <TooltipTrigger asChild>
                        <span className="flex flex-1 h-full">
                            <TabsTrigger
                              value={option.value}
                              aria-label={option.label}
                            >
                                <Icon name={option.icon} className={iconClassName} />
                            </TabsTrigger>
                        </span>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{option.label}</p>
                    </TooltipContent>
                </Tooltip>
              );
            })}
        </TabsList>
    </Tabs>
  );
}
