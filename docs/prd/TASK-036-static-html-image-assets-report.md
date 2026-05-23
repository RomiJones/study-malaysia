# TASK-036 静态 HTML 图片资产提取报告

## 摘要

- **任务编号**: TASK-036
- **生成时间**: 2026-05-23T23:53:05.022Z
- **静态 HTML**: `D:/mydev/StudyMY_UM_v58_na_display_tidy.html`
- **本地资源目录**: `apps/web/public/assets/static-html`
- **Manifest**: `apps/web/public/assets/static-html/manifest.json`
- **图片入口总数**: 274
- **成功落地入口**: 44
- **本地文件数**: 34
- **失败入口**: 131
- **跳过入口**: 99

## 覆盖范围

- 已扫描数据层 `universitiesBase`、`universitiesSupplement`、`officialUniversityPatches` 中的 `logo`、`image` 等图片字段。
- 已扫描 HTML `img src`、`srcset`、`picture/source`、`link rel=icon` 入口。
- 已扫描 CSS `url(...)`，包含 data URL 背景图。
- 已提取内联 SVG 图标和装饰图。
- 每条 manifest 记录包含原始引用、来源位置、用途、文件名、大小、hash、宽高和处理状态。

## 状态统计

```json
{
  "skipped-template-expression": 4,
  "downloaded": 27,
  "decoded": 2,
  "extracted": 15,
  "failed": 131,
  "skipped-empty": 95
}
```

## 用途统计

```json
{
  "image": 5,
  "css-background": 2,
  "inline-svg": 15,
  "logo": 126,
  "card-image": 126
}
```

## 无法下载或无法解析的入口

