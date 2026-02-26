import * as React from "react"
import { Check, X, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenuSub,
  StyledDropdownMenuItem,
  StyledDropdownMenuSeparator,
  StyledDropdownMenuSubTrigger,
  StyledDropdownMenuSubContent,
} from "@/components/ui/styled-dropdown"
import { LabelIcon } from "@/components/ui/label-icon"
import type { LabelConfig } from "@craft-agent/shared/labels"

/** Filter mode for tri-state filtering: include shows only matching, exclude hides matching */
export type FilterMode = 'include' | 'exclude'

/**
 * FilterModeBadge - Display-only badge showing the current filter mode.
 * Shows a checkmark for 'include' and an X for 'exclude'. Used as a visual
 * indicator inside DropdownMenuSubTrigger rows (the actual mode switching
 * happens via the sub-menu content, not this badge).
 */
export function FilterModeBadge({ mode }: { mode: FilterMode }) {
  return (
    <span
      className={cn(
        "flex items-center justify-center h-5 w-5 rounded-[4px] -mr-1",
        mode === 'include'
          ? "bg-background text-foreground shadow-minimal"
          : "bg-destructive/10 text-destructive shadow-tinted",
      )}
      style={mode === 'exclude' ? { '--shadow-color': 'var(--destructive-rgb)' } as React.CSSProperties : undefined}
    >
      {mode === 'include' ? <Check className="!h-2.5 !w-2.5" /> : <X className="!h-2.5 !w-2.5" />}
    </span>
  )
}

/**
 * FilterModeSubMenuItems - Shared sub-menu content for switching filter mode.
 * Renders Include / Exclude / Remove options using StyledDropdownMenuItem for
 * consistent styling. Used inside StyledDropdownMenuSubContent by both leaf
 * and group label items when they have an active filter mode.
 */
export function FilterModeSubMenuItems({
  mode,
  onChangeMode,
  onRemove,
}: {
  mode: FilterMode
  onChangeMode: (mode: FilterMode) => void
  onRemove: () => void
}) {
  return (
    <>
      <StyledDropdownMenuItem
        onClick={(e) => { e.preventDefault(); onChangeMode('include') }}
        className={cn(mode === 'include' && "bg-foreground/[0.03]")}
      >
        <Check className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1">Include</span>
      </StyledDropdownMenuItem>
      <StyledDropdownMenuItem
        onClick={(e) => { e.preventDefault(); onChangeMode('exclude') }}
        className={cn(mode === 'exclude' && "bg-foreground/[0.03]")}
      >
        <X className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1">Exclude</span>
      </StyledDropdownMenuItem>
      <StyledDropdownMenuSeparator />
      <StyledDropdownMenuItem
        onClick={(e) => { e.preventDefault(); onRemove() }}
      >
        <Trash2 className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1">Clear</span>
      </StyledDropdownMenuItem>
    </>
  )
}

/**
 * FilterMenuRow - Consistent layout for filter menu items.
 * Enforces: [icon 14px box] [label flex] [accessory 12px box]
 */
export function FilterMenuRow({
  icon,
  label,
  accessory,
  iconClassName,
  iconStyle,
  noIconContainer,
}: {
  icon: React.ReactNode
  label: React.ReactNode
  accessory?: React.ReactNode
  /** Additional classes for icon container (e.g., for status icon scaling) */
  iconClassName?: string
  /** Style for icon container (e.g., for status icon color) */
  iconStyle?: React.CSSProperties
  /** When true, skip the icon container (for icons that have their own container) */
  noIconContainer?: boolean
}) {
  return (
    <>
      {noIconContainer ? (
        // Wrapper for color inheritance. Clone icon to add bare prop (removes EntityIcon container).
        <span style={iconStyle}>
          {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<{ bare?: boolean }>, { bare: true }) : icon}
        </span>
      ) : (
        <span
          className={cn("h-3.5 w-3.5 flex items-center justify-center shrink-0", iconClassName)}
          style={iconStyle}
        >
          {icon}
        </span>
      )}
      <span className="flex-1">{label}</span>
      <span className="shrink-0">{accessory}</span>
    </>
  )
}

/**
 * FilterLabelItems - Recursive component for rendering label tree in the filter dropdown.
 *
 * Rendering rules by label state:
 * - **Inactive leaf**: StyledDropdownMenuItem -- click to add as 'include'
 * - **Active leaf**: DropdownMenuSub -- SubTrigger shows label + mode badge, SubContent
 *   has Include/Exclude/Remove options (uses Radix's built-in safe-triangle hover)
 * - **Group (with children)**: Always a DropdownMenuSub. When active, SubContent shows
 *   mode options first, then separator, then children. When inactive, shows a self-toggle
 *   item, then separator, then children.
 * - **Pinned labels**: Shown with a check mark, non-interactive (no toggle/sub-menu).
 */
