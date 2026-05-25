<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="tool-modal-inner tool-modal-inner--recommend">
      <div class="tool-modal-header">
        <div>
          <div class="tool-modal-kicker">{{ t('recommend.kicker') }}</div>
          <h3>{{ t('recommend.title') }}</h3>
        </div>
        <button class="tool-modal-close" type="button" :aria-label="t('common.close')" @click="$emit('close')">
          <span class="ui-icon ui-icon--close" aria-hidden="true"></span>
        </button>
      </div>

      <div class="tool-modal-body">
        <SmartRecommendationPanel
          context="modal"
          @open-auth="openAuth"
          @open-profile="openProfile"
          @close="$emit('close')"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import SmartRecommendationPanel from "./SmartRecommendationPanel.vue";
import { useSessionStore } from "../stores/session";

const emit = defineEmits<{ (e: "close"): void }>();

const session = useSessionStore();
const router = useRouter();
const { t } = useI18n();

function openAuth(mode: "login" | "register") {
  session.openAuth(mode);
}

function openProfile() {
  emit("close");
  void router.push({ path: "/planner", query: { tab: "profile" } });
}
</script>
