import type { SupportedLocale } from "@studymy/shared";

const en = {
  catalogLoaded: "Account favorites and compare list loaded.",
  catalogMerged: "Local favorites, saved programmes and compare list synced.",
  catalogLoadFailed: "Failed to read account status",
  catalogMergeFailed: "Favorite sync failed. Local data is kept.",
  favoriteSaveFailed: "Failed to save favorite",
  compareLimit: "You can compare up to 4 universities at once.",
  compareSaveFailed: "Failed to save compare list",
  compareClearFailed: "Failed to clear compare list",
  plannerLoaded: "Account application planner loaded.",
  plannerLocalSaved: "Guest planner saved on this device.",
  plannerLoadFailed: "Planner load failed. Local data is now used.",
  plannerMerged: "Local profile, materials, application tasks and visa checklist synced.",
  plannerMergeFailed: "Planner sync failed. Local data is kept.",
  profileLocalSaved: "Profile saved on this device.",
  profileSynced: "Profile synced to account.",
  profileSyncFailed: "Profile sync failed. Local data is kept.",
  materialLocalSaved: "Material status saved on this device.",
  materialSynced: "Material status synced to account.",
  materialSyncFailed: "Material status sync failed. Local data is kept.",
  taskLocalAdded: "Added to local application planner.",
  taskSynced: "Application task synced to account.",
  taskSyncFailed: "Application task sync failed. Local data is kept.",
  taskProgressLocalSaved: "Application task progress saved on this device.",
  taskProgressSynced: "Application task progress synced to account.",
  taskAdvanceFailed: "Failed to advance task",
  visaLocalSaved: "Visa checklist saved on this device.",
  visaSynced: "Visa checklist synced to account.",
  visaSyncFailed: "Visa checklist sync failed. Local data is kept."
};

const zhCN = {
  catalogLoaded: "已读取账户收藏和对比清单。",
  catalogMerged: "已同步本地收藏、专业收藏和对比清单。",
  catalogLoadFailed: "账户状态读取失败",
  catalogMergeFailed: "收藏同步失败，本地数据已保留",
  favoriteSaveFailed: "收藏保存失败",
  compareLimit: "最多只能同时对比 4 所院校",
  compareSaveFailed: "对比清单保存失败",
  compareClearFailed: "清空对比清单失败",
  plannerLoaded: "已读取账户申请规划。",
  plannerLocalSaved: "访客规划已保存在本机。",
  plannerLoadFailed: "申请规划加载失败，已切换本地数据",
  plannerMerged: "已同步本地画像、材料、申请任务和签证清单。",
  plannerMergeFailed: "申请规划同步失败，本地数据已保留",
  profileLocalSaved: "画像已保存在本机。",
  profileSynced: "画像已同步到账户。",
  profileSyncFailed: "画像同步失败，本地数据已保留",
  materialLocalSaved: "材料状态已保存在本机。",
  materialSynced: "材料状态已同步到账户。",
  materialSyncFailed: "材料状态同步失败，本地数据已保留",
  taskLocalAdded: "已加入本地申请规划。",
  taskSynced: "申请任务已同步到账户。",
  taskSyncFailed: "申请任务同步失败，本地数据已保留",
  taskProgressLocalSaved: "申请任务进度已保存在本机。",
  taskProgressSynced: "申请任务进度已同步到账户。",
  taskAdvanceFailed: "任务推进失败",
  visaLocalSaved: "签证清单已保存在本机。",
  visaSynced: "签证清单已同步到账户。",
  visaSyncFailed: "签证清单同步失败，本地数据已保留"
};

const runtimeMessages = {
  en,
  ms: en,
  "zh-CN": zhCN,
  "zh-TW": zhCN
} satisfies Record<SupportedLocale, typeof en>;

export type RuntimeMessageKey = keyof typeof en;

export function runtimeText(key: RuntimeMessageKey): string {
  return runtimeMessages[currentLocale()][key];
}

function currentLocale(): SupportedLocale {
  try {
    const locale = localStorage.getItem("studymy_locale") as SupportedLocale | null;
    return locale && locale in runtimeMessages ? locale : "zh-CN";
  } catch {
    return "zh-CN";
  }
}
