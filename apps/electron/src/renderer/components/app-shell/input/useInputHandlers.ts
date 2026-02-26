import * as React from 'react'
import { toast } from 'sonner'
import type { RichTextInputHandle } from '@/components/ui/rich-text-input'
import type { SlashCommandId } from '@/components/ui/slash-command-menu'
import type { MentionItem } from '@/components/ui/mention-menu'
import { parseMentions } from '@/lib/mentions'
import { applySmartTypography } from '@/lib/smart-typography'
import { hasOpenOverlay } from '@/lib/overlay-detection'
import { PERMISSION_MODE_ORDER } from '@craft-agent/shared/agent/modes'
import type { PermissionMode } from '@craft-agent/shared/agent/modes'
import type { FileAttachment, LoadedSource, LoadedSkill } from '../../../../shared/types'
import { getRecentDirs, addRecentDir, shuffleArray } from './free-form-input-utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface UseInputHandlersOptions {
  disabled: boolean
  disableSend: boolean
  isProcessing: boolean
  inputValue?: string
  onInputChange?: (value: string) => void
  onSubmit: (message: string, attachments?: FileAttachment[], skillSlugs?: string[]) => void
  onStop?: (silent?: boolean) => void
  richInputRef: React.RefObject<RichTextInputHandle>
  permissionMode: PermissionMode
  onPermissionModeChange?: (mode: PermissionMode) => void
  enabledModes: PermissionMode[]
  ultrathinkEnabled: boolean
  onUltrathinkChange?: (enabled: boolean) => void
  onWorkingDirectoryChange?: (path: string) => void
  sources: LoadedSource[]
  skills: LoadedSkill[]
  optimisticSourceSlugs: string[]
  setOptimisticSourceSlugs: React.Dispatch<React.SetStateAction<string[]>>
  onSourcesChange?: (slugs: string[]) => void
  sessionId?: string
  onSessionStatusChange?: (sessionId: string, statusId: string) => void
  autoCapitalisation: boolean
  sendMessageKey: 'enter' | 'cmd-enter'
  placeholder: string | string[]
  homeDir: string
  // Recent folders state (managed by parent to avoid circular deps)
  recentFolders: string[]
  setRecentFolders: React.Dispatch<React.SetStateAction<string[]>>
  // Inline menu hooks
  inlineSlash: {
    isOpen: boolean
    close: () => void
    handleInputChange: (value: string, cursorPosition: number) => void
    handleSelectCommand: (commandId: SlashCommandId) => string
    handleSelectFolder: (path: string) => string
  }
  inlineMention: {
    isOpen: boolean
    close: () => void
    sections: Array<{ items: unknown[] }>
    isSearching: boolean
    handleInputChange: (value: string, cursorPosition: number) => void
    handleSelect: (item: MentionItem) => { value: string; cursorPosition: number }
  }
  inlineLabel: {
    isOpen: boolean
    close: () => void
    handleInputChange: (value: string, cursorPosition: number) => void
    handleSelect: (labelId: string) => string
  }
}

export interface UseInputHandlersReturn {
  // State
  input: string
  setInput: React.Dispatch<React.SetStateAction<string>>
  attachments: FileAttachment[]
  setAttachments: React.Dispatch<React.SetStateAction<FileAttachment[]>>
  loadingCount: number
  isDraggingOver: boolean
  hasContent: boolean
  shuffledPlaceholder: string | string[]

  // Handlers
  handleSubmit: (e: React.FormEvent) => void
  handleStop: (silent?: boolean) => void
  handleKeyDown: (e: React.KeyboardEvent) => void
  handleInputChange: (value: string) => void
  handleRichInput: (value: string, cursorPosition: number) => void
  handlePaste: (e: React.ClipboardEvent) => Promise<void>
  handleLongTextPaste: (text: string) => void
  handleAttachClick: () => Promise<void>
  handleRemoveAttachment: (index: number) => void
  handleDragEnter: (e: React.DragEvent) => void
  handleDragLeave: (e: React.DragEvent) => void
  handleDragOver: (e: React.DragEvent) => void
  handleDrop: (e: React.DragEvent) => Promise<void>
  handleInlineSlashCommandSelect: (commandId: SlashCommandId) => void
  handleInlineSlashFolderSelect: (path: string) => void
  handleInlineMentionSelect: (item: MentionItem) => void
  handleInlineLabelSelect: (labelId: string) => void
  handleInlineStateSelect: (stateId: string) => void
  handleSlashCommand: (commandId: SlashCommandId) => void
  handleSlashFolderSelect: (path: string) => void
  handleMentionSelect: (item: MentionItem) => void
  handleLabelSelect: (labelId: string) => void

