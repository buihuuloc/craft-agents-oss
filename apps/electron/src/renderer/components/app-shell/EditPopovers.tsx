import * as React from "react"
import { EditPopover, getEditConfig, type EditContextKey } from "@/components/ui/EditPopover"
import { findLabelById } from "@craft-agent/shared/labels"
import type { LabelConfig } from "@craft-agent/shared/labels"
import type { Workspace } from "../../../shared/types"

export type EditPopoverType = 'statuses' | 'labels' | 'views' | 'add-source' | 'add-source-api' | 'add-source-mcp' | 'add-source-local' | 'add-skill' | 'add-label' | null

interface EditPopoversProps {
  activeWorkspace: Workspace
  sidebarWidth: number
  editPopoverOpen: EditPopoverType
  setEditPopoverOpen: (value: EditPopoverType) => void
  editPopoverAnchorY: React.MutableRefObject<number>
  editLabelTargetId: React.MutableRefObject<string | undefined>
  labelConfigs: LabelConfig[]
}

/**
 * EditPopovers - Context menu triggered edit popovers for the sidebar.
 *
 * These EditPopovers are opened programmatically from sidebar context menus.
 * They use controlled state (editPopoverOpen) and invisible anchors for positioning.
 * The anchor Y position is captured from the right-clicked item (editPopoverAnchorY ref)
 * so the popover appears near the triggering item rather than at a fixed location.
 * modal={true} prevents auto-close when focus shifts after context menu closes.
 */
export function EditPopovers({
  activeWorkspace,
  sidebarWidth,
  editPopoverOpen,
  setEditPopoverOpen,
  editPopoverAnchorY,
  editLabelTargetId,
  labelConfigs,
}: EditPopoversProps) {
  return (
    <>
      {/* Configure Statuses EditPopover - anchored near sidebar */}
      <EditPopover
        open={editPopoverOpen === 'statuses'}
        onOpenChange={(isOpen) => setEditPopoverOpen(isOpen ? 'statuses' : null)}
        modal={true}
        trigger={
          <div
            className="fixed w-0 h-0 pointer-events-none"
            style={{ left: sidebarWidth + 20, top: editPopoverAnchorY.current }}
            aria-hidden="true"
          />
        }
        side="bottom"
        align="start"
        secondaryAction={{
          label: 'Edit File',
          filePath: `${activeWorkspace.rootPath}/statuses/config.json`,
        }}
        {...getEditConfig('edit-statuses', activeWorkspace.rootPath)}
      />
      {/* Configure Labels EditPopover - anchored near sidebar */}
      <EditPopover
        open={editPopoverOpen === 'labels'}
        onOpenChange={(isOpen) => setEditPopoverOpen(isOpen ? 'labels' : null)}
        modal={true}
        trigger={
          <div
            className="fixed w-0 h-0 pointer-events-none"
            style={{ left: sidebarWidth + 20, top: editPopoverAnchorY.current }}
            aria-hidden="true"
          />
        }
        side="bottom"
        align="start"
        secondaryAction={{
          label: 'Edit File',
          filePath: `${activeWorkspace.rootPath}/labels/config.json`,
        }}
        {...(() => {
          // Spread base config, override context to include which label was right-clicked
          const config = getEditConfig('edit-labels', activeWorkspace.rootPath)
          const targetLabel = editLabelTargetId.current
            ? findLabelById(labelConfigs, editLabelTargetId.current)
            : undefined
          if (!targetLabel) return config
          return {
            ...config,
            context: {
              ...config.context,
              context: (config.context.context || '') +
                ` The user right-clicked on the label "${targetLabel.name}" (id: "${targetLabel.id}"). ` +
                'If they refer to "this label" or "this", they mean this specific label.',
            },
          }
        })()}
      />
      {/* Edit Views EditPopover - anchored near sidebar */}
      <EditPopover
        open={editPopoverOpen === 'views'}
        onOpenChange={(isOpen) => setEditPopoverOpen(isOpen ? 'views' : null)}
        modal={true}
        trigger={
          <div
            className="fixed w-0 h-0 pointer-events-none"
            style={{ left: sidebarWidth + 20, top: editPopoverAnchorY.current }}
            aria-hidden="true"
          />
        }
        side="bottom"
        align="start"
        secondaryAction={{
          label: 'Edit File',
          filePath: `${activeWorkspace.rootPath}/views.json`,
        }}
        {...getEditConfig('edit-views', activeWorkspace.rootPath)}
      />
      {/* Add Source EditPopovers - one for each variant (generic + filter-specific)
       * editPopoverOpen can be: 'add-source', 'add-source-api', 'add-source-mcp', 'add-source-local'
       * Each variant uses its corresponding EditContextKey for filter-aware agent context */}
      {(['add-source', 'add-source-api', 'add-source-mcp', 'add-source-local'] as const).map((variant) => (
        <EditPopover
          key={variant}
          open={editPopoverOpen === variant}
          onOpenChange={(isOpen) => setEditPopoverOpen(isOpen ? variant : null)}
          modal={true}
          trigger={
            <div
              className="fixed w-0 h-0 pointer-events-none"
              style={{ left: sidebarWidth + 20, top: editPopoverAnchorY.current }}
              aria-hidden="true"
            />
          }
          side="bottom"
          align="start"
          {...getEditConfig(variant, activeWorkspace.rootPath)}
        />
      ))}
      {/* Add Skill EditPopover */}
      <EditPopover
        open={editPopoverOpen === 'add-skill'}
        onOpenChange={(isOpen) => setEditPopoverOpen(isOpen ? 'add-skill' : null)}
        modal={true}
        trigger={
          <div
            className="fixed w-0 h-0 pointer-events-none"
            style={{ left: sidebarWidth + 20, top: editPopoverAnchorY.current }}
            aria-hidden="true"
          />
        }
        side="bottom"
        align="start"
        {...getEditConfig('add-skill', activeWorkspace.rootPath)}
      />
      {/* Add Label EditPopover - triggered from "Add New Label" context menu on labels */}
      <EditPopover
        open={editPopoverOpen === 'add-label'}
        onOpenChange={(isOpen) => setEditPopoverOpen(isOpen ? 'add-label' : null)}
        modal={true}
        trigger={
          <div
            className="fixed w-0 h-0 pointer-events-none"
            style={{ left: sidebarWidth + 20, top: editPopoverAnchorY.current }}
            aria-hidden="true"
          />
        }
        side="bottom"
        align="start"
        secondaryAction={{
          label: 'Edit File',
          filePath: `${activeWorkspace.rootPath}/labels/config.json`,
        }}
        {...(() => {
          // Spread base config, override context to include which label was right-clicked
          const config = getEditConfig('add-label', activeWorkspace.rootPath)
          const targetLabel = editLabelTargetId.current
            ? findLabelById(labelConfigs, editLabelTargetId.current)
            : undefined
          if (!targetLabel) return config
          return {
            ...config,
            context: {
              ...config.context,
              context: (config.context.context || '') +
                ` The user right-clicked on the label "${targetLabel.name}" (id: "${targetLabel.id}"). ` +
                'The new label should be added as a sibling after this label, or as a child if the user specifies.',
            },
          }
        })()}
      />
    </>
  )
}
