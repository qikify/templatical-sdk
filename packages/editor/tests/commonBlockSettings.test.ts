// @vitest-environment happy-dom
import "./dom-stubs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";
import { createTitleBlock } from "@templatical/types";
import type { DisplayCondition } from "@templatical/types";
import CommonBlockSettings from "../src/components/toolbar/CommonBlockSettings.vue";
import type {
  BlockSettingsContext,
  BlockSettingsSection,
} from "../src/types/block-settings";
import {
  ALLOW_CUSTOM_CONDITIONS_KEY,
  BLOCK_SETTINGS_SECTIONS_KEY,
  DISPLAY_CONDITIONS_KEY,
  TRANSLATIONS_KEY,
} from "../src/keys";
import en from "../src/i18n/locales/en";
import { mountEditor } from "./helpers/mount";

const pickerStubs = {
  ColorPicker: {
    name: "ColorPicker",
    props: ["modelValue"],
    emits: ["update:modelValue"],
    template:
      "<button data-testid=\"bg\" @click=\"$emit('update:modelValue', '#111111')\" />",
  },
  SpacingControl: {
    name: "SpacingControl",
    props: ["modelValue", "label"],
    emits: ["update:modelValue"],
    template:
      '<button data-testid="pad" @click="$emit(\'update:modelValue\', { top: 12, right: 12, bottom: 12, left: 12 })" />',
  },
};

function mountSettings(
  block: ReturnType<typeof createTitleBlock>,
  extra: {
    isFirstSection?: boolean;
    provides?: Record<symbol, unknown>;
  } = {},
) {
  return mountEditor(CommonBlockSettings, {
    props: { block, isFirstSection: extra.isFirstSection },
    provides: {
      [TRANSLATIONS_KEY]: en,
      ...(extra.provides ?? {}),
    },
    global: { stubs: pickerStubs },
  });
}

function openSection(wrapper: ReturnType<typeof mountEditor>, title: string) {
  const header = wrapper
    .findAll("button")
    .find((b) => b.text().includes(title));
  if (!header) {
    throw new Error(`section "${title}" not found`);
  }
  return header.trigger("click");
}

describe("CommonBlockSettings", () => {
  it("hides the display-condition section when none are configured", () => {
    const wrapper = mountSettings(createTitleBlock());
    expect(
      wrapper.find('[data-testid="display-condition-section"]').exists(),
    ).toBe(false);
  });

  it("skips the top rule on the first section", () => {
    const first = mountSettings(createTitleBlock(), { isFirstSection: true });
    expect(first.classes()).not.toContain("tpl:mt-4");

    const later = mountSettings(createTitleBlock());
    expect(later.classes()).toContain("tpl:mt-4");
  });

  it("writes padding through styles without dropping the rest", async () => {
    const block = createTitleBlock({
      styles: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    });
    const wrapper = mountSettings(block);

    await openSection(wrapper, "Spacing");
    await wrapper.get('[data-testid="pad"]').trigger("click");

    expect(wrapper.emitted("update")?.[0]?.[0]).toEqual({
      styles: {
        ...block.styles,
        padding: { top: 12, right: 12, bottom: 12, left: 12 },
      },
    });
  });

  it("writes background color through styles", async () => {
    const block = createTitleBlock();
    const wrapper = mountSettings(block);

    await openSection(wrapper, "Background");
    await wrapper.get('[data-testid="bg"]').trigger("click");

    expect(wrapper.emitted("update")?.[0]?.[0]).toEqual({
      styles: { ...block.styles, backgroundColor: "#111111" },
    });
  });

  it("toggles visibility independently and treats unset as shown", async () => {
    const block = createTitleBlock();
    const wrapper = mountSettings(block);

    await openSection(wrapper, "Display");
    const switches = wrapper.findAll('[role="switch"]');
    expect(switches).toHaveLength(2);
    expect(switches[0].attributes("aria-checked")).toBe("true");
    expect(switches[1].attributes("aria-checked")).toBe("true");

    await switches[0].trigger("click");
    expect(wrapper.emitted("update")?.[0]?.[0]).toEqual({
      visibility: { desktop: false, mobile: true },
    });
  });

  it("applies, groups, and clears configured display conditions", async () => {
    const vip: DisplayCondition = {
      label: "VIP",
      before: "{% if vip %}",
      after: "{% endif %}",
      group: "Audience",
      description: "Paying customers",
    };
    const trial: DisplayCondition = {
      label: "Trial",
      before: "{% if trial %}",
      after: "{% endif %}",
    };
    const block = createTitleBlock();
    const wrapper = mountSettings(block, {
      provides: {
        [DISPLAY_CONDITIONS_KEY]: [vip, trial],
      },
    });

    await openSection(wrapper, "Display Condition");
    const select = wrapper.get('[data-testid="display-condition-select"]');
    expect(wrapper.find("optgroup").attributes("label")).toBe("Audience");

    await select.setValue("VIP");
    expect(wrapper.emitted("update")?.[0]?.[0]).toEqual({
      displayCondition: vip,
    });

    await wrapper.setProps({
      block: { ...block, displayCondition: vip },
    });
    await nextTick();
    expect(wrapper.text()).toContain("Paying customers");
    expect(wrapper.text()).toContain("{% if vip %}");

    await select.setValue("");
    expect(wrapper.emitted("update")?.[1]?.[0]).toEqual({
      displayCondition: undefined,
    });
  });

  it("applies a custom condition and refuses a blank opening tag", async () => {
    const block = createTitleBlock();
    const wrapper = mountSettings(block, {
      provides: {
        [ALLOW_CUSTOM_CONDITIONS_KEY]: true,
      },
    });

    await openSection(wrapper, "Display Condition");
    const select = wrapper.get('[data-testid="display-condition-select"]');
    await select.setValue("__custom__");
    await nextTick();

    const apply = wrapper.findAll("button").find((b) => b.text() === "Apply")!;
    expect((apply.element as HTMLButtonElement).disabled).toBe(true);

    const areas = wrapper.findAll("textarea");
    await areas[0].setValue("   ");
    await apply.trigger("click");
    expect(wrapper.emitted("update")).toBeUndefined();

    await areas[0].setValue("{% if plan == 'pro' %}");
    await areas[1].setValue("{% endif %}");
    await apply.trigger("click");

    expect(wrapper.emitted("update")?.[0]?.[0]).toEqual({
      displayCondition: {
        label: "Custom condition",
        before: "{% if plan == 'pro' %}",
        after: "{% endif %}",
      },
    });
  });
});