| 状态 | 用途 | 原始引用 | 来源位置 | 原因 / 策略 |
| --- | --- | --- | --- | --- |
| skipped-template-expression | image | `${uni.image\|\|'https://images.unsplash.com/photo-1562774053-701939374585?w=800&h=400&fit...` | line 37163 / attr src | 模板表达式不是可直接下载的图片 URL。 模板表达式本身不是可下载 URL；脚本已单独提取表达式中的远程 fallback，并从数据字段提取运行时图片值。 |
| skipped-template-expression | image | `${uni.logo\|\|''}` | line 37170 / attr src | 模板表达式不是可直接下载的图片 URL。 模板表达式本身不是可下载 URL；脚本已单独提取表达式中的远程 fallback，并从数据字段提取运行时图片值。 |
| skipped-template-expression | image | `${uni.logo\|\|''}` | line 37244 / attr src | 模板表达式不是可直接下载的图片 URL。 模板表达式本身不是可下载 URL；脚本已单独提取表达式中的远程 fallback，并从数据字段提取运行时图片值。 |
| skipped-template-expression | image | `${u.logo}` | line 37754 / attr src | 模板表达式不是可直接下载的图片 URL。 模板表达式本身不是可下载 URL；脚本已单独提取表达式中的远程 fallback，并从数据字段提取运行时图片值。 |
| failed | logo | `https://upload.wikimedia.org/wikipedia/en/thumb/f/f9/University_of_Malaya_coat_of_arms....` | universitiesBase.0.logo / line 543 | 无法提取图片：HTTP 400 Use thumbnail sizes listed on https://w.wiki/GHai 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| failed | card-image | `https://www.um.edu.my/images/slider/um-main-campus.jpg` | universitiesBase.0.image / line 544 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| failed | logo | `https://upload.wikimedia.org/wikipedia/en/b/b9/UPM_logo.png` | universitiesBase.1.logo / line 21107 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| failed | logo | `https://upload.wikimedia.org/wikipedia/en/3/3f/UKM_logo.svg` | universitiesBase.2.logo / line 22198 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| failed | logo | `https://upload.wikimedia.org/wikipedia/en/1/18/Logo_of_Universiti_Sains_Malaysia.svg` | universitiesBase.3.logo / line 23040 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesBase.3.image / line 23041 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| failed | logo | `https://upload.wikimedia.org/wikipedia/en/thumb/1/10/Utm_logo.png/100px-Utm_logo.png` | universitiesBase.4.logo / line 23920 | 无法提取图片：HTTP 400 Use thumbnail sizes listed on https://w.wiki/GHai 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| failed | logo | `https://upload.wikimedia.org/wikipedia/en/2/27/IIUM-LOGO.png` | universitiesBase.5.logo / line 24660 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| failed | logo | `https://upload.wikimedia.org/wikipedia/en/thumb/7/72/MMU_logo.png/200px-MMU_logo.png` | universitiesBase.6.logo / line 25467 | 无法提取图片：HTTP 400 Use thumbnail sizes listed on https://w.wiki/GHai 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| failed | logo | `https://upload.wikimedia.org/wikipedia/en/thumb/a/a6/Taylor%27s_University_Logo.svg/200...` | universitiesBase.7.logo / line 25755 | 无法提取图片：HTTP 400 Use thumbnail sizes listed on https://w.wiki/GHai 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| failed | logo | `https://upload.wikimedia.org/wikipedia/en/thumb/6/65/UCSI_University_Logo.png/200px-UCS...` | universitiesBase.8.logo / line 26287 | 无法提取图片：HTTP 400 Use thumbnail sizes listed on https://w.wiki/GHai 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| failed | logo | `https://upload.wikimedia.org/wikipedia/en/thumb/c/c3/INTI_International_University_logo...` | universitiesBase.9.logo / line 26620 | 无法提取图片：HTTP 400 Use thumbnail sizes listed on https://w.wiki/GHai 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| failed | logo | `https://upload.wikimedia.org/wikipedia/en/thumb/4/42/Universiti_Teknologi_MARA_logo.png...` | universitiesBase.10.logo / line 26902 | 无法提取图片：HTTP 400 Use thumbnail sizes listed on https://w.wiki/GHai 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| failed | logo | `https://upload.wikimedia.org/wikipedia/en/thumb/5/5e/UTAR_logo.png/200px-UTAR_logo.png` | universitiesBase.11.logo / line 27574 | 无法提取图片：HTTP 400 Use thumbnail sizes listed on https://w.wiki/GHai 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| failed | logo | `https://upload.wikimedia.org/wikipedia/en/a/a4/Upsilogo.png` | universitiesBase.12.logo / line 27996 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| failed | logo | `https://upload.wikimedia.org/wikipedia/en/thumb/a/ac/Sunway_University_Logo.svg/200px-S...` | universitiesBase.13.logo / line 28452 | 无法提取图片：HTTP 400 Use thumbnail sizes listed on https://w.wiki/GHai 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop&hue=60` | universitiesBase.13.image / line 28453 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| failed | logo | `https://upload.wikimedia.org/wikipedia/en/thumb/8/8e/UNIMAS_logo.svg/200px-UNIMAS_logo....` | universitiesBase.14.logo / line 28887 | 无法提取图片：HTTP 400 Use thumbnail sizes listed on https://w.wiki/GHai 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| failed | logo | `https://www.apu.edu.my/themes/custom/apu/logo.svg` | universitiesBase.15.logo / line 29496 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| failed | logo | `https://www.monash.edu.my/__data/assets/image/0008/409751/Monash_Malaysia_logo.svg` | universitiesBase.16.logo / line 30026 | 无法提取图片：HTTP 403 Forbidden 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| failed | logo | `https://www.nottingham.edu.my/Brand/Legacy/logo.png` | universitiesBase.17.logo / line 30451 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| failed | logo | `https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Umk_logo.png/200px-Umk_logo.png` | universitiesSupplement.0.logo / line 30787 | 无法提取图片：HTTP 400 Use thumbnail sizes listed on https://w.wiki/GHai 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.0.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.1.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.1.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.2.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.2.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.3.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.3.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.4.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.4.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.5.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.5.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.6.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.6.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.7.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.7.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| failed | logo | `https://upload.wikimedia.org/wikipedia/en/thumb/d/dc/UTeM_Logo.svg/200px-UTeM_Logo.svg.png` | universitiesSupplement.8.logo / line 31248 | 无法提取图片：HTTP 400 Use thumbnail sizes listed on https://w.wiki/GHai 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| failed | logo | `https://upload.wikimedia.org/wikipedia/en/thumb/9/91/UTHM_Logo.png/200px-UTHM_Logo.png` | universitiesSupplement.9.logo / line 31320 | 无法提取图片：HTTP 400 Use thumbnail sizes listed on https://w.wiki/GHai 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| failed | logo | `https://upload.wikimedia.org/wikipedia/en/thumb/5/5a/UUM_Logo.svg/200px-UUM_Logo.svg.png` | universitiesSupplement.10.logo / line 31392 | 无法提取图片：HTTP 400 Use thumbnail sizes listed on https://w.wiki/GHai 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.11.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.11.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.12.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.12.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.13.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.13.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.14.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.14.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.15.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.15.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.16.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.16.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.17.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.17.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.18.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.18.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.19.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.19.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.20.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.20.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.21.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.21.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.22.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.22.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| failed | logo | `https://upload.wikimedia.org/wikipedia/en/thumb/2/24/MUST_Malaysia_logo.png/200px-MUST_...` | universitiesSupplement.23.logo / line 32124 | 无法提取图片：HTTP 400 Use thumbnail sizes listed on https://w.wiki/GHai 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.24.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.24.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.25.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.25.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| failed | logo | `https://upload.wikimedia.org/wikipedia/en/thumb/4/40/Nilai_University_logo.png/200px-Ni...` | universitiesSupplement.26.logo / line 32329 | 无法提取图片：HTTP 400 Use thumbnail sizes listed on https://w.wiki/GHai 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.27.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.27.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.28.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.28.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.29.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.29.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.30.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.30.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.31.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.31.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.32.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.32.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.33.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.33.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.34.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.34.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.35.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.35.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.36.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.36.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.37.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.37.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.38.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.38.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.39.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.39.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.40.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.40.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| failed | logo | `https://upload.wikimedia.org/wikipedia/en/thumb/4/47/Cyberjaya_University_College_of_Me...` | universitiesSupplement.41.logo / line 33182 | 无法提取图片：HTTP 400 Use thumbnail sizes listed on https://w.wiki/GHai 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.42.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.42.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.43.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.43.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.44.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.44.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.45.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.45.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.46.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.46.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.47.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.47.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.48.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.48.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.49.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.49.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.50.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.50.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.51.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.51.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.52.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.52.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.53.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.53.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.54.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.54.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.55.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.55.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.56.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.56.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.57.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.57.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.58.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.58.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.59.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.59.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.60.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.60.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.61.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.61.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.62.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.62.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.63.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.63.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.64.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.64.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.65.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.65.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.66.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.66.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.67.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.67.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.68.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.68.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.69.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.69.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.70.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.70.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.71.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.71.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.72.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.72.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.73.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.73.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.74.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.74.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.75.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.75.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.76.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.76.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.77.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.77.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.78.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.78.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.79.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.79.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.80.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.80.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.81.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.81.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.82.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.82.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.83.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.83.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.84.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.84.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.85.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.85.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.86.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.86.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.87.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.87.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.88.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.88.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.89.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.89.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.90.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.90.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.91.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.91.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.92.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.92.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.93.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.93.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.94.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.94.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.95.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.95.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.96.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.96.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.97.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.97.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.98.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.98.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.99.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.99.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.100.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.100.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| failed | logo | `https://upload.wikimedia.org/wikipedia/en/thumb/5/5a/UUM_Logo.svg/200px-UUM_Logo.svg.png` | universitiesSupplement.101.logo / line 31392 | 无法提取图片：HTTP 400 Use thumbnail sizes listed on https://w.wiki/GHai 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| failed | logo | `https://upload.wikimedia.org/wikipedia/en/thumb/9/91/UTHM_Logo.png/200px-UTHM_Logo.png` | universitiesSupplement.102.logo / line 31320 | 无法提取图片：HTTP 400 Use thumbnail sizes listed on https://w.wiki/GHai 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| failed | logo | `https://upload.wikimedia.org/wikipedia/en/thumb/d/dc/UTeM_Logo.svg/200px-UTeM_Logo.svg.png` | universitiesSupplement.103.logo / line 31248 | 无法提取图片：HTTP 400 Use thumbnail sizes listed on https://w.wiki/GHai 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| skipped-empty | logo | `` | universitiesSupplement.104.logo | 原始引用为空。 原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.104.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| failed | logo | `https://upload.wikimedia.org/wikipedia/en/thumb/0/00/Universiti_Teknologi_Malaysia_logo...` | universitiesSupplement.105.logo / line 36270 | 无法提取图片：HTTP 400 Use thumbnail sizes listed on https://w.wiki/GHai 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| failed | logo | `https://upload.wikimedia.org/wikipedia/en/thumb/1/16/International_Islamic_University_M...` | universitiesSupplement.106.logo / line 36325 | 无法提取图片：HTTP 400 Use thumbnail sizes listed on https://w.wiki/GHai 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| failed | card-image | `https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop` | universitiesSupplement.106.image / line 30788 | 无法提取图片：HTTP 404 Not Found 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |
| failed | logo | `https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Universiti_Teknologi_MARA_log...` | universitiesSupplement.107.logo / line 36388 | 无法提取图片：HTTP 400 Use thumbnail sizes listed on https://w.wiki/GHai 已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。 |

