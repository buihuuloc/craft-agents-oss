import * as React from "react"
import { useCallback, useMemo } from "react"
import type { ActivityItem } from "@craft-agent/ui"
import { MemoizedSettingsConfirmationCard } from "@/components/chat/SettingsConfirmationCard"
import { MemoizedSettingsPreviewCard } from "@/components/chat/SettingsPreviewCard"
import { executeSettingsTool } from "@/lib/settings-tool"
import { settingsRegistry } from "@/lib/settings-intent"
import type { ParsedSettingsResult } from "./chat-display-types"
import { parseSettingsResult } from "./chat-display-utils"

/**
 * Renders a single settings preview card with confirm/cancel state management.
 * Used for risky settings that require explicit user confirmation.
 */
function SettingsPreviewCardWithState({
  settingLabel,
  description,
  currentValue,
  newValue,
  settingKey,
}: {
  settingLabel: string
  description: string
  currentValue: string
  newValue: string
  settingKey: string
}) {
  const [status, setStatus] = React.useState<'pending' | 'confirmed' | 'cancelled'>('pending')

  const handleConfirm = useCallback(async () => {
    try {
      // Find the setting in the registry and apply it
      const setting = settingsRegistry.find(s => s.key === settingKey)
      if (setting) {
        await setting.setValue(newValue)
      } else {
        // Fallback: use executeSettingsTool
        await executeSettingsTool({ action: 'set', key: settingKey, value: newValue })
      }
      setStatus('confirmed')
    } catch (err) {
      console.error('Failed to apply setting:', err)
      // Stay pending so user can retry
    }
  }, [settingKey, newValue])

  const handleCancel = useCallback(() => {
    setStatus('cancelled')
  }, [])

  return (
    <MemoizedSettingsPreviewCard
      settingLabel={settingLabel}
      description={description}
      currentValue={currentValue}
      newValue={newValue}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      status={status}
    />
  )
}

/**
 * Extracts settings tool activities from a turn and renders inline cards.
 * - Applied (safe) settings → SettingsConfirmationCard
 * - Risky settings → SettingsPreviewCard with confirm/cancel state
 */
export function SettingsActivityCards({ activities }: { activities: ActivityItem[] }) {
  const settingsCards = useMemo(() => {
    const cards: Array<{ id: string; type: 'confirmation' | 'preview'; result: ParsedSettingsResult }> = []
    for (const activity of activities) {
      const result = parseSettingsResult(activity)
      if (!result) continue
      if (result.data?.applied) {
        cards.push({ id: activity.id, type: 'confirmation', result })
      } else if (result.requiresConfirmation) {
        cards.push({ id: activity.id, type: 'preview', result })
      }
    }
    return cards
  }, [activities])

  if (settingsCards.length === 0) return null

  return (
    <div className="mt-2 space-y-2">
      {settingsCards.map((card) => {
        if (card.type === 'confirmation') {
          const data = card.result.data!
          // Look up label from registry (safe settings don't include setting metadata in result)
          const registryEntry = data.key ? settingsRegistry.find(s => s.key === data.key) : undefined
          return (
            <MemoizedSettingsConfirmationCard
              key={card.id}
              settingLabel={registryEntry?.label || data.key || 'Setting'}
              oldValue={String(data.oldValue ?? '')}
              newValue={String(data.newValue ?? '')}
            />
          )
        }
        // Preview card (risky setting)
        const { setting, currentValue, newValue } = card.result
        return (
          <SettingsPreviewCardWithState
            key={card.id}
            settingLabel={setting?.label || 'Setting'}
            description={setting?.description || ''}
            currentValue={String(currentValue ?? '')}
            newValue={String(newValue ?? '')}
            settingKey={setting?.key || ''}
          />
        )
      })}
    </div>
  )
}
