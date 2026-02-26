import * as React from 'react'
import { Command as CommandPrimitive } from 'cmdk'
import { Check } from 'lucide-react'
import { Icon_Home, Icon_Folder } from '@craft-agent/ui'

import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { getPathBasename } from '@/lib/platform'
import { FreeFormInputContextBadge } from './FreeFormInputContextBadge'
import { getRecentDirs, addRecentDir, formatPathForDisplay } from './free-form-input-utils'

/**
 * WorkingDirectoryBadge - Context badge for selecting working directory
 * Uses cmdk for filterable folder list when there are more than 5 recent folders.
 */
export function WorkingDirectoryBadge({
  workingDirectory,
  onWorkingDirectoryChange,
  sessionFolderPath,
  isEmptySession = false,
}: {
  workingDirectory?: string
  onWorkingDirectoryChange: (path: string) => void
  sessionFolderPath?: string
  isEmptySession?: boolean
}) {
  const [recentDirs, setRecentDirs] = React.useState<string[]>([])
  const [popoverOpen, setPopoverOpen] = React.useState(false)
  const [homeDir, setHomeDir] = React.useState<string>('')
  const [gitBranch, setGitBranch] = React.useState<string | null>(null)
  const [filter, setFilter] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Load home directory and recent directories on mount
  React.useEffect(() => {
    setRecentDirs(getRecentDirs())
    window.electronAPI?.getHomeDir?.().then((dir: string) => {
      if (dir) setHomeDir(dir)
    })
  }, [])

  // Fetch git branch when working directory changes
  React.useEffect(() => {
    if (workingDirectory) {
      window.electronAPI?.getGitBranch?.(workingDirectory).then((branch: string | null) => {
        setGitBranch(branch)
      })
    } else {
      setGitBranch(null)
    }
  }, [workingDirectory])

  // Reset filter and focus input when popover opens
  React.useEffect(() => {
    if (popoverOpen) {
      setFilter('')
      // Focus input after popover animation completes (only if filter is shown)
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [popoverOpen])

  const handleChooseFolder = async () => {
    if (!window.electronAPI) return
    setPopoverOpen(false)
    const selectedPath = await window.electronAPI.openFolderDialog()
    if (selectedPath) {
      addRecentDir(selectedPath)
      setRecentDirs(getRecentDirs())
      onWorkingDirectoryChange(selectedPath)
    }
  }

  const handleSelectRecent = (path: string) => {
    addRecentDir(path) // Move to top of recent list
    setRecentDirs(getRecentDirs())
    onWorkingDirectoryChange(path)
    setPopoverOpen(false)
  }

  const handleReset = () => {
    if (sessionFolderPath) {
      onWorkingDirectoryChange(sessionFolderPath)
      setPopoverOpen(false)
    }
  }

  // Filter out current directory from recent list and sort alphabetically by folder name
  const filteredRecent = recentDirs
    .filter(p => p !== workingDirectory)
    .sort((a, b) => {
      const nameA = getPathBasename(a).toLowerCase()
      const nameB = getPathBasename(b).toLowerCase()
      return nameA.localeCompare(nameB)
    })
  // Show filter input only when more than 5 recent folders
  const showFilter = filteredRecent.length > 5

  // Determine label - "Work in Folder" if not set or at session root, otherwise folder name
  const hasFolder = !!workingDirectory && workingDirectory !== sessionFolderPath
  const folderName = hasFolder ? (getPathBasename(workingDirectory) || 'Folder') : 'Work in Folder'

  // Show reset option when a folder is selected and it differs from session folder
  const showReset = hasFolder && sessionFolderPath && sessionFolderPath !== workingDirectory

  // Styles matching todo-filter-menu.tsx for consistency
  const MENU_CONTAINER_STYLE = 'min-w-[200px] max-w-[400px] overflow-hidden rounded-[8px] bg-background text-foreground shadow-modal-small p-0'
  const MENU_LIST_STYLE = 'max-h-[200px] overflow-y-auto p-1 [&_[cmdk-list-sizer]]:space-y-px'
  const MENU_ITEM_STYLE = 'flex cursor-pointer select-none items-center gap-2 rounded-[6px] px-3 py-1.5 text-[13px] outline-none'

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <span className="shrink min-w-0 overflow-hidden">
          <FreeFormInputContextBadge
            icon={<Icon_Home className="h-4 w-4" />}
            label={folderName}
            isExpanded={isEmptySession}
            hasSelection={hasFolder}
            showChevron={true}
            isOpen={popoverOpen}
            tooltip={
              hasFolder ? (
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium">Working directory</span>
                  <span className="text-xs opacity-70">{formatPathForDisplay(workingDirectory, homeDir)}</span>
                  {gitBranch && <span className="text-xs opacity-70">on {gitBranch}</span>}
                </span>
              ) : "Choose working directory"
            }
          />
        </span>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" sideOffset={8} className={MENU_CONTAINER_STYLE}>
        <CommandPrimitive shouldFilter={showFilter}>
          {/* Filter input - only shown when more than 5 recent folders */}
          {showFilter && (
            <div className="border-b border-border/50 px-3 py-2">
              <CommandPrimitive.Input
                ref={inputRef}
                value={filter}
                onValueChange={setFilter}
                placeholder="Filter folders..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 placeholder:select-none"
              />
            </div>
          )}

          <CommandPrimitive.List className={MENU_LIST_STYLE}>
            {/* Current Folder Display - shown at top with checkmark */}
            {hasFolder && (
              <CommandPrimitive.Item
                value={`current-${workingDirectory}`}
                className={cn(MENU_ITEM_STYLE, 'pointer-events-none bg-foreground/5')}
                disabled
              >
                <Icon_Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 min-w-0 truncate">
                  <span>{folderName}</span>
                  <span className="text-muted-foreground ml-1.5">{formatPathForDisplay(workingDirectory, homeDir)}</span>
                </span>
                <Check className="h-4 w-4 shrink-0" />
              </CommandPrimitive.Item>
            )}

            {/* Separator after current folder */}
            {hasFolder && filteredRecent.length > 0 && (
              <div className="h-px bg-border my-1 mx-1" />
            )}

            {/* Recent Directories - filterable (current directory already filtered out via filteredRecent) */}
            {filteredRecent.map((path) => {
              const recentFolderName = getPathBasename(path) || 'Folder'
              return (
                <CommandPrimitive.Item
                  key={path}
                  value={`${recentFolderName} ${path}`}
                  onSelect={() => handleSelectRecent(path)}
                  className={cn(MENU_ITEM_STYLE, 'data-[selected=true]:bg-foreground/5')}
                >
                  <Icon_Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 min-w-0 truncate">
                    <span>{recentFolderName}</span>
                    <span className="text-muted-foreground ml-1.5">{formatPathForDisplay(path, homeDir)}</span>
                  </span>
                </CommandPrimitive.Item>
              )
            })}

            {/* Empty state when filtering */}
            {showFilter && (
              <CommandPrimitive.Empty className="py-3 text-center text-sm text-muted-foreground">
                No folders found
              </CommandPrimitive.Empty>
            )}
          </CommandPrimitive.List>

          {/* Bottom actions - always visible, outside scrollable area */}
          <div className="border-t border-border/50 p-1">
            <button
              type="button"
              onClick={handleChooseFolder}
              className={cn(MENU_ITEM_STYLE, 'w-full hover:bg-foreground/5')}
            >
              Choose Folder...
            </button>
            {showReset && (
              <button
                type="button"
                onClick={handleReset}
                className={cn(MENU_ITEM_STYLE, 'w-full hover:bg-foreground/5')}
              >
                Reset
              </button>
            )}
          </div>
        </CommandPrimitive>
      </PopoverContent>
    </Popover>
  )
}