export function FilterLabelItems({
  labels,
  labelFilter,
  setLabelFilter,
  pinnedLabelId,
}: {
  labels: LabelConfig[]
  labelFilter: Map<string, FilterMode>
  setLabelFilter: (updater: Map<string, FilterMode> | ((prev: Map<string, FilterMode>) => Map<string, FilterMode>)) => void
  /** Label ID pinned by the current route (non-removable, shown as checked+disabled) */
  pinnedLabelId?: string | null
}) {
  /** Toggle a label filter: if active -> remove, if inactive -> add as 'include' */
  const toggleLabel = (id: string) => {
    setLabelFilter(prev => {
      const next = new Map(prev)
      if (next.has(id)) next.delete(id)
      else next.set(id, 'include')
      return next
    })
  }

  /** Build callbacks for changing/removing a label's filter mode */
  const makeModeCallbacks = (id: string) => ({
    onChangeMode: (newMode: FilterMode) => setLabelFilter(prev => {
      const next = new Map(prev)
      next.set(id, newMode)
      return next
    }),
    onRemove: () => setLabelFilter(prev => {
      const next = new Map(prev)
      next.delete(id)
      return next
    }),
  })

  return (
    <>
      {labels.map(label => {
        const hasChildren = label.children && label.children.length > 0
        const isPinned = label.id === pinnedLabelId
        const mode = labelFilter.get(label.id)
        const isActive = !!mode && !isPinned

        // --- Group labels (have children) -> always DropdownMenuSub ---
        if (hasChildren) {
          // Check if any child has an active filter (to show indicator on parent)
          const hasActiveChild = label.children!.some(child => {
            const childMode = labelFilter.get(child.id)
            return !!childMode && child.id !== pinnedLabelId
          })
          const showIndicator = isActive || hasActiveChild || isPinned

          return (
            <DropdownMenuSub key={label.id}>
              <StyledDropdownMenuSubTrigger>
                <FilterMenuRow
                  icon={<LabelIcon label={label} size="sm" hasChildren />}
                  label={label.name}
                  accessory={
                    showIndicator ? <Check className="h-3 w-3 text-muted-foreground" /> : undefined
                  }
                />
              </StyledDropdownMenuSubTrigger>
              <StyledDropdownMenuSubContent minWidth="min-w-[160px]">
                {isActive ? (
                  // Active group: group title as nested sub-trigger for mode options, then children
                  <>
                    <DropdownMenuSub>
                      {/* Click the group title to clear, hover to open mode submenu */}
                      <StyledDropdownMenuSubTrigger onClick={(e) => { e.preventDefault(); toggleLabel(label.id) }}>
                        <FilterMenuRow
                          icon={<LabelIcon label={label} size="sm" hasChildren />}
                          label={label.name}
                          accessory={<FilterModeBadge mode={mode} />}
                        />
                      </StyledDropdownMenuSubTrigger>
                      <StyledDropdownMenuSubContent minWidth="min-w-[140px]">
                        <FilterModeSubMenuItems mode={mode} {...makeModeCallbacks(label.id)} />
                      </StyledDropdownMenuSubContent>
                    </DropdownMenuSub>
                    <StyledDropdownMenuSeparator />
                    <FilterLabelItems
                      labels={label.children!}
                      labelFilter={labelFilter}
                      setLabelFilter={setLabelFilter}
                      pinnedLabelId={pinnedLabelId}
                    />
                  </>
                ) : (
                  // Inactive group: self-toggle item, then children
                  <>
                    <StyledDropdownMenuItem
                      disabled={isPinned}
                      onClick={(e) => {
                        if (isPinned) return
                        e.preventDefault()
                        toggleLabel(label.id)
                      }}
                    >
                      <FilterMenuRow
                        icon={<LabelIcon label={label} size="sm" hasChildren />}
                        label={label.name}
                        accessory={isPinned ? <Check className="h-3 w-3 text-muted-foreground" /> : undefined}
                      />
                    </StyledDropdownMenuItem>
                    <StyledDropdownMenuSeparator />
                    <FilterLabelItems
                      labels={label.children!}
                      labelFilter={labelFilter}
                      setLabelFilter={setLabelFilter}
                      pinnedLabelId={pinnedLabelId}
                    />
                  </>
                )}
              </StyledDropdownMenuSubContent>
            </DropdownMenuSub>
          )
        }

        // --- Active leaf label -> DropdownMenuSub with mode options ---
        if (isActive) {
          return (
            <DropdownMenuSub key={label.id}>
              {/* Click the item itself to clear, hover to open mode submenu */}
              <StyledDropdownMenuSubTrigger onClick={(e) => { e.preventDefault(); toggleLabel(label.id) }}>
                <FilterMenuRow
                  icon={<LabelIcon label={label} size="sm" />}
                  label={label.name}
                  accessory={<FilterModeBadge mode={mode} />}
                />
              </StyledDropdownMenuSubTrigger>
              <StyledDropdownMenuSubContent minWidth="min-w-[140px]">
                <FilterModeSubMenuItems mode={mode} {...makeModeCallbacks(label.id)} />
              </StyledDropdownMenuSubContent>
            </DropdownMenuSub>
          )
        }

        // --- Inactive / pinned leaf label -> simple toggleable item ---
        return (
          <StyledDropdownMenuItem
            key={label.id}
            disabled={isPinned}
            onClick={(e) => {
              if (isPinned) return
              e.preventDefault()
              toggleLabel(label.id)
            }}
          >
            <FilterMenuRow
              icon={<LabelIcon label={label} size="sm" />}
              label={label.name}
              accessory={isPinned ? <Check className="h-3 w-3 text-muted-foreground" /> : undefined}
            />
          </StyledDropdownMenuItem>
        )
      })}
    </>
  )
}
