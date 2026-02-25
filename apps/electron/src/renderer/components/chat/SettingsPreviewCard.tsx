import * as React from 'react'
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

interface SettingsPreviewCardProps {
  settingLabel: string
  description: string
  currentValue: string
  newValue: string
  onConfirm: () => void
  onCancel: () => void
  status: 'pending' | 'confirmed' | 'cancelled'
}

// ============================================================================
// Component
// ============================================================================

/**
 * SettingsPreviewCard - Confirmation card for risky setting changes.
 *
 * Renders inline in the chat message stream with an amber/info accent.
 * Shows a diff-style comparison of current vs new value, with confirm/cancel
 * buttons when pending, and a status indicator after action.
 */
export function SettingsPreviewCard({
  settingLabel,
  description,
  currentValue,
  newValue,
  onConfirm,
  onCancel,
  status,
}: SettingsPreviewCardProps) {
  const isPending = status === 'pending'
  const isConfirmed = status === 'confirmed'

  return (
    <div
      className={cn(
        'rounded-[8px] overflow-hidden max-w-md w-fit select-none',
        isConfirmed
          ? 'text-[var(--success-text)] shadow-tinted'
          : 'text-[var(--info-text)] shadow-tinted',
      )}
      style={{
        backgroundColor: isConfirmed
          ? 'oklch(from var(--success) l c h / 0.03)'
          : 'oklch(from var(--info) l c h / 0.03)',
        '--shadow-color': isConfirmed ? 'var(--success-rgb)' : 'var(--info-rgb)',
      } as React.CSSProperties}
    >
      <div className="px-4 py-3 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          {isConfirmed ? (
            <CheckCircle className="h-4 w-4 shrink-0 text-[var(--success)]" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--info)]" />
          )}
          <span className="text-sm font-medium leading-5">
            {isConfirmed ? 'Setting Updated' : 'Confirm Change'}
          </span>
        </div>

        {/* Setting info */}
        <div className="pl-6 space-y-1">
          <div className="text-sm font-medium text-foreground">{settingLabel}</div>
          <div className="text-xs text-[var(--foreground-40)]">{description}</div>
        </div>

        {/* Diff box */}
        <div className="ml-6 rounded-md border border-foreground/8 bg-foreground/3 overflow-hidden">
          <div className="flex items-center gap-3 px-3 py-2 border-b border-foreground/5">
            <span className="text-[11px] font-medium text-[var(--foreground-40)] w-12 shrink-0">
              Current
            </span>
            <span className="text-xs text-foreground">{currentValue}</span>
          </div>
          <div className="flex items-center gap-3 px-3 py-2">
            <span className="text-[11px] font-medium text-[var(--foreground-40)] w-12 shrink-0">
              New
            </span>
            <span className="text-xs font-semibold text-foreground">{newValue}</span>
          </div>
        </div>

        {/* Actions / Status */}
        {isPending ? (
          <div className="flex items-center gap-2 pl-6">
            <Button
              size="sm"
              variant="default"
              className="h-7 gap-1.5"
              onClick={onConfirm}
            >
              Confirm
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={onCancel}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 pl-6">
            {isConfirmed ? (
              <>
                <CheckCircle className="h-3.5 w-3.5 text-[var(--success)]" />
                <span className="text-xs font-medium">Applied</span>
              </>
            ) : (
              <>
                <XCircle className="h-3.5 w-3.5 opacity-60" />
                <span className="text-xs font-medium opacity-60">Cancelled</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Memoized version for performance in chat list
 */
export const MemoizedSettingsPreviewCard = React.memo(SettingsPreviewCard, (prev, next) => {
  return (
    prev.settingLabel === next.settingLabel &&
    prev.currentValue === next.currentValue &&
    prev.newValue === next.newValue &&
    prev.status === next.status
  )
})
