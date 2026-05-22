<template>
  <footer class="footer-wrap">
    <div class="footer-inner">
      <div class="footer-grid">
        <div class="footer-brand-block">
          <div class="footer-brand-title">StudyMY</div>
          <p class="footer-description">{{ t('footer.description') }}</p>
        </div>
        <div class="footer-meta">
          <div>{{ t('footer.dataNote') }}</div>
          <div>{{ t('footer.languageSupport') }}</div>
          <div>{{ t('footer.copyright') }}</div>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";

const { t } = useI18n();
</script>
