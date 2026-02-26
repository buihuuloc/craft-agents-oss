import * as React from 'react'
import { CheckCircle, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

interface SettingsConfirmationCardProps {
  settingLabel: string
  oldValue: string
  newValue: string
}

// ============================================================================
// Component
// ============================================================================

/**
 * SettingsConfirmationCard - Read-only success card shown after a safe setting change is applied.
 *
 * Renders inline in the chat message stream with a green success accent.
 * Shows the setting label, old value (strikethrough), and new value (bold).
 */
export function SettingsConfirmationCard({
  settingLabel,
  oldValue,
  newValue,
}: SettingsConfirmationCardProps) {
  return (
    <div
      className={cn(
        'rounded-[8px] overflow-hidden max-w-md w-fit select-none',
        'text-[var(--success-text)] shadow-tinted',
      )}
      style={{
        backgroundColor: 'oklch(from var(--success) l c h / 0.03)',
        '--shadow-color': 'var(--success-rgb)',
      } as React.CSSProperties}
    >
      <div className="px-4 py-3 space-y-2">
        {/* Header */}
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 shrink-0 text-[var(--success)]" />
          <span className="text-sm font-medium leading-5">Setting Updated</span>
        </div>

        {/* Setting change details */}
        <div className="pl-6">
          <div className="text-xs text-[var(--foreground-30)] mb-1">{settingLabel}</div>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="line-through opacity-50">{oldValue}</span>
            <ArrowRight className="h-3 w-3 shrink-0 opacity-50" />
            <span className="font-semibold">{newValue}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Memoized version for performance in chat list
 */
export const MemoizedSettingsConfirmationCard = React.memo(SettingsConfirmationCard)
