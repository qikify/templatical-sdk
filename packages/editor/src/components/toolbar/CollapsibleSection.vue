<script setup lang="ts">
import { ChevronDown } from "@lucide/vue";

defineProps<{
  title: string;
  open: boolean;
  noBorder?: boolean;
  /**
   * Optional test hook on the header button. The title is the only other way to
   * address a section, and it is localized — which the e2e selector rules ban.
   */
  headerTestId?: string;
  /**
   * Optional one-line hint shown muted next to the title, also while the
   * section is collapsed. Truncated when it does not fit; the title never
   * shrinks for it. Null or empty renders nothing.
   */
  summary?: string | null;
}>();

defineEmits<{
  (e: "toggle"): void;
}>();
</script>

<template>
  <div
    class="tpl:py-3"
    :class="noBorder ? '' : 'tpl:border-t tpl:border-[var(--tpl-border)]'"
  >
    <button
      type="button"
      :data-testid="headerTestId"
      class="tpl:flex tpl:w-full tpl:cursor-pointer tpl:items-center tpl:gap-1.5 tpl:border-none tpl:bg-transparent tpl:p-0 tpl:text-sm tpl:font-medium tpl:text-[var(--tpl-text-muted)]"
      @click="$emit('toggle')"
    >
      <ChevronDown
        class="tpl:transition-transform tpl:duration-200"
        :class="open ? 'tpl:rotate-0' : 'tpl:-rotate-90'"
        :size="12"
        :stroke-width="2"
      />
      <span :class="summary ? 'tpl:shrink-0' : undefined">{{ title }}</span>
      <span
        v-if="summary"
        data-testid="collapsible-section-summary"
        class="tpl:min-w-0 tpl:truncate tpl:text-xs tpl:font-normal tpl:text-[var(--tpl-text-muted)]"
        >{{ summary }}</span
      >
    </button>
    <div v-show="open" class="tpl:mt-3">
      <slot />
    </div>
  </div>
</template>
