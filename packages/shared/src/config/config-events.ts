/**
 * Typed event definitions for config file changes.
 *
 * The ConfigWatcher emits these events when files change.
 * Domain modules can subscribe to relevant events without
 * the watcher needing to know about domain-specific logic.
 */

/** All config change event types */
export type ConfigEventType =
  | 'config:changed'
  | 'preferences:changed'
  | 'llm-connections:changed'
  | 'source:changed'
  | 'source:guide-changed'
  | 'sources-list:changed'
  | 'skill:changed'
  | 'skills-list:changed'
  | 'workspace-permissions:changed'
  | 'source-permissions:changed'
  | 'default-permissions:changed'
  | 'status-config:changed'
  | 'status-icon:changed'
  | 'label-config:changed'
  | 'hooks-config:changed'
  | 'session-metadata:changed'
  | 'app-theme:changed'
  | 'preset-theme:changed'
  | 'preset-themes-list:changed'
  | 'validation-error'
  | 'error';

/** Simple typed event emitter for config changes */
export class ConfigEventBus {
  private listeners = new Map<string, Set<(...args: any[]) => void>>();

  on(event: ConfigEventType, listener: (...args: any[]) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(listener);
    };
  }

  emit(event: ConfigEventType, ...args: any[]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(...args);
        } catch (error) {
          console.error(`[ConfigEventBus] Error in ${event} handler:`, error);
        }
      }
    }
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}
