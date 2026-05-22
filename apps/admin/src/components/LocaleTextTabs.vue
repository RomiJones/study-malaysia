<template>
  <div class="locale-editor">
    <div class="locale-editor__label">{{ label }}</div>
    <el-tabs>
      <el-tab-pane v-for="locale in locales" :key="locale.key" :label="locale.label">
        <el-input
          :model-value="localValue[locale.key as keyof typeof localValue]"
          :type="textarea ? 'textarea' : 'text'"
          :rows="textarea ? rows : undefined"
          @update:model-value="(value: unknown) => update(locale.key, String(value))"
        />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(defineProps<{ modelValue: Record<string, string>; label: string; textarea?: boolean; rows?: number }>(), {
  textarea: false,
  rows: 4
});

const emit = defineEmits<{ 'update:modelValue': [value: Record<string, string>] }>();
const locales = [
  { key: "en", label: "English" },
  { key: "ms", label: "Bahasa Melayu" },
  { key: "zh-CN", label: "中文-简体" },
  { key: "zh-TW", label: "中文-繁體" }
] as const;

const localValue = computed(() => ({ en: "", ms: "", "zh-CN": "", "zh-TW": "", ...(props.modelValue || {}) }));
const update = (locale: string, value: string) => {
  emit("update:modelValue", { ...localValue.value, [locale]: value });
};
</script>