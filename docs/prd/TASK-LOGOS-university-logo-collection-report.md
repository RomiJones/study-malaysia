# 119 所高校 Logo 采集报告

## 摘要

- **任务编号**: TASK-LOGOS
- **生成时间**: 2026-06-26T09:57:04.656Z
- **院校总数**: 119
- **已落地本地 logo**: 119
- **待人工确认**: 0
- **本地资源目录**: `apps/web/public/assets/static-html/university-logos`
- **Manifest**: `apps/web/public/assets/static-html/university-logos/manifest.json`
- **共享映射**: `packages/shared/src/university-logo-assets.ts`
- **是否回写数据库**: 否

## 采集口径

- 优先使用数据库已有官网、官网首页公开 logo、站点 manifest、apple touch icon 和现有外部 logo 字段。
- 缺少官网的院校使用脚本内 `knownHomepages` 候选表，并在 manifest 中保留采集来源。
- 仅接受 SVG，或满足用户端 40-60px logo 展示清晰度的 PNG/JPG/WebP/GIF；低于阈值的 favicon 不会进入映射。
- 官网直接候选失败时，最后使用 Google domain favicon 作为展示 fallback，并在 manifest 的 `sourceType=domain-favicon` 中标明。
- 对旧官网失效、官网被安全策略拦截或已停办/更名的院校，使用可核验的官方归档 PDF、Wikimedia、教育门户或 logo 仓库作为保底，并在 manifest 的 `sourceType` 中标明。
- 用户端仍通过本地 `/assets/static-html/university-logos/` 路径加载，不在运行时请求外部图片。

## 明细

