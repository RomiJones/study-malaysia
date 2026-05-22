export function createLocaleMap(initial = "") {
  return { en: initial, ms: initial, "zh-CN": initial, "zh-TW": initial };
}

export function createLocaleArrayMap() {
  return { en: [] as string[], ms: [] as string[], "zh-CN": [] as string[], "zh-TW": [] as string[] };
}
