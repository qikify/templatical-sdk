import type { Block } from "@templatical/types";

/**
 * What a {@link BlockSettingsSection} gets to work with while it is mounted for
 * one block. A fresh context is created every time a section mounts, and all of
 * its subscriptions are released when that section unmounts — see `onChange`.
 */
export interface BlockSettingsContext {
  /**
   * The block this section is mounted for, as it is right now. A getter, so
   * reading it again after an edit — or after Undo/Redo — returns the current
   * state.
   *
   * It is a plain copy, not the editor's reactive object: writing to it does
   * nothing. The only way to change the document from here is {@link update},
   * which keeps every edit on the history stack.
   */
  readonly block: Block;

  /**
   * Merge `updates` into the block, the same way the built-in settings fields
   * do. The change goes through the editor's normal update path, so it is an
   * Undo/Redo step and marks the template dirty.
   *
   * Keys the block type doesn't declare (a consumer's own `condition` or
   * `repeat`) are kept on the block and survive export and save. Remove a key
   * by passing it as `undefined`: `update({ condition: undefined })`.
   */
  update(updates: Partial<Block> & Record<string, unknown>): void;

  /**
   * Subscribe to changes of this block, including those made by Undo/Redo and
   * by other settings fields. `cb` receives the block's new state (a copy, like
   * {@link block}).
   *
   * Returns an unsubscribe function. Subscriptions you don't release yourself
   * are cancelled when the section unmounts.
   */
  onChange(cb: (block: Block) => void): () => void;
}

/**
 * A consumer-owned section in the block settings panel, shown below the
 * built-in sections (Spacing, Background, Display, Display condition). The
 * editor renders the collapsible frame; the consumer fills it with
 * framework-free DOM from `mount`.
 *
 * Registered through `blockSettings` in the editor config.
 */
export interface BlockSettingsSection {
  /**
   * Unique key for the section. Used to remember whether it is open and to name
   * it in warnings. When two sections share an `id`, the first one wins and the
   * later one is skipped with a warning.
   */
  id: string;

  /** Header text of the collapsible section. */
  title: string;

  /**
   * Whether the section applies to a block. Omit it to show the section on
   * every block. Re-evaluated whenever the block changes: once it returns
   * `false` the section unmounts (its cleanup runs), and it mounts again when
   * it returns `true`.
   */
  appliesTo?: (block: Block) => boolean;

  /**
   * Short muted text shown on the header next to the title, also while the
   * section is collapsed — e.g. the active condition or repeat source.
   * Return `null` to show nothing. Re-evaluated whenever the block changes.
   */
  summary?: (block: Block) => string | null;

  /**
   * CSS for the DOM `mount` builds. Settings render inside the editor's shadow
   * root by default, so the host page's styles don't reach them. The string is
   * adopted the same way a custom block's `stylesheet` is — into the shadow
   * root, or the page in light-DOM mode — and is not tied to which block is
   * selected. Whitespace-only values are ignored; identical stylesheets are
   * applied once. Scope your selectors under your own class names.
   */
  stylesheet?: string;

  /**
   * Build the section's body inside `el`. Called each time the section mounts:
   * when a block is selected, when selection moves to another block (the
   * section remounts for the new one), and when `appliesTo` turns true.
   *
   * Return a cleanup function to tear down listeners or framework instances;
   * it runs when the section unmounts. An error thrown from `mount` or the
   * cleanup is logged with the section's `id` and doesn't break the panel or
   * the other sections.
   */
  mount: (el: HTMLElement, ctx: BlockSettingsContext) => void | (() => void);
}