describe("CommonBlockSettings custom sections", () => {
  type TestSection = BlockSettingsSection & {
    mount: ReturnType<typeof vi.fn>;
  };

  function makeSection(
    id: string,
    overrides: Partial<BlockSettingsSection> = {},
  ): TestSection {
    return {
      id,
      title: `Section ${id}`,
      mount: vi.fn(),
      ...overrides,
    } as TestSection;
  }

  function mountWith(
    block: ReturnType<typeof createTitleBlock>,
    sections: BlockSettingsSection[],
    provides: Record<symbol, unknown> = {},
  ) {
    return mountSettings(block, {
      provides: { [BLOCK_SETTINGS_SECTIONS_KEY]: sections, ...provides },
    });
  }

  function headers(wrapper: ReturnType<typeof mountEditor>): string[] {
    // Section headers are the buttons with a label; the pickers' stub buttons
    // inside an open section have none.
    return wrapper
      .findAll("button")
      .map((b) => b.text())
      .filter((text) => text !== "");
  }

  function ctxOf(section: TestSection, call = 0): BlockSettingsContext {
    return section.mount.mock.calls[call][1] as BlockSettingsContext;
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders after the display-condition section, in config order", () => {
    const vip: DisplayCondition = { label: "VIP", before: "{% if vip %}" };
    const wrapper = mountWith(
      createTitleBlock(),
      [makeSection("b"), makeSection("a")],
      { [DISPLAY_CONDITIONS_KEY]: [vip] },
    );

    expect(headers(wrapper)).toEqual([
      "Spacing",
      "Background",
      "Display",
      "Display Condition",
      "Section b",
      "Section a",
    ]);
  });

  it("renders after Display when there is no display-condition section", () => {
    const wrapper = mountWith(createTitleBlock(), [makeSection("a")]);

    expect(headers(wrapper)).toEqual([
      "Spacing",
      "Background",
      "Display",
      "Section a",
    ]);
  });

  it("is identical to before when no sections are provided", () => {
    const without = mountSettings(createTitleBlock());
    const empty = mountWith(createTitleBlock(), []);

    expect(headers(without)).toEqual(["Spacing", "Background", "Display"]);
    expect(headers(empty)).toEqual(headers(without));
    expect(empty.findAll("button")).toHaveLength(
      without.findAll("button").length,
    );
  });

  it("mounts each section with the block's own element and context", () => {
    const block = createTitleBlock();
    const a = makeSection("a");
    const b = makeSection("b");
    mountWith(block, [a, b]);

    expect(a.mount).toHaveBeenCalledTimes(1);
    expect(b.mount).toHaveBeenCalledTimes(1);
    expect(a.mount.mock.calls[0][0]).not.toBe(b.mount.mock.calls[0][0]);
    expect(ctxOf(a).block.id).toBe(block.id);
  });

  it("skips sections whose appliesTo is false and never mounts them", () => {
    const block = createTitleBlock();
    const hidden = makeSection("hidden", { appliesTo: vi.fn(() => false) });
    const shown = makeSection("shown", { appliesTo: vi.fn(() => true) });
    const wrapper = mountWith(block, [hidden, shown]);

    expect(headers(wrapper)).toContain("Section shown");
    expect(headers(wrapper)).not.toContain("Section hidden");
    expect(hidden.mount).not.toHaveBeenCalled();
    expect(shown.mount).toHaveBeenCalledTimes(1);
    expect(hidden.appliesTo).toHaveBeenCalledWith(block);
  });

  it("unmounts and cleans up when appliesTo turns false at runtime", async () => {
    const applies = ref(true);
    const cleanup = vi.fn();
    const section = makeSection("toggled", {
      appliesTo: () => applies.value,
      mount: vi.fn(() => cleanup) as BlockSettingsSection["mount"],
    });
    const wrapper = mountWith(createTitleBlock(), [section]);
    expect(headers(wrapper)).toContain("Section toggled");

    applies.value = false;
    await nextTick();

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(headers(wrapper)).not.toContain("Section toggled");

    applies.value = true;
    await nextTick();
    expect(section.mount).toHaveBeenCalledTimes(2);
    expect(headers(wrapper)).toContain("Section toggled");
  });

  it("cleans up and remounts when another block is selected", async () => {
    const first = createTitleBlock();
    const second = createTitleBlock();
    const cleanup = vi.fn();
    const section = makeSection("per-block", {
      mount: vi.fn(() => cleanup) as BlockSettingsSection["mount"],
    });
    const wrapper = mountWith(first, [section]);
    const firstCtx = ctxOf(section, 0);
    expect(firstCtx.block.id).toBe(first.id);

    await wrapper.setProps({ block: second });

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(section.mount).toHaveBeenCalledTimes(2);
    expect(ctxOf(section, 1).block.id).toBe(second.id);

    // The stale context from the first block can no longer write to the second.
    firstCtx.update({ repeat: undefined });
    expect(wrapper.emitted("update")).toBeUndefined();
  });

  it("does not remount when the same block is updated", async () => {
    const block = createTitleBlock();
    const section = makeSection("stable");
    const wrapper = mountWith(block, [section]);
    const onChange = vi.fn();
    ctxOf(section).onChange(onChange);

    await wrapper.setProps({ block: { ...block, repeat: { over: "x" } } });

    expect(section.mount).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("forwards ctx.update as the update event", () => {
    const section = makeSection("writer");
    const wrapper = mountWith(createTitleBlock(), [section]);

    ctxOf(section).update({ repeat: { over: "items", as: "item" } });

    expect(wrapper.emitted("update")).toEqual([
      [{ repeat: { over: "items", as: "item" } }],
    ]);
  });

  it("keeps other sections working when one mount throws", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const broken = makeSection("broken", {
      mount: vi.fn(() => {
        throw new Error("nope");
      }) as BlockSettingsSection["mount"],
    });
    const fine = makeSection("fine");
    const wrapper = mountWith(createTitleBlock(), [broken, fine]);

    expect(headers(wrapper)).toEqual(
      expect.arrayContaining(["Section broken", "Section fine"]),
    );
    expect(fine.mount).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0][1])).toContain("broken");
  });

  it("hides a section whose appliesTo throws and logs its id", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const bad = makeSection("bad-applies", {
      appliesTo: () => {
        throw new Error("nope");
      },
    });
    const fine = makeSection("fine");
    const wrapper = mountWith(createTitleBlock(), [bad, fine]);

    expect(headers(wrapper)).not.toContain("Section bad-applies");
    expect(headers(wrapper)).toContain("Section fine");
    expect(bad.mount).not.toHaveBeenCalled();
    expect(String(error.mock.calls[0][1])).toContain("bad-applies");
  });

  it("starts collapsed and opens on header click, per section id", async () => {
    const a = makeSection("a");
    const b = makeSection("b");
    const wrapper = mountWith(createTitleBlock(), [a, b]);
    const body = (section: TestSection) =>
      (section.mount.mock.calls[0][0] as HTMLElement)
        .parentElement as HTMLElement;

    expect(body(a).style.display).toBe("none");
    expect(body(b).style.display).toBe("none");

    await wrapper
      .get('[data-testid="block-settings-section-a"]')
      .trigger("click");
    expect(body(a).style.display).toBe("");
    expect(body(b).style.display).toBe("none");

    await wrapper
      .get('[data-testid="block-settings-section-a"]')
      .trigger("click");
    expect(body(a).style.display).toBe("none");
  });

  it("keeps a section open across block changes like the built-in ones", async () => {
    const section = makeSection("sticky");
    const wrapper = mountWith(createTitleBlock(), [section]);
    await wrapper
      .get('[data-testid="block-settings-section-sticky"]')
      .trigger("click");

    await wrapper.setProps({ block: createTitleBlock() });

    const el = section.mount.mock.calls[1][0] as HTMLElement;
    expect((el.parentElement as HTMLElement).style.display).toBe("");
  });

  it("shows the section summary on the header while collapsed", () => {
    const block = createTitleBlock();
    const wrapper = mountWith(block, [
      makeSection("s", { summary: (b) => `id: ${b.id}` }),
    ]);

    expect(
      wrapper.get('[data-testid="collapsible-section-summary"]').text(),
    ).toBe(`id: ${block.id}`);
  });
});
