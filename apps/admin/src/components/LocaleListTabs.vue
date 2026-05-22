<template>
  <div class="locale-editor">
    <div class="locale-editor__label">{{ label }}</div>
    <el-tabs>
      <el-tab-pane v-for="locale in locales" :key="locale.key" :label="locale.label">
        <el-input
          :model-value="joinLines(localValue[locale.key as keyof typeof localValue])"
          type="textarea"
          :rows="rows"
          @update:model-value="(value: unknown) => update(locale.key, String(value))"
        />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(defineProps<{ modelValue: Record<string, string[]>; label: string; rows?: number }>(), {
  rows: 5
});

const emit = defineEmits<{ 'update:modelValue': [value: Record<string, string[]>] }>();
const locales = [
  { key: "en", label: "English" },
  { key: "ms", label: "Bahasa Melayu" },
  { key: "zh-CN", label: "中文-简体" },
  { key: "zh-TW", label: "中文-繁體" }
] as const;

const localValue = computed(() => ({ en: [] as string[], ms: [] as string[], "zh-CN": [] as string[], "zh-TW": [] as string[], ...(props.modelValue || {}) }));
const joinLines = (list?: string[]) => (list || []).join("\n");
const update = (locale: string, value: string) => {
  emit("update:modelValue", { ...localValue.value, [locale]: value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean) });
};
</script>