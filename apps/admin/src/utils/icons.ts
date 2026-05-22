import * as Icons from "@element-plus/icons-vue";

export function resolveIcon(name?: string) {
  return (name && (Icons as Record<string, unknown>)[name]) || Icons.Menu;
}
