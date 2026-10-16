// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it } from "vitest";
import CollapsibleSection from "../src/components/toolbar/CollapsibleSection.vue";
import { mountEditor } from "./helpers/mount";

const SUMMARY = '[data-testid="collapsible-section-summary"]';

function mountSection(props: Record<string, unknown>) {
  return mountEditor(CollapsibleSection, {
    props: { title: "Repeat", open: false, ...props } as any,
    slots: { default: "<p>body</p>" },
  });
}

describe("CollapsibleSection summary", () => {
  it("renders the summary on the header, muted, while collapsed", () => {
    const wrapper = mountSection({ summary: "over: items" });

    const summary = wrapper.get(SUMMARY);
    expect(summary.text()).toBe("over: items");
    expect(wrapper.get("button").element.contains(summary.element)).toBe(true);
    expect(summary.classes()).toContain("tpl:truncate");
    expect(summary.classes()).toContain("tpl:min-w-0");
    expect(summary.classes()).toContain("tpl:text-[var(--tpl-text-muted)]");
  });

  it("keeps the title from shrinking when a summary is present", () => {
    const wrapper = mountSection({ summary: "a very long summary" });

    const title = wrapper.get("button").findAll("span")[0];
    expect(title.text()).toBe("Repeat");
    expect(title.classes()).toContain("tpl:shrink-0");
  });

  it.each([
    ["omitted", undefined],
    ["null", null],
    ["empty", ""],
  ])("renders no summary element when it is %s", (_label, summary) => {
    const wrapper = mountSection(summary === undefined ? {} : { summary });

    expect(wrapper.find(SUMMARY).exists()).toBe(false);
    expect(wrapper.get("button").findAll("span")).toHaveLength(1);
    expect(wrapper.get("button").findAll("span")[0].classes()).toEqual([]);
  });
});