  // Refs
  syncToParent: (value: string) => void
  attachmentsRef: React.RefObject<FileAttachment[]>
  dragCounterRef: React.RefObject<number>
  lastCaretPositionRef: React.MutableRefObject<number | null>
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useInputHandlers(options: UseInputHandlersOptions): UseInputHandlersReturn {
  const {
    disabled,
    disableSend,
    isProcessing,
    inputValue,
    onInputChange,
    onSubmit,
    onStop,
    richInputRef,
    permissionMode,
    onPermissionModeChange,
    enabledModes,
    ultrathinkEnabled,
    onUltrathinkChange,
    onWorkingDirectoryChange,
    sources,
    skills,
    optimisticSourceSlugs,
    setOptimisticSourceSlugs,
    onSourcesChange,
    sessionId,
    onSessionStatusChange,
    autoCapitalisation,
    sendMessageKey,
    placeholder,
    homeDir,
    recentFolders,
    setRecentFolders,
    inlineSlash,
    inlineMention,
    inlineLabel,
  } = options

  // ─── State ──────────────────────────────────────────────────────────────────

  // Shuffle placeholder order once per mount so each session feels fresh
  const shuffledPlaceholder = React.useMemo(
    () => Array.isArray(placeholder) ? shuffleArray(placeholder) : placeholder,
    [] // eslint-disable-line react-hooks/exhaustive-deps -- intentionally shuffle only on mount
  )

  // Performance optimization: Always use internal state for typing to avoid parent re-renders
  const [input, setInput] = React.useState(inputValue ?? '')
  const [attachments, setAttachments] = React.useState<FileAttachment[]>([])
  const [isDraggingOver, setIsDraggingOver] = React.useState(false)
  const [loadingCount, setLoadingCount] = React.useState(0)

  // Refs
  const attachmentsRef = React.useRef<FileAttachment[]>([])
  React.useEffect(() => {
    attachmentsRef.current = attachments
  }, [attachments])

  const dragCounterRef = React.useRef(0)
  const lastCaretPositionRef = React.useRef<number | null>(null)

  // Keep input ref in sync with state for unmount sync
  const inputRef = React.useRef(input)
  inputRef.current = input

  // ─── Parent Sync ────────────────────────────────────────────────────────────

  // Sync from parent when inputValue changes externally (e.g., switching sessions)
  const prevInputValueRef = React.useRef(inputValue)
  React.useEffect(() => {
    if (inputValue !== undefined && inputValue !== prevInputValueRef.current) {
      setInput(inputValue)
      prevInputValueRef.current = inputValue
    }
  }, [inputValue])

  // Debounced sync to parent (saves draft without blocking typing)
  const syncTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)
  const syncToParent = React.useCallback((value: string) => {
    if (!onInputChange) return
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
    syncTimeoutRef.current = setTimeout(() => {
      onInputChange(value)
      prevInputValueRef.current = value
    }, 300) // Debounce 300ms
  }, [onInputChange])

