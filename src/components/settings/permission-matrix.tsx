"use client";

import { PERMISSION_REGISTRY, RESOURCES, type PermissionMap } from "@/lib/permissions";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

interface PermissionMatrixProps {
  permissions: PermissionMap;
  onChange: (permissions: PermissionMap) => void;
  disabled?: boolean;
}

export function PermissionMatrix({
  permissions,
  onChange,
  disabled = false,
}: PermissionMatrixProps) {
  // Collect all unique action keys across all resources
  const allActions: { key: string; label: string }[] = [];
  const seenActions = new Set<string>();
  for (const resource of RESOURCES) {
    for (const action of PERMISSION_REGISTRY[resource].actions) {
      if (!seenActions.has(action.key)) {
        seenActions.add(action.key);
        allActions.push(action);
      }
    }
  }

  const isChecked = (resource: string, action: string) => {
    const res = resource as keyof PermissionMap;
    return permissions[res]?.includes(action) ?? false;
  };

  const toggle = (resource: string, action: string) => {
    const res = resource as keyof PermissionMap;
    const current = [...(permissions[res] ?? [])];
    const idx = current.indexOf(action);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(action);
    }
    onChange({ ...permissions, [res]: current });
  };

  const toggleRow = (resource: string) => {
    const reg = PERMISSION_REGISTRY[resource as keyof typeof PERMISSION_REGISTRY];
    const current = permissions[resource as keyof PermissionMap] ?? [];
    const allChecked = reg.actions.every((a) => current.includes(a.key));
    onChange({
      ...permissions,
      [resource]: allChecked ? [] : reg.actions.map((a) => a.key),
    });
  };

  const toggleColumn = (actionKey: string) => {
    // Check if all resources that have this action are checked
    const resourcesWithAction = RESOURCES.filter((r) =>
      PERMISSION_REGISTRY[r].actions.some((a) => a.key === actionKey),
    );
    const allChecked = resourcesWithAction.every((r) =>
      (permissions[r] ?? []).includes(actionKey),
    );

    const updated = { ...permissions };
    for (const r of resourcesWithAction) {
      const current = [...(updated[r] ?? [])];
      if (allChecked) {
        const idx = current.indexOf(actionKey);
        if (idx >= 0) current.splice(idx, 1);
      } else if (!current.includes(actionKey)) {
        current.push(actionKey);
      }
      updated[r] = current;
    }
    onChange(updated);
  };

  const selectAll = () => {
    const full: PermissionMap = {};
    for (const r of RESOURCES) {
      full[r] = PERMISSION_REGISTRY[r].actions.map((a) => a.key);
    }
    onChange(full);
  };

  const clearAll = () => {
    const empty: PermissionMap = {};
    for (const r of RESOURCES) {
      empty[r] = [];
    }
    onChange(empty);
  };

  const resourceHasAction = (resource: string, actionKey: string) => {
    return PERMISSION_REGISTRY[resource as keyof typeof PERMISSION_REGISTRY].actions.some(
      (a) => a.key === actionKey,
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={selectAll} disabled={disabled}>
          Select All
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={clearAll} disabled={disabled}>
          Clear All
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="sticky left-0 z-10 bg-muted/50 px-3 py-2 text-left font-medium">
                Resource
              </th>
              {allActions.map((action) => (
                <th key={action.key} className="px-2 py-2 text-center font-medium whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => !disabled && toggleColumn(action.key)}
                    className="hover:text-primary cursor-pointer transition-colors"
                    disabled={disabled}
                  >
                    {action.label}
                  </button>
                </th>
              ))}
              <th className="px-2 py-2 text-center font-medium">All</th>
            </tr>
          </thead>
          <tbody>
            {RESOURCES.map((resource) => {
              const reg = PERMISSION_REGISTRY[resource];
              const current = permissions[resource] ?? [];
              const allRowChecked = reg.actions.every((a) => current.includes(a.key));

              return (
                <tr key={resource} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="sticky left-0 z-10 bg-background px-3 py-2 font-medium whitespace-nowrap">
                    {reg.label}
                  </td>
                  {allActions.map((action) => {
                    const hasAction = resourceHasAction(resource, action.key);
                    return (
                      <td key={action.key} className="px-2 py-2 text-center">
                        {hasAction ? (
                          <Checkbox
                            checked={isChecked(resource, action.key)}
                            onCheckedChange={() => toggle(resource, action.key)}
                            disabled={disabled}
                            className="mx-auto"
                          />
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-center">
                    <Checkbox
                      checked={allRowChecked}
                      onCheckedChange={() => toggleRow(resource)}
                      disabled={disabled}
                      className="mx-auto"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
