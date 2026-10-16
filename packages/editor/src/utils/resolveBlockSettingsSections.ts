import type { BlockSettingsSection } from "../types/block-settings";
import { logger } from "./logger";

/**
 * Normalizes the consumer-supplied `blockSettings` list for the panel.
 *
 * Returns the sections in config order. A section whose `id` was already seen
 * is dropped with a warning that names the id, so the first definition wins and
 * a typo'd copy-paste can't silently replace a working section. When
 * `blockSettings` is `undefined` the result is an empty list.
 *
 * The panel renders the result as-is and does not filter again.
 */
export function resolveBlockSettingsSections(
  sections: BlockSettingsSection[] | undefined,
): BlockSettingsSection[] {
  if (!sections) return [];

  const seen = new Set<string>();
  const out: BlockSettingsSection[] = [];

  for (const section of sections) {
    if (seen.has(section.id)) {
      logger.warn(
        `blockSettings: duplicate section id "${section.id}" — keeping the first, skipping this one.`,
      );
      continue;
    }

    seen.add(section.id);
    out.push(section);
  }

  return out;
}
