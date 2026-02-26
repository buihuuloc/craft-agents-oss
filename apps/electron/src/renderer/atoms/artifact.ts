import { atom } from 'jotai'
import type { ArtifactType } from '../types/artifact'

/**
 * Currently active artifact displayed in the contextual right panel.
 * Set to null when the panel is closed / no artifact is selected.
 */
export const activeArtifactAtom = atom<ArtifactType | null>(null)
