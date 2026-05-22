<template>
  <section v-if="catalog.universityDetail" class="grid gap-6">
    <div class="section-card overflow-hidden rounded-[32px]">
      <div class="grid md:grid-cols-[1.05fr_0.95fr]">
        <div class="relative min-h-[320px] bg-slate-900">
          <img v-if="catalog.universityDetail.imageUrl" :src="catalog.universityDetail.imageUrl" :alt="text(catalog.universityDetail.name)" class="h-full w-full object-cover" />
          <div v-else class="gradient-bg absolute inset-0"></div>
          <div class="absolute left-5 top-5 flex flex-wrap gap-2">
            <span class="info-chip badge-contrast">QS #{{ catalog.universityDetail.qsRank }}</span>
            <span class="info-chip badge-success">{{ t(`ownership.${catalog.universityDetail.ownership}`) }}</span>
          </div>
        </div>
        <div class="flex flex-col gap-5 p-6 md:p-8">
          <div class="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{{ catalog.universityDetail.shortName }}</div>
          <h1 class="text-3xl font-black leading-tight text-slate-900 md:text-4xl">{{ text(catalog.universityDetail.name) }}</h1>
          <p class="muted text-sm md:text-base">{{ text(catalog.universityDetail.description) }}</p>
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="rounded-[20px] bg-slate-50 p-4">
              <div class="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{{ t('common.city') }}</div>
              <div class="mt-2 text-lg font-bold text-slate-900">{{ text(catalog.universityDetail.location) }}</div>
            </div>
            <div class="rounded-[20px] bg-slate-50 p-4">
              <div class="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{{ t('common.foundedYear') }}</div>
              <div class="mt-2 text-lg font-bold text-slate-900">{{ catalog.universityDetail.foundedYear }}</div>
            </div>
            <div class="rounded-[20px] bg-slate-50 p-4">
              <div class="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{{ t('common.tuitionRange') }}</div>
              <div class="mt-2 text-lg font-bold text-slate-900">CNY {{ formatCurrency(catalog.universityDetail.tuitionMinCny) }} - CNY {{ formatCurrency(catalog.universityDetail.tuitionMaxCny) }}</div>
            </div>
            <div class="rounded-[20px] bg-slate-50 p-4">
              <div class="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{{ t('common.languageRequirement') }}</div>
              <div class="mt-2 text-lg font-bold text-slate-900">IELTS {{ catalog.universityDetail.minIelts }}+</div>
            </div>
          </div>
          <div class="flex flex-wrap gap-3">
            <a class="primary-action" :href="catalog.universityDetail.website" target="_blank" rel="noreferrer">{{ t('common.visitWebsite') }}</a>
            <a class="secondary-action" :href="`mailto:${catalog.universityDetail.admissionEmail}`">{{ t('common.contactAdmissions') }}</a>
            <button class="secondary-action" @click="catalog.toggleCompare(catalog.universityDetail.id)">
              {{ catalog.compareIds.includes(catalog.universityDetail.id) ? t('common.removeFromCompare') : t('common.addToCompare') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="section-card rounded-[28px] p-6 md:p-7">
      <div class="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <div class="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{{ t('university.introTitle') }}</div>
          <h2 class="section-title mt-2">{{ t('university.introTitle') }}</h2>
        </div>
        <div class="text-sm text-slate-500">{{ text(catalog.universityDetail.region) }} · {{ compactNumber(catalog.universityDetail.students) }} {{ t('common.students') }}</div>
      </div>
      <div class="mt-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div class="grid gap-4">
          <p class="muted text-sm leading-8 md:text-base">{{ introText }}</p>
          <p v-if="secondaryIntro" class="muted text-sm leading-8 md:text-base">{{ secondaryIntro }}</p>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-[20px] bg-slate-50 p-4">
            <div class="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{{ t('common.students') }}</div>
            <div class="mt-2 text-lg font-black text-slate-900">{{ compactNumber(catalog.universityDetail.students) }}</div>
          </div>
          <div class="rounded-[20px] bg-slate-50 p-4">
            <div class="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{{ t('common.international') }}</div>
            <div class="mt-2 text-lg font-black text-slate-900">{{ compactNumber(catalog.universityDetail.intlStudents) }}</div>
          </div>
          <div class="rounded-[20px] bg-slate-50 p-4">
            <div class="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{{ t('common.location') }}</div>
            <div class="mt-2 text-lg font-black text-slate-900">{{ text(catalog.universityDetail.location) }}</div>
          </div>
          <div class="rounded-[20px] bg-slate-50 p-4">
            <div class="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{{ t('common.qsRank') }}</div>
            <div class="mt-2 text-lg font-black text-slate-900">#{{ catalog.universityDetail.qsRank }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="overview-grid">
      <div class="section-card rounded-[28px] p-6">
        <div class="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{{ t('university.highlightsTitle') }}</div>
        <h2 class="section-title mt-2">{{ t('university.highlightsTitle') }}</h2>
        <ul class="mt-5 grid gap-3 text-sm leading-7 text-slate-600">
          <li v-for="item in array(catalog.universityDetail.highlights)" :key="item">{{ item }}</li>
        </ul>
      </div>
      <div class="section-card rounded-[28px] p-6">
        <div class="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{{ t('university.facilitiesTitle') }}</div>
        <h2 class="section-title mt-2">{{ t('university.facilitiesTitle') }}</h2>
        <ul class="mt-5 grid gap-3 text-sm leading-7 text-slate-600">
          <li v-for="item in array(catalog.universityDetail.facilities)" :key="item">{{ item }}</li>
        </ul>
      </div>
    </div>

    <div class="grid gap-4 md:grid-cols-4">
      <div class="section-card rounded-[24px] p-5">
        <div class="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{{ t('common.total') }}</div>
        <div class="mt-2 text-3xl font-black text-slate-900">{{ catalog.universityDetail.programs.length }}</div>
        <div class="mt-1 text-sm text-slate-500">{{ t('university.coursesTotal') }}</div>
      </div>
      <div class="section-card rounded-[24px] p-5">
        <div class="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{{ t('common.bachelor') }}</div>
        <div class="mt-2 text-3xl font-black text-slate-900">{{ bachelorPrograms.length }}</div>
        <div class="mt-1 text-sm text-slate-500">{{ t('university.bachelorPrograms') }}</div>
      </div>
      <div class="section-card rounded-[24px] p-5">
        <div class="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{{ t('common.master') }}</div>
        <div class="mt-2 text-3xl font-black text-slate-900">{{ masterPrograms.length }}</div>
        <div class="mt-1 text-sm text-slate-500">{{ t('university.masterPrograms') }}</div>
      </div>
      <div class="section-card rounded-[24px] p-5">
        <div class="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{{ t('common.phd') }}</div>
        <div class="mt-2 text-3xl font-black text-slate-900">{{ phdPrograms.length }}</div>
        <div class="mt-1 text-sm text-slate-500">{{ t('university.phdPrograms') }}</div>
      </div>
    </div>

    <div class="section-card rounded-[28px] p-6 md:p-7">
      <div class="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <div class="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{{ t('university.structureTitle') }}</div>
          <h2 class="section-title mt-2">{{ t('university.structureTitle') }}</h2>
        </div>
        <div class="text-sm text-slate-500">{{ t('university.visibleCount', { count: catalog.universityDetail.programs.length }) }}</div>
      </div>
      <div class="mt-6 grid gap-8">
        <section v-for="section in programSections" :key="section.key" class="grid gap-4">
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-xl font-black text-slate-900">{{ section.title }}</h3>
            <span class="info-chip bg-slate-100 text-slate-700">{{ section.items.length }}</span>
          </div>
          <div class="program-grid">
            <RouterLink v-for="program in section.items" :key="program.id" :to="`/programs/${program.slug}`" class="data-card block rounded-[24px] p-5 card-hover">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <div class="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{{ program.code }}</div>
                  <h3 class="mt-2 text-xl font-black leading-tight text-slate-900">{{ text(program.name) }}</h3>
                </div>
                <span class="info-chip bg-purple-50 text-purple-700">{{ section.shortLabel }}</span>
              </div>
              <p class="mt-3 text-sm text-slate-500">{{ text(program.faculty) }}</p>
              <div class="mt-5 flex flex-wrap gap-2">
                <span class="filter-chip">CNY {{ formatCurrency(program.annualTuitionCny) }}{{ t('common.perYear') }}</span>
                <span class="filter-chip">{{ Number(program.durationYears) }} {{ t('calculator.years') }}</span>
                <span class="filter-chip">IELTS {{ program.languageRequirement.ielts }}+</span>
              </div>
              <p class="muted mt-4 text-sm">{{ text(program.description) }}</p>
            </RouterLink>
          </div>
        </section>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { RouterLink } from "vue-router";
import { useLocaleText } from "../composables/useLocaleText";
import { useCatalogStore } from "../stores/catalog";
import { formatCurrency } from "../utils/format";

const props = defineProps<{ slug: string }>();
const catalog = useCatalogStore();
const { t, locale } = useI18n();
const { text, array } = useLocaleText();

const bachelorPrograms = computed(() => catalog.universityDetail?.programs.filter((program) => program.level === "bachelor") ?? []);
const masterPrograms = computed(() => catalog.universityDetail?.programs.filter((program) => program.level === "master") ?? []);
const phdPrograms = computed(() => catalog.universityDetail?.programs.filter((program) => program.level === "phd") ?? []);

const programSections = computed(() => [
  { key: "bachelor", title: t('university.bachelorPrograms'), shortLabel: t('degree.bachelor'), items: bachelorPrograms.value },
  { key: "master", title: t('university.masterPrograms'), shortLabel: t('degree.master'), items: masterPrograms.value },
  { key: "phd", title: t('university.phdPrograms'), shortLabel: t('degree.phd'), items: phdPrograms.value }
].filter((section) => section.items.length));

const introText = computed(() => {
  if (!catalog.universityDetail) return "";
  if (catalog.universityDetail.code !== "UM") return text(catalog.universityDetail.description);

  const copy = {
    en: "Universiti Malaya is Malaysia's flagship public research university. Located in Kuala Lumpur, it is consistently treated as one of the country's strongest comprehensive universities for business, computing, engineering, medicine, law, science and the humanities, and it remains one of the most referenced choices for students targeting a top Malaysian degree.",
    ms: "Universiti Malaya ialah universiti penyelidikan awam utama Malaysia. Berpusat di Kuala Lumpur, ia dianggap sebagai antara universiti komprehensif terkuat negara dalam bidang perniagaan, pengkomputeran, kejuruteraan, perubatan, undang-undang, sains dan kemanusiaan, serta kekal sebagai pilihan utama bagi pelajar yang menyasarkan ijazah Malaysia bertaraf tinggi.",
    "zh-CN": "马来亚大学是马来西亚最具代表性的旗舰公立研究型大学之一，位于吉隆坡。无论是商科、计算机、工程、医学、法学、理科还是人文社科，UM 都属于国际学生申请马来西亚名校时最常被重点对比和优先考虑的综合型大学。",
    "zh-TW": "馬來亞大學是馬來西亞最具代表性的旗艦公立研究型大學之一，位於吉隆坡。無論是商科、電腦、工程、醫學、法學、理科還是人文社科，UM 都屬於國際學生申請馬來西亞名校時最常被重點對比和優先考慮的綜合型大學。"
  };

  return copy[locale.value as keyof typeof copy] ?? copy["zh-CN"];
});

const secondaryIntro = computed(() => {
  if (!catalog.universityDetail || catalog.universityDetail.code !== "UM") return "";

  const copy = {
    en: "The site now expands Universiti Malaya to 61 visible programmes across bachelor's, master's and doctoral levels, so students and parents can review a much more realistic academic mix instead of only a few sample entries.",
    ms: "Laman ini kini mengembangkan Universiti Malaya kepada 61 program yang kelihatan merentas peringkat sarjana muda, sarjana dan kedoktoran, supaya pelajar dan ibu bapa dapat melihat struktur akademik yang jauh lebih realistik berbanding beberapa contoh ringkas sahaja.",
    "zh-CN": "当前站点已经把马来亚大学扩展到 61 个可见项目，覆盖本科、硕士和博士三个层级，方便学生和家长更真实地查看这所学校的学科结构，而不是只看到少量示例条目。",
    "zh-TW": "當前站點已經把馬來亞大學擴展到 61 個可見項目，覆蓋本科、碩士和博士三個層級，方便學生和家長更真實地查看這所學校的學科結構，而不是只看到少量示例條目。"
  };

  return copy[locale.value as keyof typeof copy] ?? copy["zh-CN"];
});

function compactNumber(value: number) {
  if (value >= 1000) return `${Math.round(value / 1000)}k+`;
  return `${value}`;
}

onMounted(() => catalog.loadUniversity(props.slug));
</script>
