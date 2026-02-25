/**
 * SkillDetailCard - Compact skill info card for the ContextPanel.
 *
 * Displays skill name, description, source attribution, and tags
 * in a compact card format.
 */

import { useMemo } from 'react'
import { useAtomValue } from 'jotai'
import { Badge } from '@/components/ui/badge'
import { SkillAvatar } from '@/components/ui/skill-avatar'
import { skillsAtom } from '@/atoms/skills'
import { useAppShellContext } from '@/context/AppShellContext'

interface SkillDetailCardProps {
  skillSlug: string
}

/** Human-readable labels for skill sources */
const SOURCE_LABELS: Record<string, string> = {
  global: 'Global',
  workspace: 'Workspace',
  project: 'Project',
}

export function SkillDetailCard({ skillSlug }: SkillDetailCardProps) {
  const skills = useAtomValue(skillsAtom)
  const { activeWorkspaceId } = useAppShellContext()

  // Find skill from atom
  const skill = useMemo(
    () => skills.find((s) => s.slug === skillSlug) ?? null,
    [skills, skillSlug],
  )

  if (!skill) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        Skill not found
      </div>
    )
  }

  const sourceLabel = SOURCE_LABELS[skill.source] ?? skill.source

  return (
    <div className="flex flex-col gap-4">
      {/* Header: Avatar + Name */}
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 shrink-0">
          <SkillAvatar
            skill={skill}
            size="lg"
            workspaceId={activeWorkspaceId ?? undefined}
          />
        </div>
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-base font-semibold truncate">
            {skill.metadata.name}
          </span>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {sourceLabel}
            </Badge>
          </div>
        </div>
      </div>

      {/* Description */}
      {skill.metadata.description && (
        <p className="text-sm text-muted-foreground leading-relaxed">
          {skill.metadata.description}
        </p>
      )}

      {/* Slug */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium">Slug:</span>
        <code className="bg-foreground/5 px-1.5 py-0.5 rounded text-[11px]">
          {skill.slug}
        </code>
      </div>

      {/* Tags / Globs */}
      {skill.metadata.globs && skill.metadata.globs.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            File patterns
          </span>
          <div className="flex flex-wrap gap-1">
            {skill.metadata.globs.map((glob) => (
              <Badge
                key={glob}
                variant="outline"
                className="text-[10px] px-1.5 py-0 font-mono"
              >
                {glob}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Always-allow tools */}
      {skill.metadata.alwaysAllow && skill.metadata.alwaysAllow.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Always allowed tools
          </span>
          <div className="flex flex-wrap gap-1">
            {skill.metadata.alwaysAllow.map((tool) => (
              <Badge
                key={tool}
                variant="outline"
                className="text-[10px] px-1.5 py-0 font-mono"
              >
                {tool}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Required sources */}
      {skill.metadata.requiredSources && skill.metadata.requiredSources.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Required sources
          </span>
          <div className="flex flex-wrap gap-1">
            {skill.metadata.requiredSources.map((src) => (
              <Badge
                key={src}
                variant="secondary"
                className="text-[10px] px-1.5 py-0"
              >
                {src}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
