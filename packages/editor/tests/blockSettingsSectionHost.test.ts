// @vitest-environment happy-dom
import "./dom-stubs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick, reactive } from "vue";
import { createTitleBlock } from "@templatical/types";
import type { Block } from "@templatical/types";
import BlockSettingsSectionHost from "../src/components/toolbar/BlockSettingsSectionHost.vue";
import type {
  BlockSettingsContext,
  BlockSettingsSection,
} from "../src/types/block-settings";
import { mountEditor } from "./helpers/mount";

type MountFn = BlockSettingsSection["mount"];

function makeSection(
  overrides: Partial<BlockSettingsSection> = {},
): BlockSettingsSection & { mount: ReturnType<typeof vi.fn> } {
  return {
    id: "repeat",
    title: "Repeat",
    mount: vi.fn(),
    ...overrides,
  } as BlockSettingsSection & { mount: ReturnType<typeof vi.fn> };
}

function mountHost(
  section: BlockSettingsSection,
  block: Block = createTitleBlock(),
  open = true,
) {
  return mountEditor(BlockSettingsSectionHost, {
    props: { section, block, open },
  });
}

function lastContext(section: { mount: ReturnType<typeof vi.fn> }) {
  return section.mount.mock.calls[0][1] as BlockSettingsContext;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("BlockSettingsSectionHost", () => {
  it("mounts once with an element inside the section body and a full context", () => {
    const section = makeSection();
    const wrapper = mountHost(section);

    expect(section.mount).toHaveBeenCalledTimes(1);
    const [el, ctx] = section.mount.mock.calls[0] as [
      HTMLElement,
      BlockSettingsContext,
    ];
    const header = wrapper.get("button");
    expect(el.parentElement?.previousElementSibling).toBe(header.element);
    expect(wrapper.element.contains(el)).toBe(true);
    expect(typeof ctx.update).toBe("function");
    expect(typeof ctx.onChange).toBe("function");
    expect(ctx.block.id).toBe(wrapper.props("block").id);
  });

  it("mounts while collapsed and does not mount again when toggled", async () => {
    const section = makeSection();
    const wrapper = mountHost(section, createTitleBlock(), false);

    expect(section.mount).toHaveBeenCalledTimes(1);
    await wrapper.setProps({ open: true });
    expect(section.mount).toHaveBeenCalledTimes(1);
  });

  it("gives ctx.block as a detached copy of a reactive block", () => {
    const block = reactive(createTitleBlock());
    const section = makeSection();
    mountHost(section, block);
    const ctx = lastContext(section);

    const copy = ctx.block as any;
    expect(copy).toEqual(JSON.parse(JSON.stringify(block)));
    expect(copy).not.toBe(ctx.block);

    const original = block.styles.padding.top;
    copy.styles.padding.top = original + 99;
    copy.type = "mutated";
    expect(block.styles.padding.top).toBe(original);
    expect(block.type).toBe("title");
    expect((ctx.block as any).styles.padding.top).toBe(original);
  });

  it("emits update with the payload from ctx.update", () => {
    const section = makeSection();
    const wrapper = mountHost(section);
    const ctx = lastContext(section);

    ctx.update({ repeat: { over: "items", as: "item" } });
    ctx.update({ repeat: undefined });

    expect(wrapper.emitted("update")).toEqual([
      [{ repeat: { over: "items", as: "item" } }],
      [{ repeat: undefined }],
    ]);
  });

  it("makes ctx.update a no-op after unmount", () => {
    const section = makeSection();
    // A listener prop, not `wrapper.emitted()`: VTU drops its record of a
    // component's events once it unmounts.
    const onUpdate = vi.fn();
    const wrapper = mountEditor(BlockSettingsSectionHost, {
      props: { section, block: createTitleBlock(), open: true, onUpdate },
    });
    const ctx = lastContext(section);

    ctx.update({ repeat: undefined });
    expect(onUpdate).toHaveBeenCalledTimes(1);

    wrapper.unmount();
    ctx.update({ condition: "stale" });

    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("forwards header toggle clicks", async () => {
    const wrapper = mountHost(makeSection());

    await wrapper.get("button").trigger("click");

    expect(wrapper.emitted("toggle")).toHaveLength(1);
  });

  describe("onChange", () => {
    it("fires with a copy when the block is edited in place", async () => {
      const block = reactive(createTitleBlock());
      const section = makeSection();
      mountHost(section, block);
      const cb = vi.fn();
      lastContext(section).onChange(cb);

      Object.assign(block, { repeat: { over: "items", as: "item" } });
      await nextTick();

      expect(cb).toHaveBeenCalledTimes(1);
      const received = cb.mock.calls[0][0];
      expect(received).toEqual(JSON.parse(JSON.stringify(block)));
      expect((received as any).repeat).toEqual({ over: "items", as: "item" });
      expect(received).not.toBe(block);
    });

    it("fires when the block is replaced by a new object with the same id", async () => {
      const block = createTitleBlock();
      const section = makeSection();
      const wrapper = mountHost(section, block);
      const cb = vi.fn();
      lastContext(section).onChange(cb);

      const replacement = { ...block, repeat: { over: "rows", as: "row" } };
      await wrapper.setProps({ block: replacement });

      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb.mock.calls[0][0]).toEqual(replacement);
    });

    it("stops firing after unsubscribe, leaving other subscribers alone", async () => {
      const block = reactive(createTitleBlock());
      const section = makeSection();
      mountHost(section, block);
      const ctx = lastContext(section);
      const first = vi.fn();
      const second = vi.fn();
      const unsubscribe = ctx.onChange(first);
      ctx.onChange(second);

      unsubscribe();
      Object.assign(block, { repeat: { over: "a", as: "b" } });
      await nextTick();

      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledTimes(1);
    });

    it("keeps two subscriptions of the same callback independent", async () => {
      const block = reactive(createTitleBlock());
      const section = makeSection();
      mountHost(section, block);
      const ctx = lastContext(section);
      const cb = vi.fn();
      const unsubscribeFirst = ctx.onChange(cb);
      ctx.onChange(cb);

      unsubscribeFirst();
      Object.assign(block, { repeat: { over: "a", as: "b" } });
      await nextTick();

      expect(cb).toHaveBeenCalledTimes(1);
    });

    it("stops firing after unmount and ignores late subscriptions", async () => {
      const block = reactive(createTitleBlock());
      const section = makeSection();
      const wrapper = mountHost(section, block);
      const ctx = lastContext(section);
      const early = vi.fn();
      ctx.onChange(early);

      wrapper.unmount();
      const late = vi.fn();
      ctx.onChange(late);
      Object.assign(block, { repeat: { over: "a", as: "b" } });
      await nextTick();

      expect(early).not.toHaveBeenCalled();
      expect(late).not.toHaveBeenCalled();
    });

    it("logs a throwing callback with the section id and still calls the others", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const block = reactive(createTitleBlock());
      const section = makeSection({ id: "flaky" });
      mountHost(section, block);
      const ctx = lastContext(section);
      const after = vi.fn();
      ctx.onChange(() => {
        throw new Error("boom");
      });
      ctx.onChange(after);

      Object.assign(block, { repeat: { over: "a", as: "b" } });
      await nextTick();

      expect(after).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledTimes(1);
      expect(String(error.mock.calls[0][1])).toContain("flaky");
    });
  });

  describe("cleanup", () => {
    it("calls the function returned by mount exactly once on unmount", () => {
      const cleanup = vi.fn();
      const section = makeSection({ mount: vi.fn(() => cleanup) as MountFn });
      const wrapper = mountHost(section);

      expect(cleanup).not.toHaveBeenCalled();
      wrapper.unmount();

      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it("does not allow ctx.update from inside cleanup to reach the editor", () => {
      const ran = vi.fn();
      const section = makeSection({
        mount: vi.fn((_el, c) => () => {
          ran();
          c.update({ repeat: undefined });
        }) as MountFn,
      });
      // A listener prop, not `wrapper.emitted()`: VTU drops its record of a
      // component's events once it unmounts, which would make this vacuous.
      const onUpdate = vi.fn();
      const wrapper = mountEditor(BlockSettingsSectionHost, {
        props: { section, block: createTitleBlock(), open: true, onUpdate },
      });

      wrapper.unmount();

      expect(ran).toHaveBeenCalledTimes(1);
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it("logs a throwing cleanup with the section id", () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const section = makeSection({
        id: "bad-cleanup",
        mount: vi.fn(() => () => {
          throw new Error("cleanup failed");
        }) as MountFn,
      });
      const wrapper = mountHost(section);

      wrapper.unmount();

      expect(error).toHaveBeenCalledTimes(1);
      expect(String(error.mock.calls[0][1])).toContain("bad-cleanup");
    });
  });

  describe("failing consumer code", () => {
    it("logs a throwing mount with the section id and still renders the section", () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const section = makeSection({
        id: "broken",
        title: "Broken one",
        mount: vi.fn(() => {
          throw new Error("mount failed");
        }) as MountFn,
      });
      const wrapper = mountHost(section);

      expect(error).toHaveBeenCalledTimes(1);
      expect(String(error.mock.calls[0][1])).toContain("broken");
      expect(wrapper.get("button").text()).toBe("Broken one");
      // Unmounting a section that never produced a cleanup must stay silent.
      wrapper.unmount();
      expect(error).toHaveBeenCalledTimes(1);
    });

    it("hides the summary and logs when summary() throws", () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const section = makeSection({
        id: "bad-summary",
        summary: () => {
          throw new Error("no summary");
        },
      });
      const wrapper = mountHost(section);

      expect(
        wrapper.find('[data-testid="collapsible-section-summary"]').exists(),
      ).toBe(false);
      expect(String(error.mock.calls[0][1])).toContain("bad-summary");
    });
  });

  describe("header", () => {
    it("shows the title and the summary computed from the block", async () => {
      const block = createTitleBlock();
      const summary = vi.fn((b: Block) => `type: ${b.type}`);
      const wrapper = mountHost(makeSection({ summary }), block, false);

      expect(wrapper.get("button").text()).toContain("Repeat");
      expect(
        wrapper.get('[data-testid="collapsible-section-summary"]').text(),
      ).toBe("type: title");
      expect(summary).toHaveBeenCalledWith(block);
    });

    it("shows no summary when summary() returns null", () => {
      const wrapper = mountHost(makeSection({ summary: () => null }));

      expect(
        wrapper.find('[data-testid="collapsible-section-summary"]').exists(),
      ).toBe(false);
    });

    it("tags the header with block-settings-section-<id>", () => {
      const wrapper = mountHost(makeSection({ id: "display-rules" }));

      expect(wrapper.get("button").attributes("data-testid")).toBe(
        "block-settings-section-display-rules",
      );
    });
  });
});
