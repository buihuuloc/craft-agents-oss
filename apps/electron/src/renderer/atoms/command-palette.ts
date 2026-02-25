import { atom } from 'jotai'

/**
 * Whether the command palette modal is open.
 * Toggled via Cmd+K shortcut or programmatic open.
 */
export const commandPaletteOpenAtom = atom(false)
