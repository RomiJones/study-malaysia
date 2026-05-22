import type {
  AuthMethod,
  DegreeLevel,
  InstitutionOwnership,
  InstitutionType,
  LocalizedStringArray,
  LocalizedText,
  ProgramCategory
} from "@studymy/shared";
import { umExtraPrograms } from "./seed-um-extra.js";

const t = (en: string, ms: string, zhCN: string, zhTW: string): LocalizedText => ({
  en,
  ms,
  "zh-CN": zhCN,
  "zh-TW": zhTW
});

const arr = (
  en: string[],
  ms: string[],
  zhCN: string[],
  zhTW: string[]
): LocalizedStringArray => ({
  en,
  ms,
  "zh-CN": zhCN,
  "zh-TW": zhTW
});

export interface SeedUser {
  role: "student" | "admin";
  method: AuthMethod;
  account: string;
  password: string;
  displayName: string;
}

export interface SeedUniversity {
  slug: string;
  code: string;
  name: LocalizedText;
  shortName: string;
  logoUrl: string;
  imageUrl: string;
  color: string;
  qsRank: number;
  qsAsiaRank: number;
  location: LocalizedText;
  region: LocalizedText;
  ownership: InstitutionOwnership;
  institutionType: InstitutionType;
  foundedYear: number;
  students: number;
  intlStudents: number;
  csrCertified: boolean;
  description: LocalizedText;
  website: string;
  admissionEmail: string;
  tuitionMinCny: number;
  tuitionMaxCny: number;
  livingCostCny: number;
  minIelts: number;
  acceptNoLanguage: boolean;
  facilities: LocalizedStringArray;
  highlights: LocalizedStringArray;
}

export interface SeedProgram {
  universityCode: string;
  slug: string;
  code: string;
  name: LocalizedText;
  level: DegreeLevel;
  category: ProgramCategory;
  faculty: LocalizedText;
  durationYears: number;
  annualTuitionCny: number;
  intakeMonths: string[];
  languageRequirement: {
    ielts: number;
    toefl?: number;
    pte?: number;
    muet?: number;
  };
  requirement: {
    gpa: number;
    gaokaoRequired: boolean;
    huikaoRequired: boolean;
    note: LocalizedText;
  };
  applicationDocs: LocalizedStringArray;
  curriculum: LocalizedStringArray;
  careers: LocalizedStringArray;
  specializations: LocalizedStringArray;
  description: LocalizedText;
}

export interface SeedContentBlock {
  key: string;
  title: LocalizedText;
  body: LocalizedText;
}

export const seedUsers: SeedUser[] = [
  {
    role: "admin",
    method: "email",
    account: "admin@studymy.local",
    password: "Admin123!",
    displayName: "StudyMY Admin"
  },
  {
    role: "student",
    method: "email",
    account: "demo@studymy.local",
    password: "Demo123!",
    displayName: "Demo Student"
  }
];

export const seedContentBlocks: SeedContentBlock[] = [
  {
    key: "home.hero",
    title: t(
      "Study in Malaysia with a structured self-application workflow.",
      "Belajar di Malaysia dengan aliran permohonan kendiri yang tersusun.",
      "用结构化自助申请流程完成马来西亚留学申请。",
      "用結構化自助申請流程完成馬來西亞留學申請。"
    ),
    body: t(
      "Search universities, compare majors, estimate cost, build your shortlist, and keep application milestones in one system.",
      "Cari universiti, bandingkan program, anggar kos, bina senarai pendek dan urus setiap peringkat permohonan dalam satu sistem.",
      "查询学校、比较专业、估算预算、建立申请清单，并把整个申请推进放在一个系统里。",
      "查詢學校、比較專業、估算預算、建立申請清單，並把整個申請推進放在一個系統裡。"
    )
  },
  {
    key: "home.source-note",
    title: t(
      "Official-source-first reference dataset",
      "Dataset rujukan berasaskan sumber rasmi",
      "官方口径优先的参考数据集",
      "官方口徑優先的參考資料集"
    ),
    body: t(
      "The initial seed is curated for product demonstration. Admin can continuously add more institutions, programs, and multilingual content.",
      "Data awal disediakan untuk demo produk. Admin boleh terus menambah institusi, program dan kandungan berbilang bahasa.",
      "首批数据用于产品演示，后续可通过 admin 持续补充学校、专业和多语言内容。",
      "首批資料用於產品演示，後續可透過 admin 持續補充學校、專業和多語言內容。"
    )
  }
];

