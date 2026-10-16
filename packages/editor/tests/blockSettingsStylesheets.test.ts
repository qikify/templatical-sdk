// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import { mount } from "@vue/test-utils";
import {
  createCustomBlock,
  createDefaultTemplateContent,
  type CustomBlockDefinition,
} from "@templatical/types";
import CustomBlockStylesheets from "../src/components/CustomBlockStylesheets.vue";
import { useBlockRegistry } from "../src/composables/useBlockRegistry";
import { useCustomBlockStylesheets } from "../src/composables/useCustomBlockStylesheets";
import { CUSTOM_BLOCK_STYLESHEETS_KEY } from "../src/keys";
import type { BlockSettingsSection } from "../src/types/block-settings";

/**
 * `blockSettings` section stylesheets share the custom-block stylesheet path:
 * `useEditorCore` hands them to `useCustomBlockStylesheets` as the extra list
 * and `<CustomBlockStylesheets>` renders one `<style>` per entry. This file
 * covers that seam — the composable's rules for the extra list, and the
 * composable → DOM hop.
 */

const REPEAT_CSS = ".bs-repeat { display: flex; }";
const CONDITION_CSS = ".bs-condition { gap: 4px; }";
const CARD_CSS = ".tplc-card:hover { opacity: 0.8; }";

function section(id: string, stylesheet?: string): BlockSettingsSection {
  return {
    id,
    title: id,
    mount: () => {},
    ...(stylesheet === undefined ? {} : { stylesheet }),
  };
}

function extra(sections: BlockSettingsSection[]) {
  return sections.map((s) => s.stylesheet);
}

function registerCard(
  registry: ReturnType<typeof useBlockRegistry>,
  stylesheet: string,
): CustomBlockDefinition {
  const def: CustomBlockDefinition = {
    type: "card",
    name: "Card",
    fields: [],
    template: "<div>x</div>",
    stylesheet,
  };
  registry.registerCustom(def, defineComponent({ render: () => h("div") }));
  return def;
}

describe("section stylesheets through useCustomBlockStylesheets", () => {
  it("returns each section's trimmed stylesheet, in config order, with no custom blocks present", () => {
    const sheets = useCustomBlockStylesheets(
      ref(createDefaultTemplateContent()),
      useBlockRegistry(),
      extra([
        section("repeat", `\n  ${REPEAT_CSS}\n`),
        section("condition", CONDITION_CSS),
      ]),
    );

    expect(sheets.value).toEqual([REPEAT_CSS, CONDITION_CSS]);
  });

  it("drops whitespace-only and missing stylesheets", () => {
    const sheets = useCustomBlockStylesheets(
      ref(createDefaultTemplateContent()),
      useBlockRegistry(),
      extra([
        section("blank", "  \n\t "),
        section("none"),
        section("empty", ""),
        section("real", REPEAT_CSS),
      ]),
    );

    expect(sheets.value).toEqual([REPEAT_CSS]);
  });

  it("emits a stylesheet once when two sections ship the same content", () => {
    const sheets = useCustomBlockStylesheets(
      ref(createDefaultTemplateContent()),
      useBlockRegistry(),
      extra([
        section("a", REPEAT_CSS),
        section("b", `${REPEAT_CSS}\n`),
        section("c", CONDITION_CSS),
      ]),
    );

    expect(sheets.value).toEqual([REPEAT_CSS, CONDITION_CSS]);
  });

  it("emits a stylesheet once when a section and a custom block ship the same content, custom block first", () => {
    const registry = useBlockRegistry();
    const def = registerCard(registry, CARD_CSS);
    const tpl = createDefaultTemplateContent();
    tpl.blocks = [createCustomBlock(def)];

    const sheets = useCustomBlockStylesheets(
      ref(tpl),
      registry,
      extra([section("same", ` ${CARD_CSS} `), section("own", REPEAT_CSS)]),
    );

    expect(sheets.value).toEqual([CARD_CSS, REPEAT_CSS]);
  });

  it("keeps section stylesheets when the custom block that owned a duplicate is removed", () => {
    const registry = useBlockRegistry();
    const def = registerCard(registry, CARD_CSS);
    const tpl = createDefaultTemplateContent();
    tpl.blocks = [createCustomBlock(def)];
    const content = ref(tpl);

    const sheets = useCustomBlockStylesheets(
      content,
      registry,
      extra([section("same", CARD_CSS)]),
    );
    expect(sheets.value).toEqual([CARD_CSS]);

    content.value = { ...content.value, blocks: [] };

    expect(sheets.value).toEqual([CARD_CSS]);
  });

  it("behaves exactly as before when no section is configured", () => {
    const registry = useBlockRegistry();
    const def = registerCard(registry, CARD_CSS);
    const tpl = createDefaultTemplateContent();
    tpl.blocks = [createCustomBlock(def)];

    const withEmptyList = useCustomBlockStylesheets(ref(tpl), registry, []);
    const withoutList = useCustomBlockStylesheets(ref(tpl), registry);
    const emptyContent = useCustomBlockStylesheets(
      ref(createDefaultTemplateContent()),
      registry,
      [],
    );

    expect(withEmptyList.value).toEqual([CARD_CSS]);
    expect(withoutList.value).toEqual([CARD_CSS]);
    expect(emptyContent.value).toEqual([]);
  });
});

