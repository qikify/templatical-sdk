<script setup lang="ts">
import type { Block } from "@templatical/types";
import { computed, onBeforeUnmount, onMounted, ref, toRaw, watch } from "vue";
import { useAliveFlag } from "../../composables/useAliveFlag";
import type {
  BlockSettingsContext,
  BlockSettingsSection,
} from "../../types/block-settings";
import { logger } from "../../utils/logger";
import CollapsibleSection from "./CollapsibleSection.vue";

interface ChangeListener {
  callback: (block: Block) => void;
}

const props = defineProps<{
  section: BlockSettingsSection;
  block: Block;
  open: boolean;
}>();

const emit = defineEmits<{
  (e: "toggle"): void;
  (e: "update", updates: Partial<Block>): void;
}>();

const aliveFlag = useAliveFlag();

const listeners = new Set<ChangeListener>();
let cleanup: (() => void) | null = null;

const container = ref<HTMLElement | null>(null);

const summary = computed<string | null>(() => {
  try {
    return props.section.summary?.(props.block) ?? null;
  } catch (error) {
    logger.error(
      `Block settings section "${props.section.id}" summary() threw.`,
      error,
    );
    return null;
  }
});

/**
 * A detached deep copy. Blocks are plain JSON, and `structuredClone` throws a
 * DataCloneError on Vue's reactive proxies, so round-trip the raw object.
 */
function cloneBlock(): Block {
  return JSON.parse(JSON.stringify(toRaw(props.block))) as Block;
}

const context: BlockSettingsContext = {
  get block(): Block {
    return cloneBlock();
  },
  update(updates): void {
    // The update chain targets whichever block is selected *now*, so a context
    // held past unmount (e.g. by an async callback) must not write.
    if (!aliveFlag.alive) return;
    emit("update", updates);
  },
  onChange(callback): () => void {
    if (!aliveFlag.alive) return () => {};

    const listener: ChangeListener = { callback };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

function notifyListeners(): void {
  for (const listener of [...listeners]) {
    try {
      listener.callback(cloneBlock());
    } catch (error) {
      logger.error(
        `Block settings section "${props.section.id}" onChange callback threw.`,
        error,
      );
    }
  }
}

watch(() => props.block, notifyListeners, { deep: true });

onMounted(() => {
  if (!container.value) return;

  try {
    const result = props.section.mount(container.value, context);
    if (typeof result === "function") cleanup = result;
  } catch (error) {
    logger.error(
      `Block settings section "${props.section.id}" mount() threw.`,
      error,
    );
  }
});

onBeforeUnmount(() => {
  listeners.clear();

  const dispose = cleanup;
  cleanup = null;
  if (!dispose) return;

  try {
    dispose();
  } catch (error) {
    logger.error(
      `Block settings section "${props.section.id}" cleanup threw.`,
      error,
    );
  }
});
</script>

<template>
  <CollapsibleSection
    :title="section.title"
    :summary="summary"
    :open="open"
    :header-test-id="`block-settings-section-${section.id}`"
    @toggle="emit('toggle')"
  >
    <div ref="container" />
  </CollapsibleSection>
</template>
