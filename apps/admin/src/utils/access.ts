import { computed } from "vue";
import { useAuthStore } from "@/stores/auth";

export function useAccess() {
  const auth = useAuthStore();
  const permissions = computed(() => auth.permissions);
  const hasPermission = (permission: string) => permissions.value.has(permission);
  return { hasPermission };
}