export const seedUniversities: SeedUniversity[] = [
  {
    slug: "universiti-malaya",
    code: "UM",
    name: t("Universiti Malaya", "Universiti Malaya", "马来亚大学", "馬來亞大學"),
    shortName: "UM",
    logoUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/f/f9/University_of_Malaya_coat_of_arms.svg/200px-University_of_Malaya_coat_of_arms.svg.png",
    imageUrl: "https://images.unsplash.com/photo-1562774053-701939374585?w=1200&h=800&fit=crop",
    color: "#003DA5",
    qsRank: 60,
    qsAsiaRank: 12,
    location: t("Kuala Lumpur", "Kuala Lumpur", "吉隆坡", "吉隆坡"),
    region: t("Federal Territory of Kuala Lumpur", "Wilayah Persekutuan Kuala Lumpur", "吉隆坡联邦直辖区", "吉隆坡聯邦直轄區"),
    ownership: "public",
    institutionType: "research",
    foundedYear: 1905,
    students: 30000,
    intlStudents: 6200,
    csrCertified: true,
    description: t(
      "Malaysia's flagship research university with strong global recognition and a broad discipline portfolio.",
      "Universiti penyelidikan utama Malaysia dengan pengiktirafan global dan portfolio disiplin yang luas.",
      "马来西亚旗舰研究型大学，全球认可度高，学科覆盖广。",
      "馬來西亞旗艦研究型大學，全球認可度高，學科覆蓋廣。"
    ),
    website: "https://www.um.edu.my",
    admissionEmail: "study@um.edu.my",
    tuitionMinCny: 32000,
    tuitionMaxCny: 92000,
    livingCostCny: 30000,
    minIelts: 5.5,
    acceptNoLanguage: false,
    facilities: arr(
      ["Central library", "University medical centre", "Innovation hub"],
      ["Perpustakaan pusat", "Pusat perubatan universiti", "Hab inovasi"],
      ["总图书馆", "大学医疗中心", "创新中心"],
      ["總圖書館", "大學醫療中心", "創新中心"]
    ),
    highlights: arr(
      ["Top-ranked Malaysian university", "Research-intensive campus"],
      ["Universiti teratas Malaysia", "Kampus berintensif penyelidikan"],
      ["马来西亚排名领先", "研究型校区资源强"],
      ["馬來西亞排名領先", "研究型校區資源強"]
    )
  },
  {
    slug: "universiti-sains-malaysia",
    code: "USM",
    name: t("Universiti Sains Malaysia", "Universiti Sains Malaysia", "马来西亚理科大学", "馬來西亞理科大學"),
    shortName: "USM",
    logoUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/2/27/Universiti_Sains_Malaysia_logo.svg/200px-Universiti_Sains_Malaysia_logo.svg.png",
    imageUrl: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1200&h=800&fit=crop",
    color: "#6A1B9A",
    qsRank: 137,
    qsAsiaRank: 37,
    location: t("Penang", "Pulau Pinang", "槟城", "檳城"),
    region: t("Penang", "Pulau Pinang", "槟城州", "檳城州"),
    ownership: "public",
    institutionType: "research",
    foundedYear: 1969,
    students: 28000,
    intlStudents: 4200,
    csrCertified: true,
    description: t(
      "A public research university known for engineering, science, health disciplines and sustainability research.",
      "Universiti awam penyelidikan yang terkenal dalam kejuruteraan, sains, kesihatan dan penyelidikan kelestarian.",
      "以工程、理科、健康科学与可持续研究见长的公立研究型大学。",
      "以工程、理科、健康科學與永續研究見長的公立研究型大學。"
    ),
    website: "https://www.usm.my",
    admissionEmail: "admissions@usm.my",
    tuitionMinCny: 28000,
    tuitionMaxCny: 78000,
    livingCostCny: 26000,
    minIelts: 5.0,
    acceptNoLanguage: true,
    facilities: arr(
      ["Research labs", "Teaching hospital", "Student village"],
      ["Makmal penyelidikan", "Hospital pengajaran", "Kolej kediaman"],
      ["研究实验室", "教学医院", "学生宿舍区"],
      ["研究實驗室", "教學醫院", "學生宿舍區"]
    ),
    highlights: arr(
      ["Strong STEM disciplines", "Lower annual living cost than Klang Valley"],
      ["Disiplin STEM yang kuat", "Kos sara hidup lebih rendah berbanding Lembah Klang"],
      ["STEM 优势明显", "生活成本相对巴生谷更低"],
      ["STEM 優勢明顯", "生活成本相對巴生谷更低"]
    )
  },
  {
    slug: "taylors-university",
    code: "TAYLORS",
    name: t("Taylor's University", "Taylor's University", "泰莱大学", "泰萊大學"),
    shortName: "Taylor's",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Taylor%27s_University_Logo.svg/320px-Taylor%27s_University_Logo.svg.png",
    imageUrl: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1200&h=800&fit=crop",
    color: "#E91E63",
    qsRank: 253,
    qsAsiaRank: 41,
    location: t("Subang Jaya", "Subang Jaya", "梳邦再也", "梳邦再也"),
    region: t("Selangor", "Selangor", "雪兰莪州", "雪蘭莪州"),
    ownership: "private",
    institutionType: "comprehensive",
    foundedYear: 1969,
    students: 20000,
    intlStudents: 6000,
    csrCertified: true,
    description: t(
      "A leading private university in Malaysia with strong hospitality, business, design and computing pathways.",
      "Universiti swasta terkemuka di Malaysia dengan kekuatan dalam hospitaliti, perniagaan, reka bentuk dan pengkomputeran.",
      "马来西亚知名私立大学，在酒店管理、商科、设计和计算机方向表现突出。",
      "馬來西亞知名私立大學，在酒店管理、商科、設計和電腦方向表現突出。"
    ),
    website: "https://university.taylors.edu.my",
    admissionEmail: "admissions@taylors.edu.my",
    tuitionMinCny: 42000,
    tuitionMaxCny: 108000,
    livingCostCny: 32000,
    minIelts: 5.0,
    acceptNoLanguage: true,
    facilities: arr(
      ["Modern urban campus", "Industry-linked labs", "Career services"],
      ["Kampus bandar moden", "Makmal berorientasi industri", "Khidmat kerjaya"],
      ["现代化城市校区", "行业合作实验室", "职业服务中心"],
      ["現代化城市校區", "行業合作實驗室", "職涯服務中心"]
    ),
    highlights: arr(
      ["Private university with international articulation routes", "Strong employability focus"],
      ["Universiti swasta dengan laluan articulation antarabangsa", "Fokus kebolehpasaran graduan"],
      ["国际衔接路径丰富", "重视就业能力培养"],
      ["國際銜接路徑豐富", "重視就業能力培養"]
    )
  },
  {
    slug: "asia-pacific-university",
    code: "APU",
    name: t("Asia Pacific University of Technology & Innovation", "Asia Pacific University of Technology & Innovation", "亚太科技大学", "亞太科技大學"),
    shortName: "APU",
    logoUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/e/e4/Asia_Pacific_University_of_Technology_%26_Innovation_logo.png/240px-Asia_Pacific_University_of_Technology_%26_Innovation_logo.png",
    imageUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&h=800&fit=crop",
    color: "#0F766E",
    qsRank: 611,
    qsAsiaRank: 179,
    location: t("Kuala Lumpur", "Kuala Lumpur", "吉隆坡", "吉隆坡"),
    region: t("Bukit Jalil", "Bukit Jalil", "武吉加里尔", "武吉加里爾"),
    ownership: "private",
    institutionType: "applied",
    foundedYear: 1993,
    students: 13000,
    intlStudents: 12000,
    csrCertified: true,
    description: t(
      "A technology-focused private university known for computing, cybersecurity, AI and industry-oriented teaching.",
      "Universiti swasta berfokus teknologi yang terkenal dalam pengkomputeran, keselamatan siber, AI dan pengajaran berorientasikan industri.",
      "以计算机、网络安全、人工智能和产学结合见长的技术型私立大学。",
      "以電腦、網路安全、人工智慧與產學結合見長的技術型私立大學。"
    ),
    website: "https://www.apu.edu.my",
    admissionEmail: "info@apu.edu.my",
    tuitionMinCny: 38000,
    tuitionMaxCny: 90000,
    livingCostCny: 30000,
    minIelts: 5.0,
    acceptNoLanguage: true,
    facilities: arr(
      ["Cybersecurity labs", "Cloud and AI labs", "Industry project rooms"],
      ["Makmal keselamatan siber", "Makmal awan dan AI", "Ruang projek industri"],
      ["网络安全实验室", "云与 AI 实验室", "行业项目空间"],
      ["網路安全實驗室", "雲與 AI 實驗室", "行業專案空間"]
    ),
    highlights: arr(
      ["High international student ratio", "Popular for digital disciplines"],
      ["Nisbah pelajar antarabangsa tinggi", "Popular untuk disiplin digital"],
      ["国际学生比例高", "数字类专业热度高"],
      ["國際學生比例高", "數位類專業熱度高"]
    )
  },
  {
    slug: "monash-university-malaysia",
    code: "MONASH",
    name: t("Monash University Malaysia", "Monash University Malaysia", "莫纳什大学马来西亚校区", "莫納什大學馬來西亞校區"),
    shortName: "Monash Malaysia",
    logoUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/f/f7/Monash_University_logo.svg/320px-Monash_University_logo.svg.png",
    imageUrl: "https://images.unsplash.com/photo-1607237138185-eedd9c632b0b?w=1200&h=800&fit=crop",
    color: "#005EB8",
    qsRank: 42,
    qsAsiaRank: 8,
    location: t("Subang Jaya", "Subang Jaya", "梳邦再也", "梳邦再也"),
    region: t("Selangor", "Selangor", "雪兰莪州", "雪蘭莪州"),
    ownership: "private",
    institutionType: "research",
    foundedYear: 1998,
    students: 9000,
    intlStudents: 3500,
    csrCertified: true,
    description: t(
      "The Malaysian campus of Monash University, offering an Australian academic system with regional cost efficiency.",
      "Kampus Malaysia bagi Monash University yang menawarkan sistem akademik Australia dengan kos serantau yang lebih cekap.",
      "莫纳什大学海外校区，提供澳洲学术体系与更具区域成本优势的留学路径。",
      "莫納什大學海外校區，提供澳洲學術體系與更具區域成本優勢的留學路徑。"
    ),
    website: "https://www.monash.edu.my",
    admissionEmail: "future@monash.edu",
    tuitionMinCny: 68000,
    tuitionMaxCny: 130000,
    livingCostCny: 34000,
    minIelts: 6.0,
    acceptNoLanguage: false,
    facilities: arr(
      ["Research-ready campus", "Global mobility support", "Modern laboratories"],
      ["Kampus berfokus penyelidikan", "Sokongan mobiliti global", "Makmal moden"],
      ["研究型校区", "全球流动支持", "现代实验室"],
      ["研究型校區", "全球流動支持", "現代實驗室"]
    ),
    highlights: arr(
      ["Australian degree in Malaysia", "Strong progression to global Monash network"],
      ["Ijazah Australia di Malaysia", "Laluan kukuh ke rangkaian global Monash"],
      ["在马来西亚获得澳洲学位", "与 Monash 全球体系衔接强"],
      ["在馬來西亞獲得澳洲學位", "與 Monash 全球體系銜接強"]
    )
  }
  ,
  {
    slug: "universiti-putra-malaysia",
    code: "UPM",
    name: t("Universiti Putra Malaysia", "Universiti Putra Malaysia", "博特拉大学", "博特拉大學"),
    shortName: "UPM",
    logoUrl: "https://upload.wikimedia.org/wikipedia/en/b/b9/UPM_logo.png",
    imageUrl: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1200&h=800&fit=crop",
    color: "#006633",
    qsRank: 158,
    qsAsiaRank: 28,
    location: t("Serdang", "Serdang", "沙登", "沙登"),
    region: t("Selangor", "Selangor", "雪兰莪州", "雪蘭莪州"),
    ownership: "public",
    institutionType: "research",
    foundedYear: 1931,
    students: 28000,
    intlStudents: 5000,
    csrCertified: true,
    description: t(
      "UPM is one of Malaysia's research universities, with strong visibility in agriculture, food science, engineering and computing.",
      "UPM ialah salah satu universiti penyelidikan Malaysia yang menonjol dalam pertanian, sains makanan, kejuruteraan dan pengkomputeran.",
      "UPM 是马来西亚研究型大学之一，在农业、食品科学、工程和计算机领域优势明显。",
      "UPM 是馬來西亞研究型大學之一，在農業、食品科學、工程和電腦領域優勢明顯。"
    ),
    website: "https://www.upm.edu.my",
    admissionEmail: "intl@upm.edu.my",
    tuitionMinCny: 31000,
    tuitionMaxCny: 172000,
    livingCostCny: 22000,
    minIelts: 5.5,
    acceptNoLanguage: true,
    facilities: arr(
      ["Central library", "Teaching hospital", "Agricultural research park"],
      ["Perpustakaan pusat", "Hospital pengajaran", "Taman penyelidikan pertanian"],
      ["中央图书馆", "教学医院", "农业研究园"],
      ["中央圖書館", "教學醫院", "農業研究園"]
    ),
    highlights: arr(
      ["Research university", "Strong agriculture and food science", "Conditional route available"],
      ["Universiti penyelidikan", "Kuat dalam pertanian dan sains makanan", "Laluan conditional tersedia"],
      ["研究型大学", "农业与食品科学强校", "支持条件录取路径"],
      ["研究型大學", "農業與食品科學強校", "支援條件錄取路徑"]
    )
  },
  {
    slug: "universiti-kebangsaan-malaysia",
    code: "UKM",
    name: t("Universiti Kebangsaan Malaysia", "Universiti Kebangsaan Malaysia", "国民大学", "國民大學"),
    shortName: "UKM",
    logoUrl: "https://upload.wikimedia.org/wikipedia/en/3/3f/UKM_logo.svg",
    imageUrl: "https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?w=1200&h=800&fit=crop",
    color: "#A00000",
    qsRank: 159,
    qsAsiaRank: 30,
    location: t("Bangi", "Bangi", "万宜", "萬宜"),
    region: t("Selangor", "Selangor", "雪兰莪州", "雪蘭莪州"),
    ownership: "public",
    institutionType: "research",
    foundedYear: 1970,
    students: 27000,
    intlStudents: 3800,
    csrCertified: true,
    description: t(
      "UKM is a major public research university in Malaysia, recognised for medicine, health sciences, engineering and the social sciences.",
      "UKM ialah universiti penyelidikan awam utama di Malaysia yang terkenal dalam bidang perubatan, sains kesihatan, kejuruteraan dan sains sosial.",
      "UKM 是马来西亚重要的公立研究型大学，在医学、健康科学、工程与社会科学领域具有较强影响力。",
      "UKM 是馬來西亞重要的公立研究型大學，在醫學、健康科學、工程與社會科學領域具有較強影響力。"
    ),
    website: "https://www.ukm.my",
    admissionEmail: "international@ukm.my",
    tuitionMinCny: 25000,
    tuitionMaxCny: 88000,
    livingCostCny: 24000,
    minIelts: 6,
    acceptNoLanguage: false,
    facilities: arr(
      ["UKM Medical Centre", "Central library", "Engineering laboratories"],
      ["Pusat Perubatan UKM", "Perpustakaan pusat", "Makmal kejuruteraan"],
      ["UKM 医疗中心", "中央图书馆", "工程实验室"],
      ["UKM 醫療中心", "中央圖書館", "工程實驗室"]
    ),
    highlights: arr(
      ["Strong medical disciplines", "Research university", "Recognised public campus"],
      ["Bidang perubatan yang kukuh", "Universiti penyelidikan", "Kampus awam yang diiktiraf"],
      ["医学学科优势明显", "研究型大学", "认可度高的公立院校"],
      ["醫學學科優勢明顯", "研究型大學", "認可度高的公立院校"]
    )
  },
  {
    slug: "universiti-teknologi-malaysia",
    code: "UTM",
    name: t("Universiti Teknologi Malaysia", "Universiti Teknologi Malaysia", "马来西亚理工大学", "馬來西亞理工大學"),
    shortName: "UTM",
    logoUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/1/10/Utm_logo.png/100px-Utm_logo.png",
    imageUrl: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=1200&h=800&fit=crop",
    color: "#003087",
    qsRank: 191,
    qsAsiaRank: 32,
    location: t("Skudai", "Skudai", "士姑来", "士姑來"),
    region: t("Johor", "Johor", "柔佛州", "柔佛州"),
    ownership: "public",
    institutionType: "applied",
    foundedYear: 1904,
    students: 25000,
    intlStudents: 4800,
    csrCertified: true,
    description: t(
      "UTM is Malaysia's flagship technology university, especially known for engineering, digital technology and applied research.",
      "UTM ialah universiti teknologi utama Malaysia yang terkenal dalam kejuruteraan, teknologi digital dan penyelidikan gunaan.",
      "UTM 是马来西亚旗舰理工大学，在工程、数字技术和应用研究方面尤其突出。",
      "UTM 是馬來西亞旗艦理工大學，在工程、數位技術和應用研究方面尤其突出。"
    ),
    website: "https://www.utm.my",
    admissionEmail: "intoffice@utm.my",
    tuitionMinCny: 28000,
    tuitionMaxCny: 65000,
    livingCostCny: 20000,
    minIelts: 6,
    acceptNoLanguage: false,
    facilities: arr(
      ["Johor Bahru main campus", "Kuala Lumpur campus", "Advanced engineering labs"],
      ["Kampus utama Johor Bahru", "Kampus Kuala Lumpur", "Makmal kejuruteraan lanjutan"],
      ["新山主校区", "吉隆坡校区", "先进工程实验室"],
      ["新山主校區", "吉隆坡校區", "先進工程實驗室"]
    ),
    highlights: arr(
      ["Engineering-focused university", "Dual-campus system", "Strong industry collaboration"],
      ["Universiti berfokus kejuruteraan", "Sistem dua kampus", "Kerjasama industri yang kukuh"],
      ["工程强校", "双校区体系", "校企合作强"],
      ["工程強校", "雙校區體系", "校企合作強"]
    )
  },
  {
    slug: "sunway-university",
    code: "SUNWAY",
    name: t("Sunway University", "Sunway University", "双威大学", "雙威大學"),
    shortName: "Sunway",
    logoUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/a/ac/Sunway_University_Logo.svg/200px-Sunway_University_Logo.svg.png",
    imageUrl: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1200&h=800&fit=crop&hue=60",
    color: "#F7941D",
    qsRank: 401,
    qsAsiaRank: 88,
    location: t("Subang Jaya", "Subang Jaya", "梳邦再也", "梳邦再也"),
    region: t("Selangor", "Selangor", "雪兰莪州", "雪蘭莪州"),
    ownership: "private",
    institutionType: "comprehensive",
    foundedYear: 1987,
    students: 9000,
    intlStudents: 3000,
    csrCertified: true,
    description: t(
      "Sunway University is a leading private university in Selangor with strong business, computing and international partnership pathways.",
      "Sunway University ialah universiti swasta terkemuka di Selangor dengan kekuatan dalam perniagaan, pengkomputeran dan kerjasama antarabangsa.",
      "双威大学是雪兰莪领先的私立大学之一，在商科、计算机和国际合作路径方面较强。",
      "雙威大學是雪蘭莪領先的私立大學之一，在商科、電腦和國際合作路徑方面較強。"
    ),
    website: "https://university.sunway.edu.my",
    admissionEmail: "admissions@sunway.edu.my",
    tuitionMinCny: 38000,
    tuitionMaxCny: 75000,
    livingCostCny: 26000,
    minIelts: 5.5,
    acceptNoLanguage: false,
    facilities: arr(
      ["Integrated university city campus", "Bloomberg lab", "Modern IT labs"],
      ["Kampus bandar universiti bersepadu", "Makmal Bloomberg", "Makmal IT moden"],
      ["大学城一体化校区", "Bloomberg 实验室", "现代 IT 实验室"],
      ["大學城一體化校區", "Bloomberg 實驗室", "現代 IT 實驗室"]
    ),
    highlights: arr(
      ["Private university with Lancaster collaboration", "Strong business and computing", "Urban campus environment"],
      ["Universiti swasta dengan kerjasama Lancaster", "Kuat dalam perniagaan dan pengkomputeran", "Persekitaran kampus bandar"],
      ["与 Lancaster 合作", "商科与计算机强势", "城市型校区环境"],
      ["與 Lancaster 合作", "商科與電腦強勢", "城市型校區環境"]
    )
  },
  {
    slug: "ucsi-university",
    code: "UCSI",
    name: t("UCSI University", "UCSI University", "思特雅大学", "思特雅大學"),
    shortName: "UCSI",
    logoUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/6/65/UCSI_University_Logo.png/200px-UCSI_University_Logo.png",
    imageUrl: "https://images.unsplash.com/photo-1607237138185-eedd9c632b0b?w=1200&h=800&fit=crop&sat=-20",
    color: "#CC0000",
    qsRank: 521,
    qsAsiaRank: 110,
    location: t("Kuala Lumpur", "Kuala Lumpur", "吉隆坡", "吉隆坡"),
    region: t("Federal Territory of Kuala Lumpur", "Wilayah Persekutuan Kuala Lumpur", "吉隆坡联邦直辖区", "吉隆坡聯邦直轄區"),
    ownership: "private",
    institutionType: "comprehensive",
    foundedYear: 1986,
    students: 13000,
    intlStudents: 3500,
    csrCertified: true,
    description: t(
      "UCSI is a long-established private university in Kuala Lumpur with recognised strengths in business, medicine, nursing and creative disciplines.",
      "UCSI ialah universiti swasta lama di Kuala Lumpur dengan kekuatan dalam perniagaan, perubatan, kejururawatan dan bidang kreatif.",
      "UCSI 是吉隆坡成立较早的私立大学之一，在商科、医学、护理和创意类学科具有一定优势。",
      "UCSI 是吉隆坡成立較早的私立大學之一，在商科、醫學、護理和創意類學科具有一定優勢。"
    ),
    website: "https://www.ucsiuniversity.edu.my",
    admissionEmail: "international@ucsiuniversity.edu.my",
    tuitionMinCny: 28000,
    tuitionMaxCny: 80000,
    livingCostCny: 26000,
    minIelts: 5.5,
    acceptNoLanguage: true,
    facilities: arr(
      ["City campus", "Performance hall", "Medical and nursing labs"],
      ["Kampus bandar", "Dewan persembahan", "Makmal perubatan dan kejururawatan"],
      ["城市校区", "演艺厅", "医学与护理实验室"],
      ["城市校區", "演藝廳", "醫學與護理實驗室"]
    ),
    highlights: arr(
      ["Strong in applied disciplines", "Kuala Lumpur location", "Conditional route available"],
      ["Kuat dalam bidang gunaan", "Lokasi Kuala Lumpur", "Laluan conditional tersedia"],
      ["应用型学科较强", "位于吉隆坡市区", "支持条件录取路径"],
      ["應用型學科較強", "位於吉隆坡市區", "支援條件錄取路徑"]
    )
  }
];

