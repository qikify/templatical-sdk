import { afterEach, describe, expect, it, vi } from "vitest";
import type { BlockSettingsSection } from "../src/types/block-settings";
import { resolveBlockSettingsSections } from "../src/utils/resolveBlockSettingsSections";

function section(id: string, title = id): BlockSettingsSection {
  return { id, title, mount: () => {} };
}

describe("resolveBlockSettingsSections", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns an empty list when blockSettings is undefined", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(resolveBlockSettingsSections(undefined)).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("returns an empty list for an empty array", () => {
    expect(resolveBlockSettingsSections([])).toEqual([]);
  });

  it("keeps valid sections in config order without warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const repeat = section("repeat");
    const condition = section("condition");
    const notes = section("notes");

    const result = resolveBlockSettingsSections([repeat, condition, notes]);

    expect(result).toHaveLength(3);
    expect(result[0]).toBe(repeat);
    expect(result[1]).toBe(condition);
    expect(result[2]).toBe(notes);
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns once naming the id, keeps the first entry and drops the later one", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const first = section("repeat", "First");
    const other = section("condition");
    const duplicate = section("repeat", "Second");

    const result = resolveBlockSettingsSections([first, other, duplicate]);

    expect(result).toHaveLength(2);
    expect(result[0]).toBe(first);
    expect(result[1]).toBe(other);
    expect(result).not.toContain(duplicate);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0].join(" ")).toContain('"repeat"');
  });

  it("warns once per skipped entry when an id repeats more than twice", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const first = section("a");

    const result = resolveBlockSettingsSections([
      first,
      section("a"),
      section("a"),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(first);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("does not mutate the input array", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const input = [section("a"), section("a")];

    resolveBlockSettingsSections(input);

    expect(input).toHaveLength(2);
  });
});
