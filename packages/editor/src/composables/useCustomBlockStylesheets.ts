import { computed, type ComputedRef, type Ref } from "vue";
import type { Block, TemplateContent } from "@templatical/types";
import { isCustomBlock, isWrapper } from "@templatical/types";
import type { UseBlockRegistryReturn } from "./useBlockRegistry";

/**
 * Derive the reactive set of custom-block `stylesheet` strings currently in
 * use by the editor's content. Two layers of dedupe:
 *
 *  1. By `customType` — each definition's stylesheet is resolved once even if
 *     dozens of instances of that type exist in the template.
 *  2. By trimmed CSS content — two definitions that ship the same stylesheet
 *     string (unlikely but possible) emit it only once. Matches the renderer's
 *     `collectCustomBlockStylesheets` behavior so the editor preview and the
 *     exported MJML reflect the same rule set.
 *
 * Whitespace-only and missing stylesheets are filtered out. The result is a
 * `ComputedRef<string[]>` in insertion order (i.e., the order custom-block
 * types first appear in the content tree, depth-first through sections
 * and wrappers).
 *
 * `extraStylesheets` are stylesheets that apply no matter what the content
 * holds — today the `blockSettings` sections' CSS, which styles the settings
 * panel rather than a block. They go through the same trim / skip-empty rules
 * and are deduped against the custom-block entries by content; they come after
 * the custom-block ones, in the order given.
 *
 * Consumers render one `<style>` element per entry inside the editor's mount
 * root so the rules apply to the canvas. In shadow-DOM mode they scope to the
 * shadow root; in light-DOM mode they share the global stylesheet surface
 * already established by the published editor CSS — no new leak.
 */
export function useCustomBlockStylesheets(
  content: Ref<TemplateContent>,
  registry: UseBlockRegistryReturn,
  extraStylesheets: readonly (string | undefined)[] = [],
): ComputedRef<string[]> {
  return computed(() => {
    const customTypes = collectUniqueCustomTypes(content.value.blocks);
    if (customTypes.size === 0 && extraStylesheets.length === 0) {
      return [];
    }

    const seenContent = new Set<string>();
    const out: string[] = [];

    const add = (css: string | undefined): void => {
      if (!css) return;

      const trimmed = css.trim();
      if (trimmed === "" || seenContent.has(trimmed)) return;

      seenContent.add(trimmed);
      out.push(trimmed);
    };

    for (const customType of customTypes) {
      add(registry.getDefinition(customType)?.stylesheet);
    }
    for (const css of extraStylesheets) {
      add(css);
    }

    return out;
  });
}

function collectUniqueCustomTypes(blocks: Block[]): Set<string> {
  const types = new Set<string>();
  walk(blocks, types);
  return types;
}

function walk(blocks: Block[], out: Set<string>): void {
  for (const block of blocks) {
    if (isCustomBlock(block)) {
      out.add(block.customType);
      continue;
    }
    if (block.type === "section") {
      // SectionBlock has `children: Block[][]` (one array per column).
      const children = (block as unknown as { children?: Block[][] }).children;
      if (!children) continue;
      for (const column of children) {
        walk(column, out);
      }
    } else if (isWrapper(block)) {
      walk(block.children, out);
    }
  }
}
