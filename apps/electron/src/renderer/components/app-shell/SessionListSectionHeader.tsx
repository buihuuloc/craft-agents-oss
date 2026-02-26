/**
 * SessionListSectionHeader - Section header for date groups and search result sections.
 * No sticky behavior - just scrolls with the list.
 */
export function SessionListSectionHeader({ label }: { label: string }) {
  return (
    <div className="px-4 py-2">
      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
    </div>
  )
}