describe("section stylesheets in the DOM", () => {
  it("renders one <style data-tpl-custom-block-stylesheet> per section stylesheet", () => {
    const stylesheets = useCustomBlockStylesheets(
      ref(createDefaultTemplateContent()),
      useBlockRegistry(),
      extra([
        section("repeat", REPEAT_CSS),
        section("condition", CONDITION_CSS),
      ]),
    );

    const wrapper = mount(CustomBlockStylesheets, {
      global: {
        provide: { [CUSTOM_BLOCK_STYLESHEETS_KEY as symbol]: stylesheets },
      },
    });

    const tags = wrapper.findAll("style[data-tpl-custom-block-stylesheet]");
    expect(tags).toHaveLength(2);
    expect(tags[0].element.innerHTML).toBe(REPEAT_CSS);
    expect(tags[1].element.innerHTML).toBe(CONDITION_CSS);
  });

  it("keeps the section <style> while custom-block <style> tags come and go with the content", async () => {
    const registry = useBlockRegistry();
    const def = registerCard(registry, CARD_CSS);
    const content = ref(createDefaultTemplateContent());
    const stylesheets = useCustomBlockStylesheets(
      content,
      registry,
      extra([section("repeat", REPEAT_CSS)]),
    );

    const wrapper = mount(CustomBlockStylesheets, {
      global: {
        provide: { [CUSTOM_BLOCK_STYLESHEETS_KEY as symbol]: stylesheets },
      },
    });
    expect(wrapper.findAll("style").map((t) => t.element.innerHTML)).toEqual([
      REPEAT_CSS,
    ]);

    content.value = { ...content.value, blocks: [createCustomBlock(def)] };
    await nextTick();
    expect(wrapper.findAll("style").map((t) => t.element.innerHTML)).toEqual([
      CARD_CSS,
      REPEAT_CSS,
    ]);

    content.value = { ...content.value, blocks: [] };
    await nextTick();
    expect(wrapper.findAll("style").map((t) => t.element.innerHTML)).toEqual([
      REPEAT_CSS,
    ]);
  });

  it("renders no <style> when no section ships a stylesheet", () => {
    const stylesheets = useCustomBlockStylesheets(
      ref(createDefaultTemplateContent()),
      useBlockRegistry(),
      extra([section("a"), section("b", "   ")]),
    );

    const wrapper = mount(CustomBlockStylesheets, {
      global: {
        provide: { [CUSTOM_BLOCK_STYLESHEETS_KEY as symbol]: stylesheets },
      },
    });

    expect(wrapper.findAll("style")).toHaveLength(0);
  });
});