| Code | 学校 | 状态 | 尺寸 | 来源 | 本地路径 |
| --- | --- | --- | --- | --- | --- |
| AIMST | AIMST University | downloaded | 300x300 | https://aimst.edu.my/wp-content/uploads/2025/01/aimstlogo500-300x300.png | /assets/static-html/university-logos/aimst-aimst-university-9476d4399a.png |
| AIU | Albukhary International University | downloaded | 1068x1068 | https://aiu.edu.my/wp-content/uploads/2022/11/AIULogo-512x521-01.jpg | /assets/static-html/university-logos/aiu-albukhary-international-university-02439165f1.jpg |
| ALAM | Malaysian Maritime Academy | downloaded | 151x60 | https://www.alam.edu.my/wp-content/uploads/2021/01/logo_alam_152x60_deepblue.png | /assets/static-html/university-logos/alam-malaysian-maritime-academy-b27aae902d.png |
| ALFA | ALFA University College | downloaded | 360x190 | https://alfa.edu.my/wp-content/uploads/ALFA-Logo.webp | /assets/static-html/university-logos/alfa-alfa-university-college-0b276374f4.webp |
| AMU | Asia Metropolitan University | downloaded | 150x150 | https://amu.edu.my/wp-content/uploads/2024/12/cropped-cropped-logo-orange-150x150.png | /assets/static-html/university-logos/amu-asia-metropolitan-university-f00389027d.png |
| APU | Asia Pacific University of Technology & Innovation (APU) | downloaded | 193x176 | https://www.apu.edu.my/themes/custom/apu/images/navbar/navbar-logo@2x.png | /assets/static-html/university-logos/apu-asia-pacific-university-of-technology-and-innovation-apu-e78d80bcdf.png |
| ASB | Asia School of Business | downloaded | 136x50 | https://asb.edu.my/wp-content/uploads/2022/12/logo.svg | /assets/static-html/university-logos/asb-asia-school-of-business-0d5c95ea8d.svg |
| ASWARA | Akademi Seni Budaya dan Warisan Kebangsaan | downloaded | 1716x1329 | https://www.aswara.edu.my/img/logo/Logo-Rasmi-Aswara-Malaysia-Putih.jpg | /assets/static-html/university-logos/aswara-akademi-seni-budaya-dan-warisan-kebangsaan-db5c4f14a2.jpg |
| AUCMS | Allianze University College of Medical Sciences | downloaded | 221x81 | https://upload.wikimedia.org/wikipedia/ms/5/5d/Aucms.jpg | /assets/static-html/university-logos/aucms-allianze-university-college-of-medical-sciences-72ad924819.jpg |
| BAC | Brickfields Asia College | downloaded | 130x120 | https://www.bac.edu.my/wp-content/uploads/2024/12/bace-white.png | /assets/static-html/university-logos/bac-brickfields-asia-college-d404ba2fe2.png |
| BERJAYA | BERJAYA University College | downloaded | 192x70 | https://www.berjaya.edu.my/university/wp-content/uploads/2019/02/buc-logo-edited-reg.png | /assets/static-html/university-logos/berjaya-berjaya-university-college-83354a46f9.png |
| BINARY | Binary University of Management and Entrepreneurship | downloaded | 192x192 | https://www.google.com/s2/favicons?domain=binary.edu.my&sz=256 | /assets/static-html/university-logos/binary-binary-university-of-management-and-entrepreneurship-720ab006f3.jpg |
| CITYU | City University | downloaded | 192x192 | https://www.google.com/s2/favicons?domain=city.edu.my&sz=256 | /assets/static-html/university-logos/cityu-city-university-9b0bba4032.png |
| CRESCENDO | Crescendo International College | downloaded | 960x947 | https://www.crescendo.edu.my/assets_user/img/crescendo_2024-06-26341.png | /assets/static-html/university-logos/crescendo-crescendo-international-college-8839e5c065.png |
| CUCMS | Cyberjaya University College of Medical Sciences | downloaded | 228x54 | https://cyberjaya.edu.my/wp-content/uploads/2022/10/University-of-Cyberjaya-Logo.png | /assets/static-html/university-logos/cucms-cyberjaya-university-college-of-medical-sciences-5712844bb1.png |
| DHU | DRB-HICOM University of Automotive Malaysia | downloaded | 1006x330 | https://www.en.dhuautomotive.edu.my/wp-content/uploads/2018/12/DHU_Official_Logo.png | /assets/static-html/university-logos/dhu-drb-hicom-university-of-automotive-malaysia-0e3c76ea00.png |
| ERICAN | Erican College | downloaded | 1963x793 | https://www.erican.edu.my/wp-content/uploads/2023/11/Erican-Language-Centre-Logo-e1699249622296.jpg | /assets/static-html/university-logos/erican-erican-college-446c0608fb.jpg |
| FCUC | First City University College | downloaded | 226x300 | https://firstcity.edu.my/wp-content/uploads/2022/11/logo-1-226x300.png | /assets/static-html/university-logos/fcuc-first-city-university-college-c70fe4a736.png |
| GEOMATIKA | Universiti Geomatika Malaysia | downloaded | 2222x803 | https://i0.wp.com/www.geomatika.edu.my/wp-content/uploads/2022/10/Logo-UGM-2022-TRANSPARENT-01.png?fit=2222%2C803&ssl=1 | /assets/static-html/university-logos/geomatika-universiti-geomatika-malaysia-0181d96989.webp |
| GLOBALNXT | GlobalNxt University | downloaded | 260x75 | https://globalnxt.edu.my/img/global_next_logo.svg | /assets/static-html/university-logos/globalnxt-globalnxt-university-a4b0d04c66.svg |
| HCUC | Han Chiang University College of Communication | downloaded | 285x102 | https://static.wixstatic.com/media/274939_33773e0331884b86866947a832d06c10~mv2.png/v1/fill/w_285,h_102,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/Logo_Full-Colour-.png | /assets/static-html/university-logos/hcuc-han-chiang-university-college-of-communication-51ba3adc74.webp |
| HELP | HELP University | downloaded | 300x45 | https://help.edu.my/wp-content/uploads/2026/06/HUGroup-Top-Logo-2026-300x45.png | /assets/static-html/university-logos/help-help-university-f98206ad4c.png |
| IBS | IBS College | downloaded | 450x121 | https://www.ibs.edu.my/wp-content/uploads/2022/10/logo-450px-ibs.png | /assets/static-html/university-logos/ibs-ibs-college-6a9788f4c7.png |
| IIUM | International Islamic University Malaysia (IIUM) | downloaded | 900x270 | https://www.iium.edu.my/v2/wp-content/uploads/2024/02/Official_Logo_IIUM_Tawhidic_Kanan_FullCMYK.png | /assets/static-html/university-logos/iium-international-islamic-university-malaysia-iium-a0fb5ec6cd.png |
| IMU | International Medical University | downloaded | 256x256 | https://www.google.com/s2/favicons?domain=www.imu.edu.my&sz=256 | /assets/static-html/university-logos/imu-international-medical-university-8e24668289.png |
| INCEIF | International Centre for Education in Islamic Finance | downloaded | 600x600 | https://images.seeklogo.com/logo-png/28/1/inceif-university-logo-png_seeklogo-285188.png | /assets/static-html/university-logos/inceif-international-centre-for-education-in-islamic-finance-6b0c2af60c.png |
| INSANIAH | INSANIAH University College | downloaded | 200x215 | https://unishams.edu.my/media/yootheme/cache/bc/LOGO%20UniSHAMS%20FULL%201-bc9e6eb4.png | /assets/static-html/university-logos/insaniah-insaniah-university-college-1e8af34685.png |
| INTI | INTI International University | downloaded | 4000x558 | https://newinti.edu.my/wp-content/uploads/2025/12/INTI-40.png | /assets/static-html/university-logos/inti-inti-international-university-f38370c89a.png |
| IPG | Institut Pendidikan Guru | downloaded | 96x96 | https://www.google.com/s2/favicons?domain=www.moe.gov.my&sz=256 | /assets/static-html/university-logos/ipg-institut-pendidikan-guru-ba935bfa34.png |
| IUCAS | International University College of Arts and Science | downloaded | 300x380 | https://www.neg.edu.my/imgs/logos/IUCAS_wt.png | /assets/static-html/university-logos/iucas-international-university-college-of-arts-and-science-6cd7f9f29b.png |
| IUCTT | International University College of Technology Twintech | downloaded | 1596x414 | https://newtwintech.edu.my/wp-content/uploads/2022/12/cropped-Twintech-Logo_Colour_Long.png | /assets/static-html/university-logos/iuctt-international-university-college-of-technology-twintech-dfa1f10440.png |
| IUKL | Infrastructure University Kuala Lumpur | downloaded | 400x136 | https://klust.edu.my/wp-content/uploads/2025/07/logo-klust.png | /assets/static-html/university-logos/iukl-infrastructure-university-kuala-lumpur-f89cf702f3.png |
| IUMW | International University of Malaya-Wales | downloaded | 409x200 | https://www.umwales.edu.my/wp-content/uploads/2024/04/UM-Wales-Logo.png | /assets/static-html/university-logos/iumw-international-university-of-malaya-wales-7e346bbbe9.png |
| KDU | KDU University College | downloaded | 1401x978 | https://www.uow.edu.my/wp-content/themes/kdu/img/UOWMKDU-logb.png | /assets/static-html/university-logos/kdu-kdu-university-college-aae8b0b030.png |
| KLMUC | Kuala Lumpur Metropolitan University College | downloaded | 112x25 | https://www.unitar.my/wp-content/uploads/2021/06/UNITAR-Logo.svg | /assets/static-html/university-logos/klmuc-kuala-lumpur-metropolitan-university-college-7b8cd0e710.svg |
| KPJ | KPJ Healthcare University College | downloaded | 289x59 | https://kpju.edu.my/wp-content/uploads/2025/05/logo.svg | /assets/static-html/university-logos/kpj-kpj-healthcare-university-college-a27f5c3f93.svg |
| KUIM | University College of Islam Malacca | downloaded | 300x131 | https://unimel.edu.my/wp2/wp-content/uploads/2025/03/LOGO-UNIVERSITI-ISLAM-MELAKA-3-01-trans-300x131.png | /assets/static-html/university-logos/kuim-university-college-of-islam-malacca-6406b8d34a.png |
| KUIS | International Islamic University College Selangor | downloaded | 300x150 | https://www.uis.edu.my/images/logo-uis-150.png | /assets/static-html/university-logos/kuis-international-islamic-university-college-selangor-2272efec85.png |
| KUISAS | Sultan Azlan Shah Islamic University College | downloaded | 256x256 | https://www.google.com/s2/favicons?domain=www.usas.edu.my&sz=256 | /assets/static-html/university-logos/kuisas-sultan-azlan-shah-islamic-university-college-7fca6fbeca.png |
| LELC | Limkokwing Executive Leadership College | downloaded | 138x42 | https://limkokwing.net/wp-content/uploads/2024/10/LKW-Logo.svg | /assets/static-html/university-logos/lelc-limkokwing-executive-leadership-college-ef4c71449f.svg |
| LINTON | Linton University College | downloaded | 300x116 | https://www.linton.edu.my/web/wp-content/uploads/2022/09/cropped-logo-2-300x116.png | /assets/static-html/university-logos/linton-linton-university-college-fd59df1545.png |
| LUC | Lincoln University College | downloaded | 300x124 | https://www.lincoln.edu.my/wp-content/uploads/2025/01/logo-300x124.webp | /assets/static-html/university-logos/luc-lincoln-university-college-a4f09c0051.webp |
| LUCT | Limkokwing University of Creative Technology | downloaded | 138x42 | https://limkokwing.net/wp-content/uploads/2024/10/LKW-Logo.svg | /assets/static-html/university-logos/luct-limkokwing-university-of-creative-technology-ef4c71449f.svg |
| MAHSA | MAHSA University | downloaded | 234x68 | https://mahsa.edu.my/images/logo.png | /assets/static-html/university-logos/mahsa-mahsa-university-db6f7b7dfb.png |
| MANTISSA | Mantissa College | downloaded | 794x314 | https://www.mantissa.edu.my/wp-content/uploads/2025/02/Logo-mantissa.png | /assets/static-html/university-logos/mantissa-mantissa-college-fdbec7e509.png |
| MEDIU | Al-Madinah International University | downloaded | 191x61 | https://www.mediu.edu.my/wp-content/uploads/2018/01/cropped-MEDIU-LOGO-e1672108479513.png | /assets/static-html/university-logos/mediu-al-madinah-international-university-4122d0de54.png |
| MERITUS | Meritus University | downloaded | 212x150 | https://www.meritus.edu.my/assets/images/Logo/meritusedu-logo.webp | /assets/static-html/university-logos/meritus-meritus-university-23d9f6ae98.webp |
| MIA | Malaysian Institute of Art | downloaded | 200x100 | https://mia.edu.my/wp-content/uploads/2025/05/mia.jpg | /assets/static-html/university-logos/mia-malaysian-institute-of-art-90f7729a1e.jpg |
| MIBC | Malaysian Integrated Business College | downloaded | 512x367 | https://www.mib.edu.my/wp-content/uploads/2024/06/logo-2.png | /assets/static-html/university-logos/mibc-malaysian-integrated-business-college-37260a05aa.png |
| MIM | Malaysian Institute of Management | downloaded | 435x140 | https://cdn.prod.website-files.com/61888c4244817b4f06903142/69fda85ae5fb917b370c4807_MIM-60y-logo%20web.png | /assets/static-html/university-logos/mim-malaysian-institute-of-management-ceeb8239e5.png |
| MISI | Malaysian Institute for Supply Chain Innovation | downloaded | vector | https://www.misi.edu.my/wp-content/themes/misi-theme/misi/assets/img/misi-university-logo.svg | /assets/static-html/university-logos/misi-malaysian-institute-for-supply-chain-innovation-b473a2fbde.svg |
| MIU | Manipal International University | downloaded | 376x140 | https://mila.edu.my/wp-content/uploads/2025/12/MILA-logo-new-align.png | /assets/static-html/university-logos/miu-manipal-international-university-d055655a57.png |
| MMU | Multimedia University (MMU) | downloaded | 172x50 | https://www.mmu.edu.my/wp-content/themes/mmu2018/assets/images/logo-mmu.png | /assets/static-html/university-logos/mmu-multimedia-university-mmu-1f81b405b7.png |
| MONASH | Monash University Malaysia | downloaded | 152x152 | https://www.google.com/s2/favicons?domain=www.monash.edu.my&sz=256 | /assets/static-html/university-logos/monash-monash-university-malaysia-acfcf4468e.png |
| MPI | Methodist Pilley Institute | downloaded | 200x200 | https://www.pilley.edu.my/wp-content/uploads/2018/04/lighthouse-logo-1.png | /assets/static-html/university-logos/mpi-methodist-pilley-institute-d82e20dc80.png |
| MSU | Management and Science University | downloaded | 300x105 | https://www.msu.edu.my/files/logo_msu.webp | /assets/static-html/university-logos/msu-management-and-science-university-fcef7b180e.webp |
| MUST | Malaysia University of Science and Technology | downloaded | 300x103 | https://must.edu.my/wp-content/uploads/2025/06/MUSTLOGO-TRANS-WHITE-300x103.png | /assets/static-html/university-logos/must-malaysia-university-of-science-and-technology-4f8d828c67.png |
| NBUC | North Borneo University College | downloaded | 460x100 | https://nbuc.edu.my/wp-content/uploads/2024/08/nbuc-logo-robot-v2-retina.png | /assets/static-html/university-logos/nbuc-north-borneo-university-college-662a4f3778.png |
| NEUC | New Era University College | downloaded | 128x120 | https://www.newera.edu.my/assets/images/neuc-logo-edited-128x120.png | /assets/static-html/university-logos/neuc-new-era-university-college-b068ada83c.png |
| NILAI | Nilai University | downloaded | 120x54 | https://www.nilai.edu.my/sites/default/files/logo.png | /assets/static-html/university-logos/nilai-nilai-university-bcebe84fbb.png |
| NKL | Northern Kuala Lumpur International College | downloaded | 3512x696 | https://nkl.edu.my/wp-content/uploads/2023/09/NKL-Logo-mandarin.png | /assets/static-html/university-logos/nkl-northern-kuala-lumpur-international-college-992416eaea.png |
| OLYMPIA | Olympia College | downloaded | 2827x1480 | https://olympia-education.com/assets/logo/olympia-land.png | /assets/static-html/university-logos/olympia-olympia-college-c7e8553cb5.png |
| PBS | Putra Business School | downloaded | 1080x685 | https://putrabusinessschool.edu.my/wp-content/uploads/2024/12/PBS-new-website-logo-111224-V2.webp | /assets/static-html/university-logos/pbs-putra-business-school-24dd4f52c8.webp |
| PERDANA | Perdana University | downloaded | 300x300 | https://perdanauniversity.edu.my/wp-content/uploads/2020/02/pu_emblem-01-01-300x300.png | /assets/static-html/university-logos/perdana-perdana-university-0541838aec.png |
| PIC | Putra International College | downloaded | 564x95 | https://www.iputra.edu.my/v2/images/logo_iputra_university_v2.png | /assets/static-html/university-logos/pic-putra-international-college-92ed9b8a0a.png |
| POLIMAS | Politeknik Sultan Abdul Halim Mu'adzam Shah | downloaded | 800x124 | https://polimas.mypolycc.edu.my/images/banners/logo_baru2023.png | /assets/static-html/university-logos/polimas-politeknik-sultan-abdul-halim-mu-adzam-shah-8a2b8b60ec.png |
| PPD | Politeknik Port Dickson | downloaded | 1200x483 | https://polipd.mypolycc.edu.my/web/images/logo_PPD_2015.png | /assets/static-html/university-logos/ppd-politeknik-port-dickson-4e2e473c30.png |
| PSDC | Penang Skills Development Centre | downloaded | 300x140 | https://www.psdc.org.my/assets/images/logo-blue.png | /assets/static-html/university-logos/psdc-penang-skills-development-centre-51b49ca254.png |
| QIU | Quest International University Perak | downloaded | 500x354 | https://qiu.edu.my/wp-content/uploads/2022/03/QIU-Logo-opt.jpg | /assets/static-html/university-logos/qiu-quest-international-university-perak-062808280a.jpg |
| RAFFLES | Raffles University | downloaded | 179x72 | https://raffles-university.edu.my/wp-content/uploads/2020/12/Blackbackground_Logo.png | /assets/static-html/university-logos/raffles-raffles-university-2ab26eeec3.png |
| RIYAZ | Ri-Yaz College | downloaded | 2048x1448 | https://www.myuni.com.my/assets/img/uni-logo/697031f929397.jpg | /assets/static-html/university-logos/riyaz-ri-yaz-college-7f1a2ed095.jpg |
| SAITO | Saito University College | downloaded | 434x155 | https://saito.edu.my/wp-content/uploads/2025/04/main-logo.png | /assets/static-html/university-logos/saito-saito-university-college-e2419200a3.png |
| SEGI | SEGi University | downloaded | 192x192 | https://www.google.com/s2/favicons?domain=university.segi.edu.my&sz=256 | /assets/static-html/university-logos/segi-segi-university-76231d994d.png |
| SOUTHERN | Southern University College | downloaded | 180x180 | https://www.southern.edu.my/wp-content/uploads/2022/08/cropped-suc-logo-1-180x180.jpg | /assets/static-html/university-logos/southern-southern-university-college-666dda38a2.jpg |
| STAMFORD | Stamford College Petaling Jaya | downloaded | 558x327 | https://stamford.edu.my/wp-content/themes/twentyeleven/img/logo.png | /assets/static-html/university-logos/stamford-stamford-college-petaling-jaya-4aa23555ea.png |
| SUNWAY | Sunway University | downloaded | 371x150 | https://sunwayuniversity.edu.my/themes/custom/sunway/images/sunway-logo-black.png | /assets/static-html/university-logos/sunway-sunway-university-c7d18c00e3.png |
| TARUC | Tunku Abdul Rahman University College | downloaded | 430x140 | https://www.tarc.edu.my/images/tarumt-logo1.png?v=beyongEducation2 | /assets/static-html/university-logos/taruc-tunku-abdul-rahman-university-college-ccbb13563d.png |
| TATI | TATI University College | downloaded | 300x319 | https://www.tatiuc.edu.my/assets/images/tatiuc-logo-2-250x280.png | /assets/static-html/university-logos/tati-tati-university-college-d49ff9fa03.png |
| TAYLORS | Taylor's University | downloaded | vector | https://university.taylors.edu.my/content/dam/taylorsrevamp/university/homepage/header/taylors-university-logo-white-198x72.svg | /assets/static-html/university-logos/taylors-taylor-s-university-c3f4576187.svg |
| TOA | The One Academy of Communication Design | downloaded | 254x47 | https://www.toa.edu.my/#inline-svg-76c468b389 | /assets/static-html/university-logos/toa-the-one-academy-of-communication-design-76c468b389.svg |
| UCAM | University College of Agroscience | downloaded | 300x97 | https://ucam.edu.my/wp-content/uploads/2024/08/logo-ucam-nov-2025-300x97.jpg | /assets/static-html/university-logos/ucam-university-college-of-agroscience-d5a11efa88.jpg |
| UCB | University College Bestari | downloaded | 300x300 | https://www.ucbestari.edu.my/wp-content/uploads/2021/06/ucb-logo-1-300x300.png | /assets/static-html/university-logos/ucb-university-college-bestari-c529e52f4b.png |
| UCMI | University College of MAIWP International | downloaded | 180x180 | https://www.unimaiwp.edu.my/wp-content/uploads/2026/01/cropped-cropped-Logo-UniMAIWP-Official-2-scaled-1-180x180.png | /assets/static-html/university-logos/ucmi-university-college-of-maiwp-international-bd98f5a96f.png |
| UCSA | University College Shahputra | downloaded | 800x221 | https://widad.edu.my/assets/images/logo/rwuc-large.png | /assets/static-html/university-logos/ucsa-university-college-shahputra-96530da336.png |
| UCSI | UCSI University | downloaded | 180x180 | https://www.google.com/s2/favicons?domain=www.ucsiuniversity.edu.my&sz=256 | /assets/static-html/university-logos/ucsi-ucsi-university-ac43817bcd.png |
| UCTS | University College of Technology Sarawak | downloaded | 192x192 | https://www.google.com/s2/favicons?domain=www.uts.edu.my&sz=256 | /assets/static-html/university-logos/ucts-university-college-of-technology-sarawak-6da9282295.png |
| UCYP | University College of Yayasan Pahang | downloaded | 2401x724 | https://ucyp.edu.my/wp-content/uploads/2025/05/LOGO_UCYP_UNIVERSITY_U_red-021.png | /assets/static-html/university-logos/ucyp-university-college-of-yayasan-pahang-2e1684b060.png |
| UITM | Universiti Teknologi MARA (UiTM) | downloaded | 256x256 | https://www.google.com/s2/favicons?domain=www.uitm.edu.my&sz=256 | /assets/static-html/university-logos/uitm-universiti-teknologi-mara-uitm-e6c978245a.png |
| UKM | Universiti Kebangsaan Malaysia (UKM) | downloaded | 219x85 | https://www.ukm.my/portalukm/wp-content/uploads/2021/09/cropped-LogoUKM-1.png | /assets/static-html/university-logos/ukm-universiti-kebangsaan-malaysia-ukm-8df5108311.png |
| UM | Universiti Malaya (UM) | downloaded | 180x56 | https://www.um.edu.my/images/img-logo-UM.png | /assets/static-html/university-logos/um-universiti-malaya-um-9618215497.png |
| UMK | Universiti Malaysia Kelantan (UMK) | downloaded | 4961x3495 | https://www.umk.edu.my/images/logoumk-20tahun.webp | /assets/static-html/university-logos/umk-universiti-malaysia-kelantan-umk-d75c189093.webp |
| UMPSA | Universiti Malaysia Pahang Al-Sultan Abdullah (UMPSA) | downloaded | 240x180 | https://www.umpsa.edu.my/img/logo-umpsa.png | /assets/static-html/university-logos/umpsa-universiti-malaysia-pahang-al-sultan-abdullah-umpsa-f57438f553.png |
| UMS | Universiti Malaysia Sabah | downloaded | 256x256 | https://www.google.com/s2/favicons?domain=www.ums.edu.my&sz=256 | /assets/static-html/university-logos/ums-universiti-malaysia-sabah-d5b4c98278.png |
| UMT | Universiti Malaysia Terengganu | downloaded | 180x180 | https://www.umt.edu.my/wp-content/uploads/2025/12/cropped-logo-korporat-01-scaled-1-180x180.png | /assets/static-html/university-logos/umt-universiti-malaysia-terengganu-568ef4760c.png |
| UNIKL | Universiti Kuala Lumpur | downloaded | 300x136 | https://www.unikl.edu.my/wp-content/uploads/2020/11/UniKL-White-Logo-Official-300x136.png | /assets/static-html/university-logos/unikl-universiti-kuala-lumpur-28cacb0540.webp |
| UNIMAP | Universiti Malaysia Perlis (UniMAP) | downloaded | 200x100 | https://www.unimap.edu.my/images/logoRasmi/unimap_logo_2025.png | /assets/static-html/university-logos/unimap-universiti-malaysia-perlis-unimap-df2ef9133a.png |
| UNIMAS | Universiti Malaysia Sarawak (UNIMAS) | downloaded | 256x256 | https://www.google.com/s2/favicons?domain=www.unimas.my&sz=256 | /assets/static-html/university-logos/unimas-universiti-malaysia-sarawak-unimas-99948ad4f1.png |
| UNIMEL | University of Melaka | downloaded | 300x131 | https://unimel.edu.my/wp2/wp-content/uploads/2025/03/LOGO-UNIVERSITI-ISLAM-MELAKA-3-01-trans-300x131.png | /assets/static-html/university-logos/unimel-university-of-melaka-6406b8d34a.png |
| UNIMY | University Malaysia of Computer Science and Engineering | downloaded | 147x100 | https://www.unimy.edu.my/wp-content/uploads/2025/02/image_10.png | /assets/static-html/university-logos/unimy-university-malaysia-of-computer-science-and-engineering-4c88fc8fff.png |
| UNIRAZAK | Universiti Tun Abdul Razak | downloaded | 235x84 | https://unirazak.edu.my/wp-content/uploads/2024/11/unirazak-logo.png | /assets/static-html/university-logos/unirazak-universiti-tun-abdul-razak-dacbd1a4f6.png |
| UNISEL | Universiti Selangor | downloaded | 300x119 | https://unisel.edu.my/wp-content/uploads/2026/02/Logo_of_Unisel_universiti_Selangor-300x119.png | /assets/static-html/university-logos/unisel-universiti-selangor-eff875dc4c.png |
| UNISHAMS | Universiti Islam Antarabangsa Sultan Abdul Halim Mu'adzam Shah | downloaded | 120x62 | https://unishams.edu.my/media/yootheme/cache/d6/logo%20kedah%20%20UniSHAMS-01-d6e6618d.png | /assets/static-html/university-logos/unishams-universiti-islam-antarabangsa-sultan-abdul-halim-mu-adza-ca7e1b1377.png |
| UNISZA | Universiti Sultan Zainal Abidin (UniSZA) | downloaded | 300x113 | https://www.unisza.edu.my/wp-content/uploads/2021/04/logo_left-300x113.png | /assets/static-html/university-logos/unisza-universiti-sultan-zainal-abidin-unisza-b55b7bafe8.png |
| UNITAR | UNITAR International University | downloaded | 112x25 | https://www.unitar.my/wp-content/uploads/2021/06/UNITAR-Logo.svg | /assets/static-html/university-logos/unitar-unitar-international-university-7b8cd0e710.svg |
| UNITEN | Universiti Tenaga Nasional | downloaded | 341x240 | https://www.uniten.edu.my/media/1q1gk1ip/logo-light-uniten.png | /assets/static-html/university-logos/uniten-universiti-tenaga-nasional-44b8a15c5b.png |
| UNM | University of Nottingham Malaysia | downloaded | vector | https://www.nottingham.edu.my/SiteElements/2023-GeneralFullWidth-template/Images/mobile-logo-full-2025.svg | /assets/static-html/university-logos/unm-university-of-nottingham-malaysia-4175447bc4.svg |
| UOC | University of Cyberjaya | downloaded | 228x54 | https://cyberjaya.edu.my/wp-content/uploads/2022/10/University-of-Cyberjaya-Logo.png | /assets/static-html/university-logos/uoc-university-of-cyberjaya-5712844bb1.png |
| UPM | Universiti Putra Malaysia (UPM) | downloaded | 3543x2126 | https://upm.edu.my/assets/images23/20170406143426UPM-New_FINAL.jpg | /assets/static-html/university-logos/upm-universiti-putra-malaysia-upm-b7ac62e09b.jpg |
| UPNM | Universiti Pertahanan Nasional Malaysia | downloaded | 247x66 | https://www.upnm.edu.my/images/icon/New_LOGO%20UPNM_UPNM30.png | /assets/static-html/university-logos/upnm-universiti-pertahanan-nasional-malaysia-01705e5842.png |
| UPSI | Universiti Pendidikan Sultan Idris (UPSI) | downloaded | 2083x982 | https://www.upsi.edu.my/wp-content/uploads/2025/07/logo.png | /assets/static-html/university-logos/upsi-universiti-pendidikan-sultan-idris-upsi-d05605397c.png |
| USIM | Universiti Sains Islam Malaysia | downloaded | 365x55 | https://www.usim.edu.my/wp-content/uploads/2015/03/LOGO-USIM-HEADER.png | /assets/static-html/university-logos/usim-universiti-sains-islam-malaysia-afe850fbec.png |
| USM | Universiti Sains Malaysia | downloaded | 174x42 | https://www.usm.my/templates/yootheme/cache/2e/USM%20APEX-Ver-R-2e18fddc.webp | /assets/static-html/university-logos/usm-universiti-sains-malaysia-usm-c0a822c3d8.webp |
| UTAR | Universiti Tunku Abdul Rahman (UTAR) | downloaded | 256x256 | https://www.google.com/s2/favicons?domain=www.utar.edu.my&sz=256 | /assets/static-html/university-logos/utar-universiti-tunku-abdul-rahman-utar-557ab0f373.png |
| UTEM | Universiti Teknikal Malaysia Melaka (UTeM) | downloaded | 124x70 | https://www.utem.edu.my/templates/yootheme/cache/f9/logo-utem-white-f952cee4.png | /assets/static-html/university-logos/utem-universiti-teknikal-malaysia-melaka-utem-6be126c687.png |
| UTHM | Universiti Tun Hussein Onn Malaysia (UTHM) | downloaded | 226x62 | https://www.uthm.edu.my/media/yootheme/cache/d3/logo-UTHM-smallest-d35f1c27.png | /assets/static-html/university-logos/uthm-universiti-tun-hussein-onn-malaysia-uthm-58aa8a1dd6.png |
| UTM | Universiti Teknologi Malaysia | downloaded | 2560x867 | https://www.utm.my/wp-content/uploads/2022/10/LOGO-UTM.png | /assets/static-html/university-logos/utm-utm-a638b0af11.png |
| UTP | Universiti Teknologi PETRONAS | downloaded | 600x250 | https://www.utp.edu.my/SiteAssets/UTP-logo2.png?rev=43 | /assets/static-html/university-logos/utp-universiti-teknologi-petronas-8747405917.png |
| UUM | Universiti Utara Malaysia (UUM) | downloaded | 300x114 | https://www.uum.edu.my/images/logouum-small.png | /assets/static-html/university-logos/uum-universiti-utara-malaysia-uum-431d33f5bd.png |
| VMIUC | Vinayaka Mission International University College | downloaded | 1040x520 | https://web.archive.org/web/20140411235131id_/http://www.vmiuc.edu.my/website2/doc/File/Application_Form.pdf | /assets/static-html/university-logos/vmiuc-vinayaka-mission-international-university-college-4198347ee8.png |

## 待人工确认项

无。

## Notion 更新说明

本轮没有可写入的真实 Notion 页面 ID；已生成本地中文报告和 manifest，后续可由 Notion 同步流程写回任务页。