## 已落地样例

| 用途 | 原始引用 | 本地文件 | 尺寸 | 大小 |
| --- | --- | --- | --- | --- |
| image | `https://images.unsplash.com/photo-1562774053-701939374585?w=800&h=4...` | `apps/web/public/assets/static-html/image-photo-1562774053-701939374585-3a3ba5b0250f.jpg` | 800x400 | 101621 |
| css-background | `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width=...` | `apps/web/public/assets/static-html/css-background-data-image-94044909ad4c-94044909ad4c.svg` | 16x16 | 159 |
| css-background | `data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w...` | `apps/web/public/assets/static-html/css-background-data-image-7faa2fc18780-7faa2fc18780.svg` | 100x100 | 234 |
| inline-svg | `inline-svg:1d3346958db0` | `apps/web/public/assets/static-html/inline-svg-inline-svg-bb78dac7fc1c-bb78dac7fc1c.svg` | 24x24 | 156 |
| inline-svg | `inline-svg:ad224e81a9ac` | `apps/web/public/assets/static-html/inline-svg-inline-svg-b9528b6b4103-b9528b6b4103.svg` | 20x20 | 175 |
| inline-svg | `inline-svg:ee1ed83c908a` | `apps/web/public/assets/static-html/inline-svg-inline-svg-c37be65d3006-c37be65d3006.svg` | 18x18 | 201 |
| inline-svg | `inline-svg:361c3da51274` | `apps/web/public/assets/static-html/inline-svg-inline-svg-f843c6d34847-f843c6d34847.svg` | 14x14 | 187 |
| inline-svg | `inline-svg:af8fcd2145c1` | `apps/web/public/assets/static-html/inline-svg-inline-svg-e2bf67ea8213-e2bf67ea8213.svg` | 16x16 | 237 |
| inline-svg | `inline-svg:483f34d287f3` | `apps/web/public/assets/static-html/inline-svg-inline-svg-f188f5d6b99b-f188f5d6b99b.svg` | 16x16 | 239 |
| inline-svg | `inline-svg:e415ff953822` | `apps/web/public/assets/static-html/inline-svg-inline-svg-7fd5dcfdf2ea-7fd5dcfdf2ea.svg` | 16x16 | 237 |
| inline-svg | `inline-svg:55b4d4991161` | `apps/web/public/assets/static-html/inline-svg-inline-svg-c570b56cb5fe-c570b56cb5fe.svg` | 16x16 | 241 |
| inline-svg | `inline-svg:0c9df99b95ab` | `apps/web/public/assets/static-html/inline-svg-inline-svg-64129c4c775b-64129c4c775b.svg` | 16x16 | 235 |
| inline-svg | `inline-svg:a8f292e6950c` | `apps/web/public/assets/static-html/inline-svg-inline-svg-26392f80fce7-26392f80fce7.svg` | 16x16 | 243 |
| inline-svg | `inline-svg:5a04203423df` | `apps/web/public/assets/static-html/inline-svg-inline-svg-d5047f91a39c-d5047f91a39c.svg` | 14x14 | 167 |
| inline-svg | `inline-svg:a9c249d059ea` | `apps/web/public/assets/static-html/inline-svg-inline-svg-a6f02d9ad15f-a6f02d9ad15f.svg` | 14x14 | 314 |
| inline-svg | `inline-svg:362c9352a24c` | `apps/web/public/assets/static-html/inline-svg-inline-svg-be91448f6f5a-be91448f6f5a.svg` | 14x14 | 245 |
| inline-svg | `inline-svg:942a055268fe` | `apps/web/public/assets/static-html/inline-svg-inline-svg-0408b92c9e54-0408b92c9e54.svg` | 16x16 | 172 |
| inline-svg | `inline-svg:942a055268fe` | `apps/web/public/assets/static-html/inline-svg-inline-svg-0408b92c9e54-0408b92c9e54.svg` | 16x16 | 172 |
| card-image | `https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=800&...` | `apps/web/public/assets/static-html/card-image-photo-1541339907198-e08756dedf3f-8421a6bf5c1a.jpg` | 800x500 | 98806 |
| card-image | `https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?w=800&...` | `apps/web/public/assets/static-html/card-image-photo-1498243691581-b145c3f54a5a-35fe71643bf3.jpg` | 800x500 | 93864 |

## Notion 更新说明

本轮没有真实 Notion 页面 URL，未直接更新 Notion；已生成本地中文报告和 manifest，可由后续同步流程写回任务页。
