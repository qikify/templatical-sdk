// @vitest-environment happy-dom
//
// `ctx.update()` from a consumer's block-settings section must land in the
// same undo history as every built-in control. The chain under test is
// section `ctx.update` → `CommonBlockSettings` `update` emit → the handler the
// Toolbar/RightSidebar wire to `editor.updateBlock` → history interceptor →
// `Object.assign` onto the block. Undo/Redo swap the whole content object, so
// the section's `onChange` must also fire for those even though no `update`
// call happened.
import "./dom-stubs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
} from "@templatical/types";
import type { Block } from "@templatical/types";
import {
  useEditor,
  useHistory,
  useHistoryInterceptor,
} from "@templatical/core";
import CommonBlockSettings from "../src/components/toolbar/CommonBlockSettings.vue";
import { BLOCK_SETTINGS_SECTIONS_KEY, TRANSLATIONS_KEY } from "../src/keys";
import en from "../src/i18n/locales/en";
import type {
  BlockSettingsContext,
  BlockSettingsSection,
} from "../src/types/block-settings";
import { mountEditor } from "./helpers/mount";

interface Repeat {
  over: string;
  as: string;
}

type RepeatBlock = Block & { repeat?: Repeat };

function setup() {
  const content = createDefaultTemplateContent();
  const block = createParagraphBlock({ content: "<p>hi</p>" });
  content.blocks = [block];

  const editor = useEditor({ content });
  const history = useHistory({
    content: editor.content,
    setContent: editor.setContent,
  });
  useHistoryInterceptor(editor, history);
  editor.selectBlock(block.id);

  const changes: Array<Repeat | undefined> = [];
  let ctx!: BlockSettingsContext;

  const section: BlockSettingsSection = {
    id: "repeat",
    title: "Repeat",
    mount: (_el, context) => {
      ctx = context;
      context.onChange((next) => {
        changes.push((next as RepeatBlock).repeat);
      });
    },
  };

  // The same wiring Toolbar/RightSidebar use: the panel's `update` emit ends
  // in `editor.updateBlock(block.id, updates)`.
  const Harness = defineComponent({
    setup() {
      return () => {
        const selected = editor.selectedBlock.value;
        if (!selected) return null;

        return h(CommonBlockSettings, {
          block: selected,
          onUpdate: (updates: Partial<Block>) => {
            editor.updateBlock(selected.id, updates);
          },
        });
      };
    },
  });

  const wrapper = mountEditor(Harness, {
    provides: {
      [TRANSLATIONS_KEY]: en,
      [BLOCK_SETTINGS_SECTIONS_KEY]: [section],
    },
  });

  function currentBlock(): RepeatBlock {
    return editor.content.value.blocks[0] as RepeatBlock;
  }

  return { editor, history, wrapper, changes, currentBlock, ctx: () => ctx };
}

describe("block settings sections and undo history", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("records a ctx.update() of an unknown key as a single undo step", async () => {
    const { history, ctx, currentBlock, wrapper } = setup();
    expect(history.canUndo.value).toBe(false);
    expect(currentBlock().repeat).toBeUndefined();

    ctx().update({
      repeat: { over: "order.items", as: "item" },
    } as Partial<Block>);
    await nextTick();

    expect(currentBlock().repeat).toEqual({ over: "order.items", as: "item" });
    expect(history.canUndo.value).toBe(true);

    history.undo();
    await nextTick();

    expect(currentBlock().repeat).toBeUndefined();
    expect("repeat" in currentBlock()).toBe(false);
    expect(history.canUndo.value).toBe(false);
    expect(history.canRedo.value).toBe(true);

    history.redo();
    await nextTick();

    expect(currentBlock().repeat).toEqual({ over: "order.items", as: "item" });

    wrapper.unmount();
    history.destroy();
  });

  it("restores the previous value (not just removes the key) on undo", async () => {
    vi.useFakeTimers();
    const { history, ctx, currentBlock, wrapper } = setup();

    ctx().update({ repeat: { over: "a", as: "x" } } as Partial<Block>);
    await nextTick();
    // Past the same-block debounce window, so the next edit is its own step.
    vi.advanceTimersByTime(400);
    ctx().update({ repeat: { over: "b", as: "y" } } as Partial<Block>);
    await nextTick();

    expect(currentBlock().repeat).toEqual({ over: "b", as: "y" });

    history.undo();
    await nextTick();

    expect(currentBlock().repeat).toEqual({ over: "a", as: "x" });

    wrapper.unmount();
    history.destroy();
  });

  it("removes a key with { key: undefined } and undo brings it back", async () => {
    vi.useFakeTimers();
    const { history, ctx, currentBlock, wrapper } = setup();

    ctx().update({ repeat: { over: "a", as: "x" } } as Partial<Block>);
    await nextTick();
    // Past the same-block debounce window, so the removal is its own step.
    vi.advanceTimersByTime(400);

    ctx().update({ repeat: undefined } as Partial<Block>);
    await nextTick();

    expect(currentBlock().repeat).toBeUndefined();

    history.undo();
    await nextTick();

    expect(currentBlock().repeat).toEqual({ over: "a", as: "x" });

    wrapper.unmount();
    history.destroy();
  });

  it("fires onChange for the update, for Undo and for Redo", async () => {
    const { history, ctx, changes, wrapper } = setup();

    ctx().update({
      repeat: { over: "order.items", as: "item" },
    } as Partial<Block>);
    await nextTick();
    expect(changes).toEqual([{ over: "order.items", as: "item" }]);

    history.undo();
    await nextTick();
    expect(changes).toEqual([{ over: "order.items", as: "item" }, undefined]);

    history.redo();
    await nextTick();
    expect(changes).toEqual([
      { over: "order.items", as: "item" },
      undefined,
      { over: "order.items", as: "item" },
    ]);

    wrapper.unmount();
    history.destroy();
  });

  it("hands the consumer a detached copy: mutating ctx.block leaves the document alone", async () => {
    const { history, ctx, currentBlock, wrapper } = setup();

    const copy = ctx().block as RepeatBlock;
    copy.repeat = { over: "sneaky", as: "x" };
    await nextTick();

    expect(currentBlock().repeat).toBeUndefined();
    expect(history.canUndo.value).toBe(false);

    wrapper.unmount();
    history.destroy();
  });
});