  // Sync immediately on unmount to preserve input across mode switches
  React.useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
      if (onInputChange && inputRef.current !== prevInputValueRef.current) {
        onInputChange(inputRef.current)
      }
    }
  }, [onInputChange])

  // ─── Check Electron API ─────────────────────────────────────────────────────

  const hasElectronAPI = typeof window !== 'undefined' && !!window.electronAPI

  // ─── File Helpers ───────────────────────────────────────────────────────────

  const getNextPastedNumber = (
    prefix: 'image' | 'text' | 'file',
    existingAttachments: FileAttachment[]
  ): number => {
    const pattern = new RegExp(`^pasted-${prefix}-(\\d+)\\.`)
    let maxNum = 0
    for (const att of existingAttachments) {
      const match = att.name.match(pattern)
      if (match) {
        maxNum = Math.max(maxNum, parseInt(match[1], 10))
      }
    }
    return maxNum + 1
  }

  const readFileAsAttachment = async (file: File, overrideName?: string): Promise<FileAttachment | null> => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = async () => {
        const result = reader.result as ArrayBuffer
        const base64 = btoa(
          new Uint8Array(result).reduce((data, byte) => data + String.fromCharCode(byte), '')
        )

        let type: FileAttachment['type'] = 'unknown'
        const fileName = overrideName || file.name
        if (file.type.startsWith('image/')) type = 'image'
        else if (file.type === 'application/pdf') type = 'pdf'
        else if (file.type.includes('text') || fileName.match(/\.(txt|md|json|js|ts|tsx|py|css|html)$/i)) type = 'text'
        else if (file.type.includes('officedocument') || fileName.match(/\.(docx?|xlsx?|pptx?)$/i)) type = 'office'

        const mimeType = file.type || 'application/octet-stream'

        // For text files, decode the ArrayBuffer as UTF-8 text
        let text: string | undefined
        if (type === 'text') {
          text = new TextDecoder('utf-8').decode(new Uint8Array(result))
        }

        let thumbnailBase64: string | undefined
        if (hasElectronAPI) {
          try {
            const thumb = await window.electronAPI.generateThumbnail(base64, mimeType)
            if (thumb) thumbnailBase64 = thumb
          } catch {
            // Thumbnail generation is optional, continue without it
          }
        }

        resolve({
          type,
          path: fileName,
          name: fileName,
          mimeType,
          base64,
          text,
          size: file.size,
          thumbnailBase64,
        })
      }
      reader.onerror = () => resolve(null)
      reader.readAsArrayBuffer(file)
    })
  }

  // ─── File Attachment Handlers ───────────────────────────────────────────────

  const handleAttachClick = async () => {
    if (disabled || !hasElectronAPI) return
    try {
      const paths = await window.electronAPI.openFileDialog()
      for (const path of paths) {
        const attachment = await window.electronAPI.readFileAttachment(path)
        if (attachment) {
          setAttachments(prev => [...prev, attachment])
        }
      }
    } catch (error) {
      console.error('[FreeFormInput] Failed to attach files:', error)
    }
  }

  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  // ─── Drag and Drop ─────────────────────────────────────────────────────────

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingOver(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setIsDraggingOver(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current = 0
    setIsDraggingOver(false)
    if (disabled) return

    const files = Array.from(e.dataTransfer.files)
    setLoadingCount(files.length)

    for (const file of files) {
      const filePath = (file as File & { path?: string }).path
      if (filePath && hasElectronAPI) {
        try {
          const attachment = await window.electronAPI.readFileAttachment(filePath)
          if (attachment) {
            setAttachments(prev => [...prev, attachment])
            setLoadingCount(prev => prev - 1)
            continue
          }
        } catch (error) {
          console.error('[FreeFormInput] Failed to read via IPC:', error)
        }
      }

      try {
        const attachment = await readFileAsAttachment(file)
        if (attachment) {
          setAttachments(prev => [...prev, attachment])
        }
      } catch (error) {
        console.error('[FreeFormInput] Failed to read dropped file:', error)
      }
      setLoadingCount(prev => prev - 1)
    }
  }

  // ─── Paste Handlers ─────────────────────────────────────────────────────────

  const handlePaste = async (e: React.ClipboardEvent) => {
    if (disabled) return

    const clipboardItems = e.clipboardData?.files
    if (!clipboardItems || clipboardItems.length === 0) return

    // We have files to process - prevent default text paste behavior
    e.preventDefault()

    const files = Array.from(clipboardItems)
    setLoadingCount(prev => prev + files.length)

    // Pre-assign sequential names using ref to avoid race conditions
    let nextImageNum = getNextPastedNumber('image', attachmentsRef.current)
    const fileNames: string[] = files.map(file => {
      if (!file.name || file.name === 'image.png' || file.name === 'image.jpg' || file.name === 'blob') {
        const ext = file.type.split('/')[1] || 'png'
        return `pasted-image-${nextImageNum++}.${ext}`
      }
      return file.name
    })

    for (let i = 0; i < files.length; i++) {
      try {
        const attachment = await readFileAsAttachment(files[i], fileNames[i])
        if (attachment) {
          setAttachments(prev => [...prev, attachment])
        }
      } catch (error) {
        console.error('[FreeFormInput] Failed to read pasted file:', error)
      }
      setLoadingCount(prev => prev - 1)
    }
  }

  const handleLongTextPaste = React.useCallback((text: string) => {
    const nextNum = getNextPastedNumber('text', attachmentsRef.current)
    const fileName = `pasted-text-${nextNum}.txt`
    const attachment: FileAttachment = {
      type: 'text',
      path: fileName,
      name: fileName,
      mimeType: 'text/plain',
      text: text,
      size: new Blob([text]).size,
    }
    setAttachments(prev => [...prev, attachment])
    // Focus input after adding attachment
    richInputRef.current?.focus()
  }, []) // No deps needed - uses ref

  // ─── Submit / Stop ──────────────────────────────────────────────────────────

  const submitMessage = React.useCallback(() => {
    const hasContent = input.trim() || attachments.length > 0
    if (!hasContent || disabled) return false

    // Tutorial may disable sending to guide user through specific steps
    if (disableSend) return false

    // Parse all @mentions (skills, sources, folders)
    const skillSlugs = skills.map(s => s.slug)
    const sourceSlugs = sources.map(s => s.config.slug)
    const mentions = parseMentions(input, skillSlugs, sourceSlugs)

    // Enable any mentioned sources that aren't already enabled
    if (mentions.sources.length > 0 && onSourcesChange) {
      const newSlugs = [...new Set([...optimisticSourceSlugs, ...mentions.sources])]
      if (newSlugs.length > optimisticSourceSlugs.length) {
        setOptimisticSourceSlugs(newSlugs)
        onSourcesChange(newSlugs)
      }
    }

    onSubmit(
      input.trim(),
      attachments.length > 0 ? attachments : undefined,
      mentions.skills.length > 0 ? mentions.skills : undefined
    )
    setInput('')
    setAttachments([])
    // Clear draft immediately (cancel any pending debounced sync)
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
    onInputChange?.('')
    prevInputValueRef.current = ''

    // Restore focus after state updates
    requestAnimationFrame(() => {
      richInputRef.current?.focus()
    })

    return true
  }, [input, attachments, disabled, disableSend, onInputChange, onSubmit, skills, sources, optimisticSourceSlugs, onSourcesChange, onWorkingDirectoryChange, homeDir])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    submitMessage()
  }

  const handleStop = (silent = false) => {
    onStop?.(silent)
  }

  // ─── Keyboard Handler ───────────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Shift+Tab cycles through enabled permission modes
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault()
      e.stopPropagation()
      const modes = enabledModes.length >= 2 ? enabledModes : PERMISSION_MODE_ORDER
      const currentIndex = modes.indexOf(permissionMode)
      const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % modes.length
      const nextMode = modes[nextIndex]
      onPermissionModeChange?.(nextMode)
      return
    }

    // Don't submit when mention menu is open AND has visible content
    if (inlineMention.isOpen) {
      const hasVisibleContent = inlineMention.sections.some(s => s.items.length > 0) || inlineMention.isSearching
      if (hasVisibleContent && (e.key === 'Enter' || e.key === 'Tab' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        inlineMention.close()
        return
      }
    }

    // Don't submit when slash command menu is open
    if (inlineSlash.isOpen) {
      if (e.key === 'Enter' || e.key === 'Tab' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        inlineSlash.close()
        return
      }
    }

    // Don't submit when label menu is open
    if (inlineLabel.isOpen) {
      if (e.key === 'Enter' || e.key === 'Tab' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        inlineLabel.close()
        return
      }
    }

    // Handle send key based on user preference
    if (sendMessageKey === 'enter') {
      if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.nativeEvent.isComposing) {
        e.preventDefault()
        submitMessage()
      }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
        e.preventDefault()
        submitMessage()
      }
    } else {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
        e.preventDefault()
        submitMessage()
      }
    }
    if (e.key === 'Escape') {
      if (!hasOpenOverlay()) {
        richInputRef.current?.blur()
      }
    }
  }

  // ─── Input Change Handlers ──────────────────────────────────────────────────

  const handleInputChange = React.useCallback((value: string) => {
    const prevValue = inputRef.current
    setInput(value)
    syncToParent(value)

    // Sync source selection when mentions are removed from input
    if (onSourcesChange) {
      const sourceSlugs = sources.map(s => s.config.slug)
      const prevMentions = parseMentions(prevValue, [], sourceSlugs)
      const currMentions = parseMentions(value, [], sourceSlugs)

      const removedSources = prevMentions.sources.filter(slug => !currMentions.sources.includes(slug))
      if (removedSources.length > 0) {
        const newSlugs = optimisticSourceSlugs.filter(slug => !removedSources.includes(slug))
        setOptimisticSourceSlugs(newSlugs)
        onSourcesChange(newSlugs)
      }
    }
  }, [syncToParent, sources, optimisticSourceSlugs, onSourcesChange])

  const handleRichInput = React.useCallback((value: string, cursorPosition: number) => {
    // Update inline slash command state
    inlineSlash.handleInputChange(value, cursorPosition)
    inlineMention.handleInputChange(value, cursorPosition)
    inlineLabel.handleInputChange(value, cursorPosition)

    // Auto-capitalize first letter
    let newValue = value
    if (autoCapitalisation && value.length > 0 && value.charAt(0) !== '/' && value.charAt(0) !== '@' && value.charAt(0) !== '#') {
      const capitalizedFirst = value.charAt(0).toUpperCase()
      if (capitalizedFirst !== value.charAt(0)) {
        newValue = capitalizedFirst + value.slice(1)
        richInputRef.current?.setSelectionRange(cursorPosition, cursorPosition)
        setInput(newValue)
        syncToParent(newValue)
        return
      }
    }

    // Apply smart typography (-> to arrow, etc.)
    const typography = applySmartTypography(value, cursorPosition)
    if (typography.replaced) {
      newValue = typography.text
      richInputRef.current?.setSelectionRange(typography.cursor, typography.cursor)
      setInput(newValue)
      syncToParent(newValue)
    }
  }, [inlineSlash, inlineMention, inlineLabel, syncToParent, autoCapitalisation])

  // ─── Inline Menu Handlers ──────────────────────────────────────────────────

  const handleSlashCommand = React.useCallback((commandId: SlashCommandId) => {
    if (commandId === 'safe') onPermissionModeChange?.('safe')
    else if (commandId === 'ask') onPermissionModeChange?.('ask')
    else if (commandId === 'allow-all') onPermissionModeChange?.('allow-all')
    else if (commandId === 'ultrathink') onUltrathinkChange?.(!ultrathinkEnabled)
  }, [permissionMode, ultrathinkEnabled, onPermissionModeChange, onUltrathinkChange])

  const handleSlashFolderSelect = React.useCallback((path: string) => {
    if (onWorkingDirectoryChange) {
      addRecentDir(path)
      setRecentFolders(getRecentDirs())
      onWorkingDirectoryChange(path)
    }
  }, [onWorkingDirectoryChange])

  const handleMentionSelect = React.useCallback((item: MentionItem) => {
    if (item.type === 'source' && item.source && onSourcesChange) {
      const slug = item.source.config.slug
      if (!optimisticSourceSlugs.includes(slug)) {
        const newSlugs = [...optimisticSourceSlugs, slug]
        setOptimisticSourceSlugs(newSlugs)
        onSourcesChange(newSlugs)
      }
    }
  }, [optimisticSourceSlugs, onSourcesChange])

  const handleLabelSelect = React.useCallback((labelId: string) => {
    // This is passed to useInlineLabelMenu's onSelect
    // The actual onLabelAdd is called elsewhere; this is the inline menu handler
  }, [])

  const handleInlineSlashCommandSelect = React.useCallback((commandId: SlashCommandId) => {
    const newValue = inlineSlash.handleSelectCommand(commandId)
    setInput(newValue)
    syncToParent(newValue)
    richInputRef.current?.focus()
  }, [inlineSlash, syncToParent])

  const handleInlineSlashFolderSelect = React.useCallback((path: string) => {
    const newValue = inlineSlash.handleSelectFolder(path)
    setInput(newValue)
    syncToParent(newValue)
    richInputRef.current?.focus()
  }, [inlineSlash, syncToParent])

  const handleInlineMentionSelect = React.useCallback((item: MentionItem) => {
    const { value: newValue, cursorPosition } = inlineMention.handleSelect(item)
    setInput(newValue)
    syncToParent(newValue)
    setTimeout(() => {
      richInputRef.current?.focus()
      richInputRef.current?.setSelectionRange(cursorPosition, cursorPosition)
    }, 0)
  }, [inlineMention, syncToParent])

  const handleInlineLabelSelect = React.useCallback((labelId: string) => {
    const newValue = inlineLabel.handleSelect(labelId)
    setInput(newValue)
    syncToParent(newValue)
    richInputRef.current?.focus()
  }, [inlineLabel, syncToParent])

  const handleInlineStateSelect = React.useCallback((stateId: string) => {
    const newValue = inlineLabel.handleSelect('')
    setInput(newValue)
    syncToParent(newValue)
    if (sessionId) {
      onSessionStatusChange?.(sessionId, stateId)
    }
    richInputRef.current?.focus()
  }, [inlineLabel, syncToParent, sessionId, onSessionStatusChange])

  // ─── Paste Files Event Listener ─────────────────────────────────────────────

  React.useEffect(() => {
    const handlePasteFiles = async (e: CustomEvent<{ files: File[] }>) => {
      if (disabled) return

      const { files } = e.detail
      if (!files || files.length === 0) return

      setLoadingCount(prev => prev + files.length)

      let nextImageNum = getNextPastedNumber('image', attachmentsRef.current)
      const fileNames: string[] = files.map(file => {
        if (!file.name || file.name === 'image.png' || file.name === 'image.jpg' || file.name === 'blob') {
          const ext = file.type.split('/')[1] || 'png'
          return `pasted-image-${nextImageNum++}.${ext}`
        }
        return file.name
      })

      for (let i = 0; i < files.length; i++) {
        try {
          const attachment = await readFileAsAttachment(files[i], fileNames[i])
          if (attachment) {
            setAttachments(prev => [...prev, attachment])
          }
        } catch (error) {
          console.error('[FreeFormInput] Failed to process pasted file:', error)
        }
        setLoadingCount(prev => prev - 1)
      }

      richInputRef.current?.focus()
    }

    window.addEventListener('craft:paste-files', handlePasteFiles as unknown as EventListener)
    return () => window.removeEventListener('craft:paste-files', handlePasteFiles as unknown as EventListener)
  }, [disabled, richInputRef])

  // ─── Insert Text Event Listener ─────────────────────────────────────────────

  React.useEffect(() => {
    const handleInsertText = (e: CustomEvent<{ text: string }>) => {
      const { text } = e.detail
      setInput(text)
      syncToParent(text)
      setTimeout(() => {
        richInputRef.current?.focus()
        richInputRef.current?.setSelectionRange(text.length, text.length)
      }, 0)
    }

    window.addEventListener('craft:insert-text', handleInsertText as EventListener)
    return () => window.removeEventListener('craft:insert-text', handleInsertText as EventListener)
  }, [syncToParent, richInputRef])

  // ─── Focus Input Event Listener ─────────────────────────────────────────────

  React.useEffect(() => {
    const handleFocusInput = () => {
      richInputRef.current?.focus()
      if (lastCaretPositionRef.current !== null) {
        richInputRef.current?.setSelectionRange(
          lastCaretPositionRef.current,
          lastCaretPositionRef.current
        )
        lastCaretPositionRef.current = null
      }
    }

    window.addEventListener('craft:focus-input', handleFocusInput)
    return () => window.removeEventListener('craft:focus-input', handleFocusInput)
  }, [richInputRef])

  // ─── Approve Plan Event Listeners ───────────────────────────────────────────

  React.useEffect(() => {
    const handleApprovePlan = (e: CustomEvent<{ text?: string; sessionId?: string }>) => {
      if (e.detail?.sessionId && e.detail.sessionId !== sessionId) {
        return
      }
      const text = e.detail?.text
      if (!text) {
        toast.error('No details provided')
        return
      }
      if (permissionMode === 'safe') {
        onPermissionModeChange?.('allow-all')
      }
      onSubmit(text, undefined)
    }

    window.addEventListener('craft:approve-plan', handleApprovePlan as EventListener)
    return () => window.removeEventListener('craft:approve-plan', handleApprovePlan as EventListener)
  }, [sessionId, permissionMode, onPermissionModeChange, onSubmit])

  React.useEffect(() => {
    const handleApprovePlanWithCompact = async (e: CustomEvent<{ sessionId?: string; planPath?: string }>) => {
      if (e.detail?.sessionId && e.detail.sessionId !== sessionId) {
        return
      }

      const planPath = e.detail?.planPath

      if (permissionMode === 'safe') {
        onPermissionModeChange?.('allow-all')
      }

      if (planPath && sessionId) {
        await window.electronAPI.sessionCommand(sessionId, {
          type: 'setPendingPlanExecution',
          planPath,
        })
      }

      onSubmit('/compact', undefined)

      const handleCompactionComplete = async (compactEvent: CustomEvent<{ sessionId?: string }>) => {
        if (compactEvent.detail?.sessionId !== sessionId) {
          return
        }

        window.removeEventListener('craft:compaction-complete', handleCompactionComplete as unknown as EventListener)

        if (planPath) {
          onSubmit(`Read the plan at ${planPath} and execute it.`, undefined)
        } else {
          onSubmit('Plan approved, please execute.', undefined)
        }

        if (sessionId) {
          await window.electronAPI.sessionCommand(sessionId, {
            type: 'clearPendingPlanExecution',
          })
        }
      }

      window.addEventListener('craft:compaction-complete', handleCompactionComplete as unknown as EventListener)
    }

    window.addEventListener('craft:approve-plan-with-compact', handleApprovePlanWithCompact as unknown as EventListener)
    return () => window.removeEventListener('craft:approve-plan-with-compact', handleApprovePlanWithCompact as unknown as EventListener)
  }, [sessionId, permissionMode, onPermissionModeChange, onSubmit])

  // ─── Reload Recovery ────────────────────────────────────────────────────────

  React.useEffect(() => {
    if (!sessionId) return

    let hasExecuted = false

    const executePendingPlan = async () => {
      if (hasExecuted) return

      const pending = await window.electronAPI.getPendingPlanExecution(sessionId)
      if (!pending || pending.awaitingCompaction) return

      hasExecuted = true
      onSubmit(`Read the plan at ${pending.planPath} and execute it.`, undefined)

      await window.electronAPI.sessionCommand(sessionId, {
        type: 'clearPendingPlanExecution',
      })
    }

    executePendingPlan()

    const handleCompactionComplete = async (e: CustomEvent<{ sessionId: string }>) => {
      if (e.detail?.sessionId !== sessionId) return
      await new Promise(resolve => setTimeout(resolve, 100))
      executePendingPlan()
    }

    window.addEventListener('craft:compaction-complete', handleCompactionComplete as unknown as EventListener)
    return () => {
      window.removeEventListener('craft:compaction-complete', handleCompactionComplete as unknown as EventListener)
    }
  }, [sessionId, onSubmit])

  // ─── Return ─────────────────────────────────────────────────────────────────

  const hasContent = !!(input.trim() || attachments.length > 0)

  return {
    input,
    setInput,
    attachments,
    setAttachments,
    loadingCount,
    isDraggingOver,
    hasContent,
    shuffledPlaceholder,

    handleSubmit,
    handleStop,
    handleKeyDown,
    handleInputChange,
    handleRichInput,
    handlePaste,
    handleLongTextPaste,
    handleAttachClick,
    handleRemoveAttachment,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleInlineSlashCommandSelect,
    handleInlineSlashFolderSelect,
    handleInlineMentionSelect,
    handleInlineLabelSelect,
    handleInlineStateSelect,
    handleSlashCommand,
    handleSlashFolderSelect,
    handleMentionSelect,
    handleLabelSelect,

    syncToParent,
    attachmentsRef,
    dragCounterRef,
    lastCaretPositionRef,
  }
}
