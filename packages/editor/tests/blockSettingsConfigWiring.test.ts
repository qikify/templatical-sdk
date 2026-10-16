import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// `config.blockSettings` must travel from the public config to `useEditorCore`'s
// provide — `initCloud()` builds its `init()` config key by key, so a missing
// line silently drops the option on Cloud, and the per-component tests (which
// inject the key directly) can't catch it. Source-pattern guards, mirroring
// htmlBlockPreviewWiring.test.ts. Node-env file so `import.meta.url` resolves
// to the real path for readFileSync.

function readSrc(path: string): string {
  return readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
}

describe("blockSettings config wiring", () => {
  it("Editor.vue forwards config.blockSettings to useEditorCore", () => {
    expect(readSrc("Editor.vue")).toContain(
      "blockSettings: props.config.blockSettings",
    );
  });

  it("initCloud forwards config.blockSettings into the init() config", () => {
    expect(readSrc("index.ts")).toContain(
      "blockSettings: config.blockSettings",
    );
  });

  it("both public config types expose blockSettings", () => {
    expect(readSrc("index.ts")).toContain(
      "blockSettings?: BlockSettingsSection[]",
    );
    expect(readSrc("cloud/cloudConfig.ts")).toContain(
      "blockSettings?: BlockSettingsSection[]",
    );
  });

  it("the public entry exports both block-settings types", () => {
    const src = readSrc("index.ts");
    expect(src).toContain("BlockSettingsContext,");
    expect(src).toContain("BlockSettingsSection,");
    expect(src).toContain('} from "./types/block-settings";');
  });
});