const standardDocs = arr(
  ["Passport", "Academic transcript", "English score report", "Personal statement"],
  ["Pasport", "Transkrip akademik", "Keputusan bahasa Inggeris", "Pernyataan peribadi"],
  ["护照", "成绩单", "英语成绩单", "个人陈述"],
  ["護照", "成績單", "英語成績單", "個人陳述"]
);

export const seedPrograms: SeedProgram[] = [
  {
    universityCode: "UM",
    slug: "um-bachelor-business-administration",
    code: "UM-BBA",
    name: t("Bachelor of Business Administration (Hons)", "Ijazah Sarjana Muda Pentadbiran Perniagaan (Kepujian)", "工商管理学士（荣誉）", "工商管理學士（榮譽）"),
    level: "bachelor",
    category: "business",
    faculty: t("Faculty of Business and Economics", "Fakulti Perniagaan dan Ekonomi", "商科与经济学院", "商科與經濟學院"),
    durationYears: 3.5,
    annualTuitionCny: 33200,
    intakeMonths: ["March", "October"],
    languageRequirement: { ielts: 5.5, toefl: 46, pte: 51, muet: 4 },
    requirement: { gpa: 3.3, gaokaoRequired: false, huikaoRequired: false, note: t("High school average 80% or equivalent.", "Purata sekolah menengah 80% atau setara.", "高中均分建议 80% 以上。", "高中均分建議 80% 以上。") },
    applicationDocs: standardDocs,
    curriculum: arr(["Management", "Marketing", "Accounting", "Operations"],["Pengurusan", "Pemasaran", "Perakaunan", "Operasi"],["管理学", "市场营销", "会计学", "运营管理"],["管理學", "市場行銷", "會計學", "營運管理"]),
    careers: arr(["Business analyst", "Marketing manager", "Operations executive"],["Penganalisis perniagaan", "Pengurus pemasaran", "Eksekutif operasi"],["商业分析师", "市场经理", "运营岗位"],["商業分析師", "市場經理", "營運崗位"]),
    specializations: arr(["Management", "Marketing"],["Pengurusan", "Pemasaran"],["管理方向", "营销方向"],["管理方向", "行銷方向"]),
    description: t("AACSB-accredited business pathway with strong employer recognition.", "Laluan perniagaan bertauliah AACSB dengan pengiktirafan majikan yang kukuh.", "AACSB 认证商科路径，就业认可度高。", "AACSB 認證商科路徑，就業認可度高。")
  },
  {
    universityCode: "UM",
    slug: "um-bachelor-computer-science-ai",
    code: "UM-BCS-AI",
    name: t("Bachelor of Computer Science (Artificial Intelligence)", "Ijazah Sarjana Muda Sains Komputer (Kecerdasan Buatan)", "计算机科学学士（人工智能）", "電腦科學學士（人工智慧）"),
    level: "bachelor",
    category: "it",
    faculty: t("Faculty of Computer Science and Information Technology", "Fakulti Sains Komputer dan Teknologi Maklumat", "计算机科学与信息技术学院", "電腦科學與資訊科技學院"),
    durationYears: 3.5,
    annualTuitionCny: 38500,
    intakeMonths: ["October"],
    languageRequirement: { ielts: 5.5, toefl: 46, pte: 51, muet: 4 },
    requirement: { gpa: 3.0, gaokaoRequired: false, huikaoRequired: false, note: t("Strong mathematics background is recommended.", "Latar belakang matematik yang kukuh digalakkan.", "建议具备较强数学基础。", "建議具備較強數學基礎。") },
    applicationDocs: standardDocs,
    curriculum: arr(["Programming", "Machine learning", "Computer vision", "Data structures"],["Pengaturcaraan", "Pembelajaran mesin", "Visi komputer", "Struktur data"],["程序设计", "机器学习", "计算机视觉", "数据结构"],["程式設計", "機器學習", "電腦視覺", "資料結構"]),
    careers: arr(["AI engineer", "ML engineer", "Data scientist"],["Jurutera AI", "Jurutera ML", "Saintis data"],["AI 工程师", "机器学习工程师", "数据科学家"],["AI 工程師", "機器學習工程師", "資料科學家"]),
    specializations: arr(["AI systems", "Intelligent applications"],["Sistem AI", "Aplikasi pintar"],["AI 系统", "智能应用"],["AI 系統", "智慧應用"]),
    description: t("A research-oriented AI track under one of Malaysia's strongest computing faculties.", "Laluan AI berorientasikan penyelidikan di bawah salah satu fakulti pengkomputeran terkuat di Malaysia.", "马来西亚顶尖计算机学院下的研究型 AI 方向。", "馬來西亞頂尖電腦學院下的研究型 AI 方向。")
  },  {
    universityCode: "USM",
    slug: "usm-master-data-science-analytics",
    code: "USM-MDSA",
    name: t("Master of Data Science and Analytics", "Sarjana Sains Data dan Analitik", "数据科学与分析硕士", "資料科學與分析碩士"),
    level: "master",
    category: "it",
    faculty: t("School of Computer Sciences", "Pusat Pengajian Sains Komputer", "计算机科学学院", "電腦科學學院"),
    durationYears: 1.5,
    annualTuitionCny: 36000,
    intakeMonths: ["February", "September"],
    languageRequirement: { ielts: 5.0, toefl: 42, pte: 47, muet: 3 },
    requirement: { gpa: 2.75, gaokaoRequired: false, huikaoRequired: false, note: t("A computing or quantitative background is preferred.", "Latar belakang pengkomputeran atau kuantitatif diutamakan.", "优先考虑计算机或量化背景。", "優先考慮電腦或量化背景。") },
    applicationDocs: standardDocs,
    curriculum: arr(["Data mining", "Statistical modelling", "Big data processing"],["Perlombongan data", "Pemodelan statistik", "Pemprosesan data raya"],["数据挖掘", "统计建模", "大数据处理"],["資料探勘", "統計建模", "大數據處理"]),
    careers: arr(["Data analyst", "BI specialist", "Data engineer"],["Penganalisis data", "Pakar BI", "Jurutera data"],["数据分析师", "BI 专员", "数据工程师"],["資料分析師", "BI 專員", "資料工程師"]),
    specializations: arr(["Analytics", "Machine learning"],["Analitik", "Pembelajaran mesin"],["分析方向", "机器学习方向"],["分析方向", "機器學習方向"]),
    description: t("An applied postgraduate programme for students targeting data roles with moderate entry thresholds.", "Program pascasiswazah berorientasikan aplikasi untuk pelajar yang menyasar kerjaya data dengan syarat kemasukan sederhana.", "面向数据岗位的应用型硕士，入学门槛相对友好。", "面向資料職位的應用型碩士，入學門檻相對友善。")
  },
  {
    universityCode: "TAYLORS",
    slug: "taylors-bachelor-hospitality-management",
    code: "TAY-BHM",
    name: t("Bachelor of International Hospitality Management", "Ijazah Sarjana Muda Pengurusan Hospitaliti Antarabangsa", "国际酒店管理学士", "國際酒店管理學士"),
    level: "bachelor",
    category: "business",
    faculty: t("School of Hospitality, Tourism and Events", "Sekolah Hospitaliti, Pelancongan dan Acara", "酒店、旅游与会展学院", "酒店、旅遊與會展學院"),
    durationYears: 3,
    annualTuitionCny: 51000,
    intakeMonths: ["January", "April", "September"],
    languageRequirement: { ielts: 5.0, toefl: 40, pte: 47, muet: 3 },
    requirement: { gpa: 2.7, gaokaoRequired: false, huikaoRequired: false, note: t("Suitable for students targeting service and management industries.", "Sesuai untuk pelajar yang menyasar industri perkhidmatan dan pengurusan.", "适合服务业与管理方向申请者。", "適合服務業與管理方向申請者。") },
    applicationDocs: standardDocs,
    curriculum: arr(["Hospitality operations", "Revenue management", "Event planning"],["Operasi hospitaliti", "Pengurusan hasil", "Perancangan acara"],["酒店运营", "收益管理", "会展策划"],["酒店營運", "收益管理", "會展策劃"]),
    careers: arr(["Hotel management trainee", "Guest experience manager", "Event specialist"],["Pelatih pengurusan hotel", "Pengurus pengalaman pelanggan", "Pakar acara"],["酒店管理培训生", "客户体验经理", "会展专员"],["酒店管理培訓生", "客戶體驗經理", "會展專員"]),
    specializations: arr(["Hospitality", "Events"],["Hospitaliti", "Acara"],["酒店方向", "会展方向"],["酒店方向", "會展方向"]),
    description: t("A high-visibility private programme with strong industry internships and service training.", "Program swasta berprofil tinggi dengan latihan industri yang kukuh.", "行业实习资源丰富的高辨识度私立项目。", "行業實習資源豐富的高辨識度私立項目。")
  },
  {
    universityCode: "TAYLORS",
    slug: "taylors-master-international-business",
    code: "TAY-MIB",
    name: t("Master in International Business", "Sarjana Perniagaan Antarabangsa", "国际商务硕士", "國際商務碩士"),
    level: "master",
    category: "business",
    faculty: t("Taylor's Business School", "Taylor's Business School", "泰莱商学院", "泰萊商學院"),
    durationYears: 1.5,
    annualTuitionCny: 46000,
    intakeMonths: ["January", "May", "September"],
    languageRequirement: { ielts: 5.0, toefl: 40, pte: 47, muet: 3 },
    requirement: { gpa: 2.5, gaokaoRequired: false, huikaoRequired: false, note: t("Applicants with non-business backgrounds may still apply.", "Pemohon dari latar belakang bukan perniagaan juga boleh memohon.", "非商科背景也可申请。", "非商科背景也可申請。") },
    applicationDocs: standardDocs,
    curriculum: arr(["Global strategy", "International marketing", "Cross-border management"],["Strategi global", "Pemasaran antarabangsa", "Pengurusan rentas sempadan"],["全球战略", "国际营销", "跨境管理"],["全球策略", "國際行銷", "跨境管理"]),
    careers: arr(["International business executive", "Market expansion manager"],["Eksekutif perniagaan antarabangsa", "Pengurus pengembangan pasaran"],["国际业务专员", "市场拓展经理"],["國際業務專員", "市場拓展經理"]),
    specializations: arr(["Trade strategy", "Regional business"],["Strategi perdagangan", "Perniagaan serantau"],["贸易策略", "区域业务"],["貿易策略", "區域業務"]),
    description: t("Flexible private postgraduate business pathway with multiple intakes each year.", "Laluan pascasiswazah perniagaan swasta yang fleksibel dengan beberapa pengambilan setiap tahun.", "多次开学、节奏灵活的私立商科硕士路径。", "多次開學、節奏靈活的私立商科碩士路徑。")
  },
  {
    universityCode: "APU",
    slug: "apu-bachelor-cyber-security",
    code: "APU-BCS-CS",
    name: t("Bachelor of Computer Science (Cyber Security)", "Ijazah Sarjana Muda Sains Komputer (Keselamatan Siber)", "计算机科学学士（网络安全）", "電腦科學學士（網路安全）"),
    level: "bachelor",
    category: "it",
    faculty: t("School of Computing", "School of Computing", "计算机学院", "電腦學院"),
    durationYears: 3,
    annualTuitionCny: 43800,
    intakeMonths: ["March", "July", "November"],
    languageRequirement: { ielts: 5.0, toefl: 40, pte: 47, muet: 3 },
    requirement: { gpa: 2.7, gaokaoRequired: false, huikaoRequired: false, note: t("Mathematics is recommended but conditional support is available.", "Matematik digalakkan namun sokongan conditional tersedia.", "建议具备数学基础，也支持条件录取路径。", "建議具備數學基礎，也支援條件錄取路徑。") },
    applicationDocs: standardDocs,
    curriculum: arr(["Network security", "Digital forensics", "Ethical hacking"],["Keselamatan rangkaian", "Forensik digital", "Penggodaman beretika"],["网络安全", "数字取证", "渗透测试"],["網路安全", "數位鑑識", "滲透測試"]),
    careers: arr(["Cybersecurity analyst", "SOC engineer", "Security consultant"],["Penganalisis keselamatan siber", "Jurutera SOC", "Perunding keselamatan"],["网络安全分析师", "SOC 工程师", "安全顾问"],["網路安全分析師", "SOC 工程師", "安全顧問"]),
    specializations: arr(["Security operations", "Digital forensics"],["Operasi keselamatan", "Forensik digital"],["安全运营", "数字取证"],["安全營運", "數位鑑識"]),
    description: t("Industry-facing cybersecurity undergraduate programme with frequent intakes.", "Program sarjana muda keselamatan siber berorientasikan industri dengan pengambilan kerap.", "面向行业实践、开学频次高的网络安全本科项目。", "面向行業實踐、開學頻次高的網路安全本科項目。")
  },
  {
    universityCode: "APU",
    slug: "apu-master-artificial-intelligence",
    code: "APU-MAI",
    name: t("Master of Science in Artificial Intelligence", "Sarjana Sains dalam Kecerdasan Buatan", "人工智能理学硕士", "人工智慧理學碩士"),
    level: "master",
    category: "it",
    faculty: t("School of Computing", "School of Computing", "计算机学院", "電腦學院"),
    durationYears: 1.5,
    annualTuitionCny: 52000,
    intakeMonths: ["May", "September", "December"],
    languageRequirement: { ielts: 5.0, toefl: 40, pte: 47, muet: 3 },
    requirement: { gpa: 2.5, gaokaoRequired: false, huikaoRequired: false, note: t("Open to computing and closely related quantitative degrees.", "Terbuka kepada graduan pengkomputeran dan bidang kuantitatif yang berkaitan.", "面向计算机及相关量化背景。", "面向電腦及相關量化背景。") },
    applicationDocs: standardDocs,
    curriculum: arr(["Deep learning", "NLP", "Computer vision"],["Pembelajaran mendalam", "NLP", "Visi komputer"],["深度学习", "自然语言处理", "计算机视觉"],["深度學習", "自然語言處理", "電腦視覺"]),
    careers: arr(["AI engineer", "Applied data scientist", "Intelligent product analyst"],["Jurutera AI", "Saintis data gunaan", "Penganalisis produk pintar"],["AI 工程师", "应用数据科学家", "智能产品分析师"],["AI 工程師", "應用資料科學家", "智慧產品分析師"]),
    specializations: arr(["Applied AI", "Machine learning"],["AI gunaan", "Pembelajaran mesin"],["应用 AI", "机器学习"],["應用 AI", "機器學習"]),
    description: t("A professional AI master's programme emphasising project delivery and industry tooling.", "Program sarjana AI profesional yang menekankan penyampaian projek dan alatan industri.", "强调项目交付和行业工具链的职业型 AI 硕士。", "強調專案交付和行業工具鏈的職業型 AI 碩士。")
  },
  {
    universityCode: "MONASH",
    slug: "monash-bachelor-pharmacy",
    code: "MON-BPHARM",
    name: t("Bachelor of Pharmacy (Honours)", "Ijazah Sarjana Muda Farmasi (Kepujian)", "药学学士（荣誉）", "藥學學士（榮譽）"),
    level: "bachelor",
    category: "medicine",
    faculty: t("School of Pharmacy", "School of Pharmacy", "药学院", "藥學院"),
    durationYears: 4,
    annualTuitionCny: 118000,
    intakeMonths: ["February"],
    languageRequirement: { ielts: 6.5, toefl: 79, pte: 58, muet: 4 },
    requirement: { gpa: 3.4, gaokaoRequired: false, huikaoRequired: false, note: t("Competitive entry with chemistry and biology readiness expected.", "Kemasukan kompetitif dengan keperluan kimia dan biologi yang kukuh.", "录取竞争较强，建议具备化学与生物基础。", "錄取競爭較強，建議具備化學與生物基礎。") },
    applicationDocs: standardDocs,
    curriculum: arr(["Pharmacology", "Clinical pharmacy", "Medicinal chemistry"],["Farmakologi", "Farmasi klinikal", "Kimia perubatan"],["药理学", "临床药学", "药物化学"],["藥理學", "臨床藥學", "藥物化學"]),
    careers: arr(["Pharmacist", "Clinical support specialist", "Regulatory affairs executive"],["Ahli farmasi", "Pakar sokongan klinikal", "Eksekutif hal ehwal regulatori"],["药剂师", "临床支持岗位", "注册事务专员"],["藥劑師", "臨床支援崗位", "註冊事務專員"]),
    specializations: arr(["Clinical pharmacy", "Community pharmacy"],["Farmasi klinikal", "Farmasi komuniti"],["临床药学", "社区药学"],["臨床藥學", "社區藥學"]),
    description: t("Premium international pharmacy route with Monash academic standards.", "Laluan farmasi antarabangsa premium dengan standard akademik Monash.", "按照 Monash 学术标准打造的高端药学路径。", "按照 Monash 學術標準打造的高端藥學路徑。")
  },
  {
    universityCode: "MONASH",
    slug: "monash-master-business-analytics",
    code: "MON-MBAA",
    name: t("Master of Business Analytics", "Sarjana Analitik Perniagaan", "商业分析硕士", "商業分析碩士"),
    level: "master",
    category: "business",
    faculty: t("School of Business", "School of Business", "商学院", "商學院"),
    durationYears: 1.5,
    annualTuitionCny: 92000,
    intakeMonths: ["February", "July", "October"],
    languageRequirement: { ielts: 6.5, toefl: 79, pte: 58, muet: 4 },
    requirement: { gpa: 3.0, gaokaoRequired: false, huikaoRequired: false, note: t("Suitable for applicants with quantitative or business backgrounds.", "Sesuai untuk pemohon dengan latar kuantitatif atau perniagaan.", "适合量化或商科背景申请者。", "適合量化或商科背景申請者。") },
    applicationDocs: standardDocs,
    curriculum: arr(["Business intelligence", "Predictive analytics", "Decision modelling"],["Kecerdasan perniagaan", "Analitik ramalan", "Pemodelan keputusan"],["商业智能", "预测分析", "决策建模"],["商業智慧", "預測分析", "決策建模"]),
    careers: arr(["Business analyst", "Analytics consultant", "Strategy analyst"],["Penganalisis perniagaan", "Perunding analitik", "Penganalisis strategi"],["商业分析师", "分析咨询顾问", "战略分析师"],["商業分析師", "分析顧問", "策略分析師"]),
    specializations: arr(["Analytics strategy", "Data-driven operations"],["Strategi analitik", "Operasi dipacu data"],["分析战略", "数据驱动运营"],["分析策略", "資料驅動營運"]),
    description: t("International business analytics programme aligned with Monash's broader academic network.", "Program analitik perniagaan antarabangsa yang sejajar dengan rangkaian akademik Monash.", "与 Monash 全球体系衔接的国际化商业分析硕士。", "與 Monash 全球體系銜接的國際化商業分析碩士。")
  }

  ,
  {
    universityCode: "UPM",
    slug: "upm-bachelor-software-engineering",
    code: "UPM-BSE",
    name: t("Bachelor of Software Engineering (Hons)", "Ijazah Sarjana Muda Kejuruteraan Perisian (Kepujian)", "软件工程学士（荣誉）", "軟體工程學士（榮譽）"),
    level: "bachelor",
    category: "it",
    faculty: t("Faculty of Computer Science and Information Technology", "Fakulti Sains Komputer dan Teknologi Maklumat", "计算机科学与信息技术学院", "電腦科學與資訊科技學院"),
    durationYears: 4,
    annualTuitionCny: 34400,
    intakeMonths: ["January", "June", "September"],
    languageRequirement: { ielts: 5.5, toefl: 70, pte: 42, muet: 3 },
    requirement: { gpa: 2.8, gaokaoRequired: true, huikaoRequired: false, note: t("Mathematics background is expected.", "Latar belakang matematik diperlukan.", "建议具备数学背景。", "建議具備數學背景。") },
    applicationDocs: standardDocs,
    curriculum: arr(["Software design", "Database systems", "Web engineering", "Testing"],["Reka bentuk perisian", "Sistem pangkalan data", "Kejuruteraan web", "Pengujian"],["软件设计", "数据库系统", "Web 工程", "软件测试"],["軟體設計", "資料庫系統", "Web 工程", "軟體測試"]),
    careers: arr(["Software engineer", "System analyst", "Web engineer"],["Jurutera perisian", "Penganalisis sistem", "Jurutera web"],["软件工程师", "系统分析师", "Web 工程师"],["軟體工程師", "系統分析師", "Web 工程師"]),
    specializations: arr(["Applied software", "Project delivery"],["Perisian gunaan", "Penyampaian projek"],["应用软件", "项目交付"],["應用軟體", "專案交付"]),
    description: t("A representative UPM computing programme with public-university pricing and practical software training.", "Program pengkomputeran UPM dengan yuran universiti awam dan latihan perisian praktikal.", "具备公立大学成本优势和实践导向的软件工程项目。", "具備公立大學成本優勢和實踐導向的軟體工程項目。")
  },
  {
    universityCode: "UPM",
    slug: "upm-bachelor-business-administration",
    code: "UPM-BBA",
    name: t("Bachelor of Business Administration (Hons)", "Ijazah Sarjana Muda Pentadbiran Perniagaan (Kepujian)", "工商管理学士（荣誉）", "工商管理學士（榮譽）"),
    level: "bachelor",
    category: "business",
    faculty: t("Faculty of Economics and Management", "Fakulti Ekonomi dan Pengurusan", "经济与管理学院", "經濟與管理學院"),
    durationYears: 4,
    annualTuitionCny: 30960,
    intakeMonths: ["January", "September"],
    languageRequirement: { ielts: 5.5, toefl: 70, pte: 42, muet: 3 },
    requirement: { gpa: 2.8, gaokaoRequired: true, huikaoRequired: false, note: t("Suitable for applicants targeting management pathways.", "Sesuai untuk pemohon yang menyasar laluan pengurusan.", "适合管理方向申请者。", "適合管理方向申請者。") },
    applicationDocs: standardDocs,
    curriculum: arr(["Management", "Marketing", "Finance", "Entrepreneurship"],["Pengurusan", "Pemasaran", "Kewangan", "Keusahawanan"],["管理学", "市场营销", "财务管理", "创业"],["管理學", "市場行銷", "財務管理", "創業"]),
    careers: arr(["Management trainee", "Marketing executive", "Business coordinator"],["Pelatih pengurusan", "Eksekutif pemasaran", "Penyelaras perniagaan"],["管理培训生", "市场专员", "业务协调岗位"],["管理培訓生", "市場專員", "業務協調崗位"]),
    specializations: arr(["Business operations", "Marketing"],["Operasi perniagaan", "Pemasaran"],["商业运营", "营销"],["商業營運", "行銷"]),
    description: t("UPM's business administration route is a cost-conscious public option for students targeting management careers.", "Laluan pentadbiran perniagaan UPM ialah pilihan awam yang menjimatkan kos untuk kerjaya pengurusan.", "适合追求管理职业且看重性价比的公立商科项目。", "適合追求管理職業且看重性價比的公立商科項目。")
  },
  {
    universityCode: "UKM",
    slug: "ukm-bachelor-computer-science",
    code: "UKM-BCS",
    name: t("Bachelor of Computer Science (Hons)", "Ijazah Sarjana Muda Sains Komputer (Kepujian)", "计算机科学学士（荣誉）", "電腦科學學士（榮譽）"),
    level: "bachelor",
    category: "it",
    faculty: t("Faculty of Information Science and Technology", "Fakulti Teknologi dan Sains Maklumat", "信息科学与技术学院", "資訊科學與技術學院"),
    durationYears: 4,
    annualTuitionCny: 36000,
    intakeMonths: ["June", "September"],
    languageRequirement: { ielts: 6, toefl: 80, pte: 50, muet: 4 },
    requirement: { gpa: 3, gaokaoRequired: true, huikaoRequired: false, note: t("A solid mathematics foundation is preferred.", "Asas matematik yang kukuh diutamakan.", "建议具备扎实数学基础。", "建議具備紮實數學基礎。") },
    applicationDocs: standardDocs,
    curriculum: arr(["Algorithms", "Software engineering", "AI", "Cloud computing"],["Algoritma", "Kejuruteraan perisian", "AI", "Pengkomputeran awan"],["算法", "软件工程", "人工智能", "云计算"],["演算法", "軟體工程", "人工智慧", "雲端運算"]),
    careers: arr(["Software engineer", "Data analyst", "IT consultant"],["Jurutera perisian", "Penganalisis data", "Perunding IT"],["软件工程师", "数据分析师", "IT 顾问"],["軟體工程師", "資料分析師", "IT 顧問"]),
    specializations: arr(["Software systems", "Applied AI"],["Sistem perisian", "AI gunaan"],["软件系统", "应用 AI"],["軟體系統", "應用 AI"]),
    description: t("A public research-university computing programme with balanced tuition and technical depth.", "Program pengkomputeran universiti penyelidikan awam dengan yuran seimbang dan kedalaman teknikal.", "兼顾技术深度与成本控制的公立研究型计算机项目。", "兼顧技術深度與成本控制的公立研究型電腦項目。")
  },
  {
    universityCode: "UKM",
    slug: "ukm-mbbs",
    code: "UKM-MBBS",
    name: t("Bachelor of Medicine, Bachelor of Surgery (MBBS)", "Ijazah Sarjana Muda Perubatan dan Pembedahan (MBBS)", "医学学士与外科学士（MBBS）", "醫學學士與外科學士（MBBS）"),
    level: "bachelor",
    category: "medicine",
    faculty: t("Faculty of Medicine", "Fakulti Perubatan", "医学院", "醫學院"),
    durationYears: 5,
    annualTuitionCny: 88000,
    intakeMonths: ["September"],
    languageRequirement: { ielts: 7, toefl: 100, pte: 65, muet: 5 },
    requirement: { gpa: 3.8, gaokaoRequired: false, huikaoRequired: false, note: t("Competitive science results and interview readiness are required.", "Keputusan sains yang kompetitif dan kesiapsiagaan temu duga diperlukan.", "需要较强理科成绩并通过面试。", "需要較強理科成績並通過面試。") },
    applicationDocs: standardDocs,
    curriculum: arr(["Basic medical sciences", "Clinical rotations", "Emergency medicine", "Community medicine"],["Sains perubatan asas", "Rotasi klinikal", "Perubatan kecemasan", "Perubatan komuniti"],["基础医学", "临床轮转", "急诊医学", "社区医学"],["基礎醫學", "臨床輪轉", "急診醫學", "社區醫學"]),
    careers: arr(["Medical officer", "Clinical doctor", "Public health pathway"],["Pegawai perubatan", "Doktor klinikal", "Laluan kesihatan awam"],["住院医师", "临床医生", "公共卫生方向"],["住院醫師", "臨床醫生", "公共衛生方向"]),
    specializations: arr(["Clinical medicine", "Hospital training"],["Perubatan klinikal", "Latihan hospital"],["临床医学", "医院训练"],["臨床醫學", "醫院訓練"]),
    description: t("One of the representative public medical programmes in Malaysia with strong hospital integration.", "Salah satu program perubatan awam wakil di Malaysia dengan integrasi hospital yang kukuh.", "马来西亚具有代表性的公立医学项目之一，与医院体系衔接紧密。", "馬來西亞具有代表性的公立醫學項目之一，與醫院體系銜接緊密。")
  },
  {
    universityCode: "UTM",
    slug: "utm-bachelor-computer-science",
    code: "UTM-BCS",
    name: t("Bachelor of Computer Science (Hons)", "Ijazah Sarjana Muda Sains Komputer (Kepujian)", "计算机科学学士（荣誉）", "電腦科學學士（榮譽）"),
    level: "bachelor",
    category: "it",
    faculty: t("Faculty of Computing", "Fakulti Komputeran", "计算学院", "計算學院"),
    durationYears: 4,
    annualTuitionCny: 34000,
    intakeMonths: ["February", "September"],
    languageRequirement: { ielts: 6, toefl: 80, pte: 50, muet: 4 },
    requirement: { gpa: 2.75, gaokaoRequired: true, huikaoRequired: false, note: t("Good quantitative readiness is recommended.", "Kesediaan kuantitatif yang baik digalakkan.", "建议具备较好数理基础。", "建議具備較好數理基礎。") },
    applicationDocs: standardDocs,
    curriculum: arr(["Algorithms", "Data science", "Software engineering", "Cybersecurity"],["Algoritma", "Sains data", "Kejuruteraan perisian", "Keselamatan siber"],["算法", "数据科学", "软件工程", "网络安全"],["演算法", "資料科學", "軟體工程", "網路安全"]),
    careers: arr(["Software engineer", "Systems engineer", "Security analyst"],["Jurutera perisian", "Jurutera sistem", "Penganalisis keselamatan"],["软件工程师", "系统工程师", "安全分析师"],["軟體工程師", "系統工程師", "安全分析師"]),
    specializations: arr(["Computing systems", "Applied data"],["Sistem pengkomputeran", "Data gunaan"],["计算系统", "应用数据"],["計算系統", "應用資料"]),
    description: t("UTM's computing pathway reflects the university's technology orientation and strong engineering environment.", "Laluan pengkomputeran UTM mencerminkan orientasi teknologi universiti dan persekitaran kejuruteraan yang kukuh.", "UTM 计算机项目延续了学校鲜明的理工取向和工程环境。", "UTM 電腦項目延續了學校鮮明的理工取向和工程環境。")
  },
  {
    universityCode: "UTM",
    slug: "utm-bachelor-civil-engineering",
    code: "UTM-BCE",
    name: t("Bachelor of Civil Engineering (Hons)", "Ijazah Sarjana Muda Kejuruteraan Awam (Kepujian)", "土木工程学士（荣誉）", "土木工程學士（榮譽）"),
    level: "bachelor",
    category: "engineering",
    faculty: t("Faculty of Civil Engineering", "Fakulti Kejuruteraan Awam", "土木工程学院", "土木工程學院"),
    durationYears: 4,
    annualTuitionCny: 36000,
    intakeMonths: ["February", "September"],
    languageRequirement: { ielts: 6, toefl: 80, pte: 50, muet: 4 },
    requirement: { gpa: 3, gaokaoRequired: true, huikaoRequired: false, note: t("Physics and mathematics background is expected.", "Latar belakang fizik dan matematik diperlukan.", "建议具备物理和数学背景。", "建議具備物理和數學背景。") },
    applicationDocs: standardDocs,
    curriculum: arr(["Structural analysis", "Soil mechanics", "Transportation engineering", "Project management"],["Analisis struktur", "Mekanik tanah", "Kejuruteraan pengangkutan", "Pengurusan projek"],["结构分析", "土力学", "交通工程", "项目管理"],["結構分析", "土力學", "交通工程", "專案管理"]),
    careers: arr(["Civil engineer", "Structural engineer", "Project engineer"],["Jurutera awam", "Jurutera struktur", "Jurutera projek"],["土木工程师", "结构工程师", "项目工程师"],["土木工程師", "結構工程師", "專案工程師"]),
    specializations: arr(["Infrastructure", "Structures"],["Infrastruktur", "Struktur"],["基础设施", "结构方向"],["基礎設施", "結構方向"]),
    description: t("A core engineering route at UTM, fitting students who prioritise traditional engineering strength.", "Laluan kejuruteraan teras di UTM untuk pelajar yang mengutamakan kekuatan kejuruteraan tradisional.", "适合看重传统工科实力的 UTM 核心工程项目。", "適合看重傳統工科實力的 UTM 核心工程項目。")
  },
  {
    universityCode: "SUNWAY",
    slug: "sunway-bachelor-business",
    code: "SUN-BBUS",
    name: t("Bachelor of Business (Hons)", "Ijazah Sarjana Muda Perniagaan (Kepujian)", "商学学士（荣誉）", "商學學士（榮譽）"),
    level: "bachelor",
    category: "business",
    faculty: t("Sunway Business School", "Sunway Business School", "双威商学院", "雙威商學院"),
    durationYears: 3,
    annualTuitionCny: 52000,
    intakeMonths: ["January", "May", "September"],
    languageRequirement: { ielts: 6, toefl: 80, pte: 50, muet: 4 },
    requirement: { gpa: 2.5, gaokaoRequired: true, huikaoRequired: false, note: t("Suitable for broad business-entry applicants.", "Sesuai untuk pemohon kemasukan perniagaan umum.", "适合综合型商科申请者。", "適合綜合型商科申請者。") },
    applicationDocs: standardDocs,
    curriculum: arr(["Business principles", "Marketing", "Finance", "Innovation"],["Prinsip perniagaan", "Pemasaran", "Kewangan", "Inovasi"],["商业原理", "市场营销", "金融", "创新"],["商業原理", "市場行銷", "金融", "創新"]),
    careers: arr(["Business executive", "Marketing executive", "Entrepreneurship roles"],["Eksekutif perniagaan", "Eksekutif pemasaran", "Peranan keusahawanan"],["商务专员", "市场专员", "创业方向岗位"],["商務專員", "市場專員", "創業方向崗位"]),
    specializations: arr(["Business operations", "Marketing"],["Operasi perniagaan", "Pemasaran"],["商业运营", "营销"],["商業營運", "行銷"]),
    description: t("A private business programme in an urban integrated campus with strong international exposure.", "Program perniagaan swasta di kampus bandar bersepadu dengan pendedahan antarabangsa yang kukuh.", "位于城市型大学城、国际化程度较高的私立商科项目。", "位於城市型大學城、國際化程度較高的私立商科項目。")
  },
  {
    universityCode: "SUNWAY",
    slug: "sunway-bachelor-computer-science",
    code: "SUN-BCS",
    name: t("Bachelor of Science in Computer Science (Hons)", "Ijazah Sarjana Muda Sains dalam Sains Komputer (Kepujian)", "计算机科学理学学士（荣誉）", "電腦科學理學學士（榮譽）"),
    level: "bachelor",
    category: "it",
    faculty: t("School of Engineering and Technology", "School of Engineering and Technology", "工程与技术学院", "工程與技術學院"),
    durationYears: 3,
    annualTuitionCny: 56000,
    intakeMonths: ["January", "May", "September"],
    languageRequirement: { ielts: 6, toefl: 80, pte: 50, muet: 4 },
    requirement: { gpa: 2.5, gaokaoRequired: true, huikaoRequired: false, note: t("Mathematics readiness is recommended.", "Kesiapsiagaan matematik digalakkan.", "建议具备数学基础。", "建議具備數學基礎。") },
    applicationDocs: standardDocs,
    curriculum: arr(["Programming", "AI", "Database systems", "Cloud computing"],["Pengaturcaraan", "AI", "Sistem pangkalan data", "Pengkomputeran awan"],["编程", "人工智能", "数据库系统", "云计算"],["程式設計", "人工智慧", "資料庫系統", "雲端運算"]),
    careers: arr(["Software engineer", "Data analyst", "IT consultant"],["Jurutera perisian", "Penganalisis data", "Perunding IT"],["软件工程师", "数据分析师", "IT 顾问"],["軟體工程師", "資料分析師", "IT 顧問"]),
    specializations: arr(["Applied computing", "AI and software"],["Pengkomputeran gunaan", "AI dan perisian"],["应用计算", "AI 与软件"],["應用計算", "AI 與軟體"]),
    description: t("A private computing pathway with modern lab support and strong city-campus convenience.", "Laluan pengkomputeran swasta dengan sokongan makmal moden dan kemudahan kampus bandar.", "具备现代实验室条件和城市校区便利性的私立计算机项目。", "具備現代實驗室條件和城市校區便利性的私立電腦項目。")
  },
  {
    universityCode: "UCSI",
    slug: "ucsi-bachelor-accounting",
    code: "UCSI-BACC",
    name: t("Bachelor of Accounting (Hons)", "Ijazah Sarjana Muda Perakaunan (Kepujian)", "会计学学士（荣誉）", "會計學學士（榮譽）"),
    level: "bachelor",
    category: "business",
    faculty: t("Faculty of Business and Management", "Fakulti Perniagaan dan Pengurusan", "商学与管理学院", "商學與管理學院"),
    durationYears: 3,
    annualTuitionCny: 55000,
    intakeMonths: ["February", "June", "October"],
    languageRequirement: { ielts: 5.5, toefl: 60, pte: 42, muet: 3 },
    requirement: { gpa: 2.5, gaokaoRequired: true, huikaoRequired: false, note: t("Accounting-related exemptions may be available after graduation.", "Pengecualian berkaitan perakaunan mungkin tersedia selepas graduasi.", "毕业后可衔接部分职业资格减免。", "畢業後可銜接部分職業資格減免。") },
    applicationDocs: standardDocs,
    curriculum: arr(["Financial accounting", "Audit", "Taxation", "Accounting systems"],["Perakaunan kewangan", "Audit", "Percukaian", "Sistem perakaunan"],["财务会计", "审计", "税务", "会计信息系统"],["財務會計", "審計", "稅務", "會計資訊系統"]),
    careers: arr(["Accountant", "Auditor", "Finance analyst"],["Akauntan", "Juruaudit", "Penganalisis kewangan"],["会计师", "审计师", "财务分析师"],["會計師", "審計師", "財務分析師"]),
    specializations: arr(["Accounting practice", "Finance reporting"],["Amalan perakaunan", "Pelaporan kewangan"],["会计实务", "财务报告"],["會計實務", "財務報告"]),
    description: t("A practical private accounting route in Kuala Lumpur with city-campus access and broad intake points.", "Laluan perakaunan swasta praktikal di Kuala Lumpur dengan akses kampus bandar dan banyak pengambilan.", "位于吉隆坡、开学批次较多的实用型私立会计项目。", "位於吉隆坡、開學批次較多的實用型私立會計項目。")
  },
  {
    universityCode: "UCSI",
    slug: "ucsi-mbbs",
    code: "UCSI-MBBS",
    name: t("Bachelor of Medicine & Surgery (MBBS)", "Ijazah Sarjana Muda Perubatan & Pembedahan (MBBS)", "医学与外科学士（MBBS）", "醫學與外科學士（MBBS）"),
    level: "bachelor",
    category: "medicine",
    faculty: t("Faculty of Medicine and Health Sciences", "Fakulti Perubatan dan Sains Kesihatan", "医学与健康科学学院", "醫學與健康科學學院"),
    durationYears: 5,
    annualTuitionCny: 148000,
    intakeMonths: ["February", "September"],
    languageRequirement: { ielts: 7, toefl: 100, pte: 65, muet: 5 },
    requirement: { gpa: 3.8, gaokaoRequired: false, huikaoRequired: false, note: t("A strong science profile and interview readiness are required.", "Profil sains yang kuat dan kesiapsiagaan temu duga diperlukan.", "需要较强理科背景并通过面试。", "需要較強理科背景並通過面試。") },
    applicationDocs: standardDocs,
    curriculum: arr(["Basic medical sciences", "Clinical medicine", "Hospital rotations", "Community medicine"],["Sains perubatan asas", "Perubatan klinikal", "Rotasi hospital", "Perubatan komuniti"],["基础医学", "临床医学", "医院轮转", "社区医学"],["基礎醫學", "臨床醫學", "醫院輪轉", "社區醫學"]),
    careers: arr(["Medical officer", "Clinical doctor", "Healthcare pathway"],["Pegawai perubatan", "Doktor klinikal", "Laluan penjagaan kesihatan"],["住院医师", "临床医生", "医疗体系岗位"],["住院醫師", "臨床醫生", "醫療體系崗位"]),
    specializations: arr(["Clinical training", "Hospital-based learning"],["Latihan klinikal", "Pembelajaran berasaskan hospital"],["临床训练", "医院场景学习"],["臨床訓練", "醫院場景學習"]),
    description: t("A private medical route with a high tuition threshold and structured professional training path.", "Laluan perubatan swasta dengan ambang yuran tinggi dan laluan latihan profesional yang tersusun.", "学费门槛较高、职业训练路径明确的私立医学项目。", "學費門檻較高、職業訓練路徑明確的私立醫學項目。")
  },
  {
    universityCode: "UM",
    slug: "um-bachelor-accounting",
    code: "UM-BACC",
    name: t("Bachelor in Accounting (Hons)", "Ijazah Sarjana Muda Perakaunan (Kepujian)", "会计学学士（荣誉）", "會計學學士（榮譽）"),
    level: "bachelor",
    category: "business",
    faculty: t("Faculty of Business and Economics", "Fakulti Perniagaan dan Ekonomi", "商科与经济学院", "商科與經濟學院"),
    durationYears: 3.5,
    annualTuitionCny: 33200,
    intakeMonths: ["October"],
    languageRequirement: { ielts: 5.5, toefl: 46, pte: 51, muet: 4 },
    requirement: { gpa: 3.3, gaokaoRequired: false, huikaoRequired: false, note: t("Accounting or mathematics readiness is recommended.", "Kesediaan perakaunan atau matematik digalakkan.", "建议具备会计或数学基础。", "建議具備會計或數學基礎。") },
    applicationDocs: standardDocs,
    curriculum: arr(["Financial accounting", "Auditing", "Taxation", "Corporate reporting"],["Perakaunan kewangan", "Audit", "Percukaian", "Pelaporan korporat"],["财务会计", "审计学", "税务", "企业报告"],["財務會計", "審計學", "稅務", "企業報告"]),
    careers: arr(["Auditor", "Accountant", "Tax consultant"],["Juruaudit", "Akauntan", "Perunding cukai"],["审计师", "会计师", "税务顾问"],["審計師", "會計師", "稅務顧問"]),
    specializations: arr(["Audit", "Corporate finance"],["Audit", "Kewangan korporat"],["审计", "企业财务"],["審計", "企業財務"]),
    description: t("A professionally oriented accounting track with strong recognition in Malaysia's finance sector.", "Laluan perakaunan berorientasikan profesional dengan pengiktirafan kukuh dalam sektor kewangan Malaysia.", "面向职业资格与企业财务方向的 UM 会计本科。", "面向職業資格與企業財務方向的 UM 會計本科。")
  },
  {
    universityCode: "UM",
    slug: "um-bachelor-finance",
    code: "UM-BFIN",
    name: t("Bachelor of Finance (Hons)", "Ijazah Sarjana Muda Kewangan (Kepujian)", "金融学学士（荣誉）", "金融學學士（榮譽）"),
    level: "bachelor",
    category: "business",
    faculty: t("Faculty of Business and Economics", "Fakulti Perniagaan dan Ekonomi", "商科与经济学院", "商科與經濟學院"),
    durationYears: 3.5,
    annualTuitionCny: 33200,
    intakeMonths: ["October"],
    languageRequirement: { ielts: 5.5, toefl: 46, pte: 51, muet: 4 },
    requirement: { gpa: 3.3, gaokaoRequired: false, huikaoRequired: false, note: t("Quantitative subjects are recommended.", "Subjek kuantitatif digalakkan.", "建议具备数学或经济背景。", "建議具備數學或經濟背景。") },
    applicationDocs: standardDocs,
    curriculum: arr(["Corporate finance", "Investment analysis", "Risk management", "Islamic finance"],["Kewangan korporat", "Analisis pelaburan", "Pengurusan risiko", "Kewangan Islam"],["公司金融", "投资分析", "风险管理", "伊斯兰金融"],["公司金融", "投資分析", "風險管理", "伊斯蘭金融"]),
    careers: arr(["Financial analyst", "Investment executive", "Risk officer"],["Penganalisis kewangan", "Eksekutif pelaburan", "Pegawai risiko"],["金融分析师", "投资专员", "风险管理岗"],["金融分析師", "投資專員", "風險管理崗"]),
    specializations: arr(["Corporate finance", "Capital market"],["Kewangan korporat", "Pasaran modal"],["公司金融", "资本市场"],["公司金融", "資本市場"]),
    description: t("A finance pathway covering both conventional and Islamic finance topics.", "Laluan kewangan yang merangkumi kewangan konvensional dan Islam.", "覆盖传统金融与伊斯兰金融方向的 UM 金融本科。", "覆蓋傳統金融與伊斯蘭金融方向的 UM 金融本科。")
  },
  {
    universityCode: "UM",
    slug: "um-bachelor-economics",
    code: "UM-BECO",
    name: t("Bachelor of Economics (Hons)", "Ijazah Sarjana Muda Ekonomi (Kepujian)", "经济学学士（荣誉）", "經濟學學士（榮譽）"),
    level: "bachelor",
    category: "business",
    faculty: t("Faculty of Business and Economics", "Fakulti Perniagaan dan Ekonomi", "商科与经济学院", "商科與經濟學院"),
    durationYears: 3.5,
    annualTuitionCny: 33200,
    intakeMonths: ["October"],
    languageRequirement: { ielts: 5.5, toefl: 46, pte: 51, muet: 4 },
    requirement: { gpa: 3.3, gaokaoRequired: false, huikaoRequired: false, note: t("Applicants should be comfortable with statistics and mathematics.", "Pemohon perlu selesa dengan statistik dan matematik.", "建议具备统计与数学基础。", "建議具備統計與數學基礎。") },
    applicationDocs: standardDocs,
    curriculum: arr(["Microeconomics", "Macroeconomics", "Econometrics", "Development economics"],["Mikroekonomi", "Makroekonomi", "Ekonometrik", "Ekonomi pembangunan"],["微观经济学", "宏观经济学", "计量经济学", "发展经济学"],["微觀經濟學", "宏觀經濟學", "計量經濟學", "發展經濟學"]),
    careers: arr(["Economist", "Policy analyst", "Research assistant"],["Ahli ekonomi", "Penganalisis dasar", "Pembantu penyelidik"],["经济分析师", "政策研究员", "研究助理"],["經濟分析師", "政策研究員", "研究助理"]),
    specializations: arr(["Policy", "Applied economics"],["Dasar", "Ekonomi gunaan"],["政策分析", "应用经济"],["政策分析", "應用經濟"]),
    description: t("A research-led economics degree with strong analytical and policy orientation.", "Ijazah ekonomi berteraskan penyelidikan dengan orientasi analitik dan dasar yang kukuh.", "强调分析能力与政策研究的 UM 经济学本科。", "強調分析能力與政策研究的 UM 經濟學本科。")
  },
  {
    universityCode: "UM",
    slug: "um-bachelor-computer-science-software-engineering",
    code: "UM-BCS-SE",
    name: t("Bachelor of Computer Science (Software Engineering)", "Ijazah Sarjana Muda Sains Komputer (Kejuruteraan Perisian)", "计算机科学学士（软件工程）", "電腦科學學士（軟體工程）"),
    level: "bachelor",
    category: "it",
    faculty: t("Faculty of Computer Science and Information Technology", "Fakulti Sains Komputer dan Teknologi Maklumat", "计算机科学与信息技术学院", "電腦科學與資訊科技學院"),
    durationYears: 3.5,
    annualTuitionCny: 38500,
    intakeMonths: ["October"],
    languageRequirement: { ielts: 5.5, toefl: 46, pte: 51, muet: 4 },
    requirement: { gpa: 3.0, gaokaoRequired: false, huikaoRequired: false, note: t("Mathematics and computing readiness are recommended.", "Kesediaan matematik dan pengkomputeran digalakkan.", "建议具备数学与计算机基础。", "建議具備數學與電腦基礎。") },
    applicationDocs: standardDocs,
    curriculum: arr(["Software design", "Algorithms", "Database systems", "Software testing"],["Reka bentuk perisian", "Algoritma", "Sistem pangkalan data", "Pengujian perisian"],["软件设计", "算法", "数据库系统", "软件测试"],["軟體設計", "演算法", "資料庫系統", "軟體測試"]),
    careers: arr(["Software engineer", "Backend engineer", "QA engineer"],["Jurutera perisian", "Jurutera backend", "Jurutera QA"],["软件工程师", "后端工程师", "测试工程师"],["軟體工程師", "後端工程師", "測試工程師"]),
    specializations: arr(["Software delivery", "System design"],["Penyampaian perisian", "Reka bentuk sistem"],["软件交付", "系统设计"],["軟體交付", "系統設計"]),
    description: t("A full-lifecycle software development track with strong industry relevance.", "Laluan pembangunan perisian kitar hayat penuh dengan kaitan industri yang kukuh.", "覆盖软件全生命周期开发的 UM 软件工程方向。", "覆蓋軟體全生命週期開發的 UM 軟體工程方向。")
  },
  {
    universityCode: "UM",
    slug: "um-bachelor-computer-science-data-science",
    code: "UM-BCS-DS",
    name: t("Bachelor of Computer Science (Data Science)", "Ijazah Sarjana Muda Sains Komputer (Sains Data)", "计算机科学学士（数据科学）", "電腦科學學士（資料科學）"),
    level: "bachelor",
    category: "it",
    faculty: t("Faculty of Computer Science and Information Technology", "Fakulti Sains Komputer dan Teknologi Maklumat", "计算机科学与信息技术学院", "電腦科學與資訊科技學院"),
    durationYears: 3.5,
    annualTuitionCny: 38500,
    intakeMonths: ["October"],
    languageRequirement: { ielts: 5.5, toefl: 46, pte: 51, muet: 4 },
    requirement: { gpa: 3.0, gaokaoRequired: false, huikaoRequired: false, note: t("Applicants should be comfortable with statistics and programming.", "Pemohon perlu selesa dengan statistik dan pengaturcaraan.", "建议具备统计与编程基础。", "建議具備統計與程式設計基礎。") },
    applicationDocs: standardDocs,
    curriculum: arr(["Data mining", "Statistics", "Machine learning", "Visualization"],["Perlombongan data", "Statistik", "Pembelajaran mesin", "Visualisasi"],["数据挖掘", "统计学", "机器学习", "数据可视化"],["資料探勘", "統計學", "機器學習", "資料視覺化"]),
    careers: arr(["Data scientist", "Data analyst", "BI analyst"],["Saintis data", "Penganalisis data", "Penganalisis BI"],["数据科学家", "数据分析师", "商业分析师"],["資料科學家", "資料分析師", "商業分析師"]),
    specializations: arr(["Analytics", "Machine learning"],["Analitik", "Pembelajaran mesin"],["数据分析", "机器学习"],["資料分析", "機器學習"]),
    description: t("A quantitative computing track designed for data-intensive industries.", "Laluan pengkomputeran kuantitatif untuk industri berintensif data.", "面向数据密集型行业的 UM 数据科学本科方向。", "面向資料密集型行業的 UM 資料科學本科方向。")
  },
  {
    universityCode: "UM",
    slug: "um-bachelor-mbbs",
    code: "UM-MBBS",
    name: t("Bachelor of Medicine and Bachelor of Surgery (MBBS)", "Ijazah Sarjana Muda Perubatan dan Pembedahan (MBBS)", "医学与外科学学士（MBBS）", "醫學與外科學學士（MBBS）"),
    level: "bachelor",
    category: "medicine",
    faculty: t("Faculty of Medicine", "Fakulti Perubatan", "医学院", "醫學院"),
    durationYears: 5,
    annualTuitionCny: 231600,
    intakeMonths: ["October"],
    languageRequirement: { ielts: 7.0, toefl: 100, pte: 65, muet: 5 },
    requirement: { gpa: 3.8, gaokaoRequired: false, huikaoRequired: false, note: t("Highly competitive admission and interview are expected.", "Kemasukan sangat kompetitif dan temuduga dijangka.", "录取竞争激烈，通常需通过面试。", "錄取競爭激烈，通常需通過面試。") },
    applicationDocs: standardDocs,
    curriculum: arr(["Anatomy", "Physiology", "Clinical medicine", "Surgery"],["Anatomi", "Fisiologi", "Perubatan klinikal", "Pembedahan"],["解剖学", "生理学", "临床医学", "外科学"],["解剖學", "生理學", "臨床醫學", "外科學"]),
    careers: arr(["Medical officer", "Doctor", "Clinical researcher"],["Pegawai perubatan", "Doktor", "Penyelidik klinikal"],["医生", "医疗官员", "临床研究员"],["醫生", "醫療官員", "臨床研究員"]),
    specializations: arr(["Clinical medicine", "Hospital training"],["Perubatan klinikal", "Latihan hospital"],["临床医学", "医院培训"],["臨床醫學", "醫院培訓"]),
    description: t("UM's flagship medical degree with hospital-linked clinical training.", "Ijazah perubatan unggul UM dengan latihan klinikal berasaskan hospital.", "依托教学医院资源的 UM 旗舰医学学位。", "依託教學醫院資源的 UM 旗艦醫學學位。")
  },
  {
    universityCode: "UM",
    slug: "um-bachelor-laws",
    code: "UM-LLB",
    name: t("Bachelor of Laws (LLB Hons)", "Ijazah Sarjana Muda Undang-undang (LLB Kepujian)", "法学学士（LLB 荣誉）", "法學學士（LLB 榮譽）"),
    level: "bachelor",
    category: "law",
    faculty: t("Faculty of Law", "Fakulti Undang-undang", "法学院", "法學院"),
    durationYears: 4,
    annualTuitionCny: 31800,
    intakeMonths: ["October"],
    languageRequirement: { ielts: 6.0, toefl: 60, pte: 50, muet: 4 },
    requirement: { gpa: 3.2, gaokaoRequired: false, huikaoRequired: false, note: t("Strong writing and language ability are recommended.", "Keupayaan penulisan dan bahasa yang kukuh digalakkan.", "建议具备较强语言与写作能力。", "建議具備較強語言與寫作能力。") },
    applicationDocs: standardDocs,
    curriculum: arr(["Contract law", "Public law", "Criminal law", "Legal research"],["Undang-undang kontrak", "Undang-undang awam", "Undang-undang jenayah", "Penyelidikan undang-undang"],["合同法", "公法", "刑法", "法律研究"],["合同法", "公法", "刑法", "法律研究"]),
    careers: arr(["Lawyer", "Legal executive", "Compliance officer"],["Peguam", "Eksekutif undang-undang", "Pegawai pematuhan"],["律师", "法务专员", "合规专员"],["律師", "法務專員", "合規專員"]),
    specializations: arr(["Legal practice", "Corporate law"],["Amalan undang-undang", "Undang-undang korporat"],["法律实务", "公司法"],["法律實務", "公司法"]),
    description: t("A core law degree for students targeting legal practice or corporate compliance.", "Ijazah undang-undang teras untuk pelajar yang menyasar amalan guaman atau pematuhan korporat.", "面向法律实务与企业合规方向的 UM 法学本科。", "面向法律實務與企業合規方向的 UM 法學本科。")
  },
  {
    universityCode: "UM",
    slug: "um-master-business-administration",
    code: "UM-MBA",
    name: t("Master of Business Administration (MBA)", "Sarjana Pentadbiran Perniagaan", "工商管理硕士（MBA）", "工商管理碩士（MBA）"),
    level: "master",
    category: "business",
    faculty: t("Faculty of Business and Economics", "Fakulti Perniagaan dan Ekonomi", "商科与经济学院", "商科與經濟學院"),
    durationYears: 1.5,
    annualTuitionCny: 42000,
    intakeMonths: ["March", "October"],
    languageRequirement: { ielts: 6.0, toefl: 60, pte: 50, muet: 4 },
    requirement: { gpa: 3.0, gaokaoRequired: false, huikaoRequired: false, note: t("Suitable for applicants with business or management ambitions.", "Sesuai untuk pemohon dengan aspirasi perniagaan atau pengurusan.", "适合希望提升管理能力的申请者。", "適合希望提升管理能力的申請者。") },
    applicationDocs: standardDocs,
    curriculum: arr(["Strategic management", "Leadership", "Corporate finance", "Operations"],["Pengurusan strategik", "Kepimpinan", "Kewangan korporat", "Operasi"],["战略管理", "领导力", "公司金融", "运营管理"],["策略管理", "領導力", "公司金融", "營運管理"]),
    careers: arr(["Manager", "Consultant", "Business lead"],["Pengurus", "Perunding", "Ketua perniagaan"],["经理", "咨询顾问", "业务负责人"],["經理", "顧問", "業務負責人"]),
    specializations: arr(["Leadership", "Strategy"],["Kepimpinan", "Strategi"],["领导力", "战略"],["領導力", "戰略"]),
    description: t("A flagship taught MBA for applicants seeking leadership and management progression.", "MBA berstruktur untuk pemohon yang menyasar perkembangan kepimpinan dan pengurusan.", "面向管理进阶与领导力提升的 UM MBA。", "面向管理進階與領導力提升的 UM MBA。")
  },
  {
    universityCode: "UM",
    slug: "um-master-data-science",
    code: "UM-MDS",
    name: t("Master of Data Science", "Sarjana Sains Data", "数据科学硕士", "資料科學碩士"),
    level: "master",
    category: "it",
    faculty: t("Faculty of Computer Science and Information Technology", "Fakulti Sains Komputer dan Teknologi Maklumat", "计算机科学与信息技术学院", "電腦科學與資訊科技學院"),
    durationYears: 1,
    annualTuitionCny: 41700,
    intakeMonths: ["March", "October"],
    languageRequirement: { ielts: 6.0, toefl: 60, pte: 50, muet: 4 },
    requirement: { gpa: 3.0, gaokaoRequired: false, huikaoRequired: false, note: t("Open to computing and quantitative backgrounds.", "Terbuka kepada latar pengkomputeran dan kuantitatif.", "面向计算机和量化背景申请者。", "面向電腦和量化背景申請者。") },
    applicationDocs: standardDocs,
    curriculum: arr(["Data analytics", "Machine learning", "Big data", "Visualization"],["Analitik data", "Pembelajaran mesin", "Data raya", "Visualisasi"],["数据分析", "机器学习", "大数据", "可视化"],["資料分析", "機器學習", "大數據", "視覺化"]),
    careers: arr(["Data scientist", "Analytics consultant", "BI lead"],["Saintis data", "Perunding analitik", "Ketua BI"],["数据科学家", "分析顾问", "商业智能负责人"],["資料科學家", "分析顧問", "商業智慧負責人"]),
    specializations: arr(["Analytics", "Applied ML"],["Analitik", "ML gunaan"],["数据分析", "应用机器学习"],["資料分析", "應用機器學習"]),
    description: t("A compact postgraduate programme focused on modern data workflows and analytics delivery.", "Program pascasiswazah padat yang memfokuskan aliran kerja data moden dan penyampaian analitik.", "聚焦现代数据分析与建模能力的 UM 数据科学硕士。", "聚焦現代資料分析與建模能力的 UM 資料科學碩士。")
  },
  {
    universityCode: "UM",
    slug: "um-doctor-business-administration",
    code: "UM-DBA",
    name: t("Doctor of Business Administration", "Doktor Pentadbiran Perniagaan", "工商管理博士（DBA）", "工商管理博士（DBA）"),
    level: "phd",
    category: "business",
    faculty: t("Faculty of Business and Economics", "Fakulti Perniagaan dan Ekonomi", "商科与经济学院", "商科與經濟學院"),
    durationYears: 3,
    annualTuitionCny: 18300,
    intakeMonths: ["March", "October"],
    languageRequirement: { ielts: 6.0, toefl: 60, pte: 50, muet: 4 },
    requirement: { gpa: 3.5, gaokaoRequired: false, huikaoRequired: false, note: t("Managerial experience is strongly preferred.", "Pengalaman pengurusan sangat digalakkan.", "通常要求较强管理经验。", "通常要求較強管理經驗。") },
    applicationDocs: standardDocs,
    curriculum: arr(["Advanced research methods", "Doctoral seminars", "Dissertation"],["Kaedah penyelidikan lanjutan", "Seminar kedoktoran", "Disertasi"],["高级研究方法", "博士研讨", "论文"],["高級研究方法", "博士研討", "論文"]),
    careers: arr(["Senior executive", "Consultant", "Business researcher"],["Eksekutif kanan", "Perunding", "Penyelidik perniagaan"],["高管", "咨询顾问", "商业研究者"],["高管", "顧問", "商業研究者"]),
    specializations: arr(["Leadership", "Strategy"],["Kepimpinan", "Strategi"],["领导力", "战略"],["領導力", "戰略"]),
    description: t("A professional doctorate for senior practitioners who want research-backed management advancement.", "Kedoktoran profesional untuk pengamal kanan yang mahukan kemajuan pengurusan berasaskan penyelidikan.", "面向资深管理者的 UM DBA。", "面向資深管理者的 UM DBA。")
  },
  {
    universityCode: "UM",
    slug: "um-phd-computer-science",
    code: "UM-PHD-CS",
    name: t("Doctor of Philosophy in Computer Science", "Doktor Falsafah dalam Sains Komputer", "计算机科学博士", "計算機科學博士"),
    level: "phd",
    category: "it",
    faculty: t("Faculty of Computer Science and Information Technology", "Fakulti Sains Komputer dan Teknologi Maklumat", "计算机科学与信息技术学院", "電腦科學與資訊科技學院"),
    durationYears: 3.5,
    annualTuitionCny: 18300,
    intakeMonths: ["Rolling"],
    languageRequirement: { ielts: 6.0, toefl: 60, pte: 50, muet: 4 },
    requirement: { gpa: 3.5, gaokaoRequired: false, huikaoRequired: false, note: t("Supervisor contact and detailed proposal are required.", "Hubungan dengan penyelia dan cadangan terperinci diperlukan.", "通常需要联系导师并提交详细研究计划。", "通常需要聯繫導師並提交詳細研究計畫。") },
    applicationDocs: standardDocs,
    curriculum: arr(["Research seminars", "Publication planning", "Thesis"],["Seminar penyelidikan", "Perancangan penerbitan", "Tesis"],["研究研讨", "论文发表规划", "博士论文"],["研究研討", "論文發表規劃", "博士論文"]),
    careers: arr(["Research scientist", "University lecturer", "R&D lead"],["Saintis penyelidikan", "Pensyarah universiti", "Ketua R&D"],["研究科学家", "高校教师", "研发负责人"],["研究科學家", "高校教師", "研發負責人"]),
    specializations: arr(["AI", "Data", "Systems"],["AI", "Data", "Sistem"],["人工智能", "数据", "系统"],["人工智慧", "資料", "系統"]),
    description: t("A research PhD for applicants targeting academic or advanced industrial computing work.", "PhD penyelidikan untuk pemohon yang menyasar kerja akademik atau pengkomputeran industri lanjutan.", "面向学术与高阶研发方向的 UM 计算机博士。", "面向學術與高階研發方向的 UM 計算機博士。")
  },
  {
    universityCode: "USM",
    slug: "usm-bachelor-computer-science",
    code: "USM-BCS",
    name: t("Bachelor of Computer Science (Hons)", "Ijazah Sarjana Muda Sains Komputer (Kepujian)", "计算机科学学士（荣誉）", "計算機科學學士（榮譽）"),
    level: "bachelor",
    category: "it",
    faculty: t("School of Computer Sciences", "Pusat Pengajian Sains Komputer", "计算机科学学院", "計算機科學學院"),
    durationYears: 4,
    annualTuitionCny: 32000,
    intakeMonths: ["October"],
    languageRequirement: { ielts: 5.5, toefl: 60, pte: 50, muet: 4 },
    requirement: { gpa: 3.0, gaokaoRequired: false, huikaoRequired: false, note: t("A mathematics-related preparation is recommended.", "Persediaan berkaitan matematik digalakkan.", "建议具备数学基础。", "建議具備數學基礎。") },
    applicationDocs: standardDocs,
    curriculum: arr(["Programming", "Algorithms", "Database systems", "Operating systems"],["Pengaturcaraan", "Algoritma", "Sistem pangkalan data", "Sistem pengendalian"],["程序设计", "算法", "数据库系统", "操作系统"],["程式設計", "演算法", "資料庫系統", "作業系統"]),
    careers: arr(["Software engineer", "Systems analyst", "Developer"],["Jurutera perisian", "Penganalisis sistem", "Pembangun"],["软件工程师", "系统分析师", "开发工程师"],["軟體工程師", "系統分析師", "開發工程師"]),
    specializations: arr(["Software", "Systems"],["Perisian", "Sistem"],["软件", "系统"],["軟體", "系統"]),
    description: t("A core USM computing degree suited to students targeting software and systems roles.", "Ijazah pengkomputeran teras USM yang sesuai untuk pelajar yang menyasar peranan perisian dan sistem.", "适合软件与系统方向申请者的 USM 核心计算机本科。", "適合軟體與系統方向申請者的 USM 核心電腦本科。")
  },
  {
    universityCode: "USM",
    slug: "usm-bachelor-chemical-engineering",
    code: "USM-BCE",
    name: t("Bachelor of Chemical Engineering (Hons)", "Ijazah Sarjana Muda Kejuruteraan Kimia (Kepujian)", "化学工程学士（荣誉）", "化學工程學士（榮譽）"),
    level: "bachelor",
    category: "engineering",
    faculty: t("School of Chemical Engineering", "Pusat Pengajian Kejuruteraan Kimia", "化学工程学院", "化學工程學院"),
    durationYears: 4,
    annualTuitionCny: 33500,
    intakeMonths: ["October"],
    languageRequirement: { ielts: 5.5, toefl: 60, pte: 50, muet: 4 },
    requirement: { gpa: 3.0, gaokaoRequired: false, huikaoRequired: false, note: t("Chemistry and mathematics readiness are recommended.", "Kesediaan kimia dan matematik digalakkan.", "建议具备化学和数学基础。", "建議具備化學和數學基礎。") },
    applicationDocs: standardDocs,
    curriculum: arr(["Process engineering", "Thermodynamics", "Reaction engineering", "Plant design"],["Kejuruteraan proses", "Termodinamik", "Kejuruteraan tindak balas", "Reka bentuk loji"],["过程工程", "热力学", "反应工程", "工厂设计"],["程序工程", "熱力學", "反應工程", "工廠設計"]),
    careers: arr(["Process engineer", "Production engineer", "Plant engineer"],["Jurutera proses", "Jurutera pengeluaran", "Jurutera loji"],["工艺工程师", "生产工程师", "工厂工程师"],["製程工程師", "生產工程師", "工廠工程師"]),
    specializations: arr(["Process", "Industrial plant"],["Proses", "Loji industri"],["流程", "工业装置"],["流程", "工業裝置"]),
    description: t("A flagship STEM programme at USM with strong engineering fundamentals and lab training.", "Program STEM teras di USM dengan asas kejuruteraan dan latihan makmal yang kukuh.", "具备扎实工程基础与实验训练的 USM 代表性工科本科。", "具備紮實工程基礎與實驗訓練的 USM 代表性工科本科。")
  },
  {
    universityCode: "UPM",
    slug: "upm-bachelor-computer-science",
    code: "UPM-BCS",
    name: t("Bachelor of Computer Science (Hons)", "Ijazah Sarjana Muda Sains Komputer (Kepujian)", "计算机科学学士（荣誉）", "計算機科學學士（榮譽）"),
    level: "bachelor",
    category: "it",
    faculty: t("Faculty of Computer Science and Information Technology", "Fakulti Sains Komputer dan Teknologi Maklumat", "计算机科学与信息技术学院", "計算機科學與資訊科技學院"),
    durationYears: 4,
    annualTuitionCny: 32000,
    intakeMonths: ["September"],
    languageRequirement: { ielts: 5.5, toefl: 60, pte: 50, muet: 4 },
    requirement: { gpa: 2.8, gaokaoRequired: true, huikaoRequired: false, note: t("Applicants should have a quantitative foundation.", "Pemohon perlu mempunyai asas kuantitatif.", "建议具备较好的数理基础。", "建議具備較好的數理基礎。") },
    applicationDocs: standardDocs,
    curriculum: arr(["Programming", "Software engineering", "Networks", "Data management"],["Pengaturcaraan", "Kejuruteraan perisian", "Rangkaian", "Pengurusan data"],["编程", "软件工程", "网络", "数据管理"],["程式設計", "軟體工程", "網路", "資料管理"]),
    careers: arr(["Software engineer", "IT analyst", "Systems engineer"],["Jurutera perisian", "Penganalisis IT", "Jurutera sistem"],["软件工程师", "IT 分析师", "系统工程师"],["軟體工程師", "IT 分析師", "系統工程師"]),
    specializations: arr(["Software", "Networks"],["Perisian", "Rangkaian"],["软件", "网络"],["軟體", "網路"]),
    description: t("A mainstream UPM computing pathway that complements the university's broader research strengths.", "Laluan pengkomputeran utama UPM yang melengkapkan kekuatan penyelidikan universiti yang lebih luas.", "与 UPM 综合研究实力相匹配的主流计算机本科。", "與 UPM 綜合研究實力相匹配的主流電腦本科。")
  },
  {
    universityCode: "UPM",
    slug: "upm-bachelor-food-science",
    code: "UPM-BFS",
    name: t("Bachelor of Food Science (Hons)", "Ijazah Sarjana Muda Sains Makanan (Kepujian)", "食品科学学士（荣誉）", "食品科學學士（榮譽）"),
    level: "bachelor",
    category: "science",
    faculty: t("Faculty of Food Science and Technology", "Fakulti Sains dan Teknologi Makanan", "食品科学与技术学院", "食品科學與技術學院"),
    durationYears: 4,
    annualTuitionCny: 33000,
    intakeMonths: ["September"],
    languageRequirement: { ielts: 5.5, toefl: 60, pte: 50, muet: 4 },
    requirement: { gpa: 2.8, gaokaoRequired: true, huikaoRequired: false, note: t("Chemistry and biology preparation are recommended.", "Persediaan kimia dan biologi digalakkan.", "建议具备化学与生物基础。", "建議具備化學與生物基礎。") },
    applicationDocs: standardDocs,
    curriculum: arr(["Food chemistry", "Food processing", "Nutrition", "Food safety"],["Kimia makanan", "Pemprosesan makanan", "Pemakanan", "Keselamatan makanan"],["食品化学", "食品加工", "营养学", "食品安全"],["食品化學", "食品加工", "營養學", "食品安全"]),
    careers: arr(["Food technologist", "Quality officer", "Product specialist"],["Teknolog makanan", "Pegawai kualiti", "Pakar produk"],["食品工程师", "质量专员", "产品专员"],["食品工程師", "品質專員", "產品專員"]),
    specializations: arr(["Processing", "Food quality"],["Pemprosesan", "Kualiti makanan"],["加工", "食品质量"],["加工", "食品品質"]),
    description: t("A representative UPM science programme aligned with the university's food and agriculture strengths.", "Program sains perwakilan UPM yang sejajar dengan kekuatan universiti dalam makanan dan pertanian.", "契合 UPM 食品与农业优势的代表性理科本科。", "契合 UPM 食品與農業優勢的代表性理科本科。")
  },
  {
    universityCode: "UKM",
    slug: "ukm-bachelor-dentistry",
    code: "UKM-BDS",
    name: t("Bachelor of Dental Surgery", "Ijazah Sarjana Muda Pembedahan Pergigian", "牙医学士", "牙醫學士"),
    level: "bachelor",
    category: "medicine",
    faculty: t("Faculty of Dentistry", "Fakulti Pergigian", "牙科学院", "牙科學院"),
    durationYears: 5,
    annualTuitionCny: 92000,
    intakeMonths: ["September"],
    languageRequirement: { ielts: 6.5, toefl: 90, pte: 58, muet: 4 },
    requirement: { gpa: 3.6, gaokaoRequired: false, huikaoRequired: false, note: t("A strong science profile and interview readiness are expected.", "Profil sains yang kukuh dan kesiapsiagaan temu duga dijangka.", "通常需要较强理科背景并通过面试。", "通常需要較強理科背景並通過面試。") },
    applicationDocs: standardDocs,
    curriculum: arr(["Dental anatomy", "Oral health", "Clinical dentistry", "Community care"],["Anatomi pergigian", "Kesihatan oral", "Pergigian klinikal", "Penjagaan komuniti"],["牙体解剖", "口腔健康", "临床牙科", "社区口腔"],["牙體解剖", "口腔健康", "臨床牙科", "社區口腔"]),
    careers: arr(["Dentist", "Dental officer", "Clinical practitioner"],["Doktor gigi", "Pegawai pergigian", "Pengamal klinikal"],["牙医", "口腔医生", "临床执业者"],["牙醫", "口腔醫師", "臨床執業者"]),
    specializations: arr(["Clinical dentistry", "Oral care"],["Pergigian klinikal", "Penjagaan oral"],["临床牙科", "口腔护理"],["臨床牙科", "口腔護理"]),
    description: t("A competitive professional degree under UKM's established health-science system.", "Ijazah profesional kompetitif di bawah sistem sains kesihatan UKM yang mantap.", "依托 UKM 医疗体系的高竞争度牙医专业学位。", "依託 UKM 醫療體系的高競爭度牙醫專業學位。")
  },
  {
    universityCode: "UKM",
    slug: "ukm-bachelor-pharmacy",
    code: "UKM-BPHARM",
    name: t("Bachelor of Pharmacy (Hons)", "Ijazah Sarjana Muda Farmasi (Kepujian)", "药学学士（荣誉）", "藥學學士（榮譽）"),
    level: "bachelor",
    category: "medicine",
    faculty: t("Faculty of Pharmacy", "Fakulti Farmasi", "药学院", "藥學院"),
    durationYears: 4,
    annualTuitionCny: 52000,
    intakeMonths: ["September"],
    languageRequirement: { ielts: 6.0, toefl: 80, pte: 56, muet: 4 },
    requirement: { gpa: 3.3, gaokaoRequired: false, huikaoRequired: false, note: t("Chemistry and biology readiness are recommended.", "Kesediaan kimia dan biologi digalakkan.", "建议具备化学与生物基础。", "建議具備化學與生物基礎。") },
    applicationDocs: standardDocs,
    curriculum: arr(["Pharmacology", "Pharmaceutics", "Clinical pharmacy", "Medicinal chemistry"],["Farmakologi", "Farmaseutik", "Farmasi klinikal", "Kimia perubatan"],["药理学", "药剂学", "临床药学", "药物化学"],["藥理學", "藥劑學", "臨床藥學", "藥物化學"]),
    careers: arr(["Pharmacist", "Clinical support", "Regulatory affairs"],["Ahli farmasi", "Sokongan klinikal", "Hal ehwal regulatori"],["药剂师", "临床支持岗位", "注册事务专员"],["藥劑師", "臨床支援崗位", "註冊事務專員"]),
    specializations: arr(["Clinical pharmacy", "Community pharmacy"],["Farmasi klinikal", "Farmasi komuniti"],["临床药学", "社区药学"],["臨床藥學", "社區藥學"]),
    description: t("A public pharmacy degree suited to applicants targeting healthcare and medication practice roles.", "Ijazah farmasi awam untuk pemohon yang menyasar peranan penjagaan kesihatan dan amalan ubat.", "面向医疗与药学执业方向申请者的 UKM 公立药学本科。", "面向醫療與藥學執業方向申請者的 UKM 公立藥學本科。")
  },
  {
    universityCode: "UTM",
    slug: "utm-bachelor-computer-engineering",
    code: "UTM-BCEG",
    name: t("Bachelor of Computer Engineering (Hons)", "Ijazah Sarjana Muda Kejuruteraan Komputer (Kepujian)", "计算机工程学士（荣誉）", "計算機工程學士（榮譽）"),
    level: "bachelor",
    category: "engineering",
    faculty: t("Faculty of Electrical Engineering", "Fakulti Kejuruteraan Elektrik", "电气工程学院", "電機工程學院"),
    durationYears: 4,
    annualTuitionCny: 35500,
    intakeMonths: ["September"],
    languageRequirement: { ielts: 6.0, toefl: 80, pte: 50, muet: 4 },
    requirement: { gpa: 3.0, gaokaoRequired: true, huikaoRequired: false, note: t("Mathematics and physics preparation are expected.", "Persediaan matematik dan fizik dijangka.", "建议具备数学和物理基础。", "建議具備數學和物理基礎。") },
    applicationDocs: standardDocs,
    curriculum: arr(["Embedded systems", "Computer architecture", "Digital systems", "Networks"],["Sistem terbenam", "Seni bina komputer", "Sistem digital", "Rangkaian"],["嵌入式系统", "计算机体系结构", "数字系统", "网络"],["嵌入式系統", "計算機體系結構", "數位系統", "網路"]),
    careers: arr(["Computer engineer", "Embedded engineer", "Systems engineer"],["Jurutera komputer", "Jurutera terbenam", "Jurutera sistem"],["计算机工程师", "嵌入式工程师", "系统工程师"],["計算機工程師", "嵌入式工程師", "系統工程師"]),
    specializations: arr(["Computer systems", "Embedded design"],["Sistem komputer", "Reka bentuk terbenam"],["计算机系统", "嵌入式设计"],["計算機系統", "嵌入式設計"]),
    description: t("A classic UTM engineering pathway for applicants focused on hardware-software integration.", "Laluan kejuruteraan klasik UTM untuk pemohon yang memfokuskan integrasi perkakasan dan perisian.", "面向软硬件结合方向申请者的 UTM 经典工科本科。", "面向軟硬體結合方向申請者的 UTM 經典工科本科。")
  },
  {
    universityCode: "UTM",
    slug: "utm-bachelor-mechanical-engineering",
    code: "UTM-BME",
    name: t("Bachelor of Mechanical Engineering (Hons)", "Ijazah Sarjana Muda Kejuruteraan Mekanikal (Kepujian)", "机械工程学士（荣誉）", "機械工程學士（榮譽）"),
    level: "bachelor",
    category: "engineering",
    faculty: t("Faculty of Mechanical Engineering", "Fakulti Kejuruteraan Mekanikal", "机械工程学院", "機械工程學院"),
    durationYears: 4,
    annualTuitionCny: 35500,
    intakeMonths: ["September"],
    languageRequirement: { ielts: 6.0, toefl: 80, pte: 50, muet: 4 },
    requirement: { gpa: 3.0, gaokaoRequired: true, huikaoRequired: false, note: t("Physics and mathematics readiness are expected.", "Persediaan fizik dan matematik dijangka.", "建议具备物理和数学基础。", "建議具備物理和數學基礎。") },
    applicationDocs: standardDocs,
    curriculum: arr(["Mechanics", "Thermodynamics", "Manufacturing", "Machine design"],["Mekanik", "Termodinamik", "Pembuatan", "Reka bentuk mesin"],["力学", "热力学", "制造工艺", "机械设计"],["力學", "熱力學", "製造工藝", "機械設計"]),
    careers: arr(["Mechanical engineer", "Manufacturing engineer", "Design engineer"],["Jurutera mekanikal", "Jurutera pembuatan", "Jurutera reka bentuk"],["机械工程师", "制造工程师", "设计工程师"],["機械工程師", "製造工程師", "設計工程師"]),
    specializations: arr(["Manufacturing", "Design"],["Pembuatan", "Reka bentuk"],["制造", "设计"],["製造", "設計"]),
    description: t("A representative UTM engineering degree with broad industrial applications.", "Ijazah kejuruteraan perwakilan UTM dengan aplikasi industri yang luas.", "具有广泛工业应用场景的 UTM 代表性工科本科。", "具有廣泛工業應用場景的 UTM 代表性工科本科。")
  }];

seedPrograms.push(...umExtraPrograms);
