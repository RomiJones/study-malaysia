import type { DegreeLevel, LocalizedStringArray, LocalizedText, ProgramCategory } from "@studymy/shared";

const t = (en: string, ms: string, zhCN: string, zhTW: string): LocalizedText => ({
  en,
  ms,
  "zh-CN": zhCN,
  "zh-TW": zhTW
});

const arr = (en: string[], ms: string[], zhCN: string[], zhTW: string[]): LocalizedStringArray => ({
  en,
  ms,
  "zh-CN": zhCN,
  "zh-TW": zhTW
});

const text = (en: string, zhCN: string, zhTW = zhCN, ms = en): LocalizedText => t(en, ms, zhCN, zhTW);

const standardDocs = arr(
  ["Passport", "Academic transcript", "English score report", "Personal statement"],
  ["Pasport", "Transkrip akademik", "Keputusan bahasa Inggeris", "Pernyataan peribadi"],
  ["护照", "成绩单", "英语成绩单", "个人陈述"],
  ["護照", "成績單", "英語成績單", "個人陳述"]
);

const faculty = {
  engineering: text("Faculty of Engineering", "工程学院", "工程學院"),
  computing: text("Faculty of Computer Science and Information Technology", "计算机科学与信息技术学院", "計算機科學與資訊技術學院"),
  business: text("Faculty of Business and Economics", "商业与经济学院", "商業與經濟學院"),
  science: text("Faculty of Science", "理学院", "理學院"),
  medicine: text("Faculty of Medicine", "医学院", "醫學院"),
  dentistry: text("Faculty of Dentistry", "牙科学院", "牙科學院"),
  pharmacy: text("Faculty of Pharmacy", "药学院", "藥學院"),
  education: text("Faculty of Education", "教育学院", "教育學院"),
  arts: text("Faculty of Arts and Social Sciences", "文学与社会科学学院", "文學與社會科學學院"),
  law: text("Faculty of Law", "法学院", "法學院"),
  islamic: text("Academy of Islamic Studies", "伊斯兰研究学院", "伊斯蘭研究學院"),
  built: text("Faculty of Built Environment", "建筑环境学院", "建築環境學院"),
  languages: text("Faculty of Languages and Linguistics", "语言与语言学学院", "語言與語言學學院"),
  publicHealth: text("Faculty of Medicine and Public Health", "医学与公共卫生学院", "醫學與公共衛生學院")
} as const;

const curriculumMap: Record<ProgramCategory, LocalizedStringArray> = {
  business: arr(["Business strategy", "Financial analysis", "Market research", "Industry project"], ["Strategi perniagaan", "Analisis kewangan", "Penyelidikan pasaran", "Projek industri"], ["商业战略", "财务分析", "市场研究", "行业项目"], ["商業戰略", "財務分析", "市場研究", "行業項目"]),
  it: arr(["Programming", "Systems design", "Data management", "Applied project"], ["Pengaturcaraan", "Reka bentuk sistem", "Pengurusan data", "Projek aplikasi"], ["编程", "系统设计", "数据管理", "应用项目"], ["程式設計", "系統設計", "資料管理", "應用項目"]),
  engineering: arr(["Engineering mathematics", "Design studio", "Laboratory practice", "Industry training"], ["Matematik kejuruteraan", "Studio reka bentuk", "Amali makmal", "Latihan industri"], ["工程数学", "设计工作室", "实验训练", "行业实训"], ["工程數學", "設計工作室", "實驗訓練", "行業實訓"]),
  science: arr(["Laboratory methods", "Quantitative analysis", "Research design", "Capstone project"], ["Kaedah makmal", "Analisis kuantitatif", "Reka bentuk penyelidikan", "Projek akhir"], ["实验方法", "定量分析", "研究设计", "毕业项目"], ["實驗方法", "定量分析", "研究設計", "畢業項目"]),
  arts: arr(["Critical reading", "Fieldwork", "Communication practice", "Portfolio or dissertation"], ["Bacaan kritikal", "Kerja lapangan", "Amalan komunikasi", "Portfolio atau disertasi"], ["批判阅读", "田野研究", "传播实践", "作品集或论文"], ["批判閱讀", "田野研究", "傳播實踐", "作品集或論文"]),
  medicine: arr(["Biomedical foundation", "Clinical exposure", "Professional practice", "Healthcare systems"], ["Asas bioperubatan", "Pendedahan klinikal", "Amalan profesional", "Sistem kesihatan"], ["生物医学基础", "临床训练", "专业实践", "医疗体系"], ["生物醫學基礎", "臨床訓練", "專業實踐", "醫療體系"]),
  law: arr(["Legal systems", "Case analysis", "Research methods", "Professional ethics"], ["Sistem undang-undang", "Analisis kes", "Kaedah penyelidikan", "Etika profesional"], ["法律体系", "案例分析", "研究方法", "职业伦理"], ["法律體系", "案例分析", "研究方法", "職業倫理"])
};

const careersMap: Record<ProgramCategory, LocalizedStringArray> = {
  business: arr(["Analyst", "Manager", "Consultant"], ["Penganalisis", "Pengurus", "Perunding"], ["分析师", "经理", "顾问"], ["分析師", "經理", "顧問"]),
  it: arr(["Software engineer", "Systems specialist", "Technology analyst"], ["Jurutera perisian", "Pakar sistem", "Penganalisis teknologi"], ["软件工程师", "系统专家", "技术分析师"], ["軟體工程師", "系統專家", "技術分析師"]),
  engineering: arr(["Engineer", "Project engineer", "Design specialist"], ["Jurutera", "Jurutera projek", "Pakar reka bentuk"], ["工程师", "项目工程师", "设计专家"], ["工程師", "項目工程師", "設計專家"]),
  science: arr(["Scientist", "Research assistant", "Laboratory specialist"], ["Saintis", "Pembantu penyelidik", "Pakar makmal"], ["科研人员", "研究助理", "实验室专员"], ["科研人員", "研究助理", "實驗室專員"]),
  arts: arr(["Writer", "Researcher", "Communication specialist"], ["Penulis", "Penyelidik", "Pakar komunikasi"], ["写作者", "研究人员", "传播专员"], ["寫作者", "研究人員", "傳播專員"]),
  medicine: arr(["Clinician", "Healthcare practitioner", "Medical researcher"], ["Pengamal klinikal", "Pengamal kesihatan", "Penyelidik perubatan"], ["临床从业者", "医疗实践者", "医学研究人员"], ["臨床從業者", "醫療實踐者", "醫學研究人員"]),
  law: arr(["Lawyer", "Compliance officer", "Legal researcher"], ["Peguam", "Pegawai pematuhan", "Penyelidik undang-undang"], ["律师", "合规专员", "法律研究员"], ["律師", "合規專員", "法律研究員"])
};

const specializationMap: Record<ProgramCategory, LocalizedStringArray> = {
  business: arr(["Management", "Strategy"], ["Pengurusan", "Strategi"], ["管理", "战略"], ["管理", "戰略"]),
  it: arr(["Software", "Data and systems"], ["Perisian", "Data dan sistem"], ["软件", "数据与系统"], ["軟體", "資料與系統"]),
  engineering: arr(["Design", "Industrial application"], ["Reka bentuk", "Aplikasi industri"], ["设计", "工业应用"], ["設計", "工業應用"]),
  science: arr(["Research", "Applied science"], ["Penyelidikan", "Sains gunaan"], ["研究", "应用科学"], ["研究", "應用科學"]),
  arts: arr(["Communication", "Interdisciplinary study"], ["Komunikasi", "Kajian antara disiplin"], ["传播", "跨学科研究"], ["傳播", "跨學科研究"]),
  medicine: arr(["Clinical pathway", "Health systems"], ["Laluan klinikal", "Sistem kesihatan"], ["临床路径", "健康体系"], ["臨床路徑", "健康體系"]),
  law: arr(["Legal practice", "Regulation"], ["Amalan undang-undang", "Regulasi"], ["法律实务", "监管"], ["法律實務", "監管"])
};

const categoryCopy: Record<ProgramCategory, LocalizedText> = {
  business: text("business and management", "商科与管理", "商科與管理", "perniagaan dan pengurusan"),
  it: text("computing and digital technology", "计算机与数字技术", "計算機與數位技術", "pengkomputeran dan teknologi digital"),
  engineering: text("engineering and technology", "工程与技术", "工程與技術", "kejuruteraan dan teknologi"),
  science: text("science and laboratory research", "理科与实验研究", "理科與實驗研究", "sains dan penyelidikan makmal"),
  arts: text("humanities, language and communication", "人文、语言与传播", "人文、語言與傳播", "kemanusiaan, bahasa dan komunikasi"),
  medicine: text("healthcare and biomedical practice", "医疗与生物医学实践", "醫療與生物醫學實踐", "penjagaan kesihatan dan amalan bioperubatan"),
  law: text("law and regulatory studies", "法律与监管研究", "法律與監管研究", "undang-undang dan kajian regulatori")
};

type UmDraft = {
  slug: string;
  code: string;
  name: LocalizedText;
  level: DegreeLevel;
  category: ProgramCategory;
  faculty: LocalizedText;
  durationYears: number;
  annualTuitionCny: number;
  intakeMonths: string[];
  ielts: number;
  requirementGpa: number;
};

function makeProgram(draft: UmDraft) {
  const levelCopy = {
    en: draft.level === "bachelor" ? "undergraduate" : draft.level === "master" ? "master's" : "doctoral",
    ms: draft.level === "bachelor" ? "sarjana muda" : draft.level === "master" ? "sarjana" : "doktor falsafah",
    "zh-CN": draft.level === "bachelor" ? "本科" : draft.level === "master" ? "硕士" : "博士",
    "zh-TW": draft.level === "bachelor" ? "本科" : draft.level === "master" ? "碩士" : "博士"
  } as const;

  const note = t(
    draft.level === "phd" ? "Research proposal and supervisor matching are normally required." : draft.level === "master" ? "A relevant academic background is normally expected." : "Relevant academic preparation is recommended for competitive admission.",
    draft.level === "phd" ? "Cadangan penyelidikan dan padanan penyelia biasanya diperlukan." : draft.level === "master" ? "Latar belakang akademik yang berkaitan biasanya dijangka." : "Persediaan akademik yang relevan digalakkan untuk kemasukan yang kompetitif.",
    draft.level === "phd" ? "通常需要研究计划与导师匹配。" : draft.level === "master" ? "通常要求相关学术背景。" : "竞争性录取通常建议具备相关学术基础。",
    draft.level === "phd" ? "通常需要研究計畫與導師匹配。" : draft.level === "master" ? "通常要求相關學術背景。" : "競爭性錄取通常建議具備相關學術基礎。"
  );

  const toefl = draft.ielts >= 6.5 ? 90 : draft.ielts >= 6.0 ? 80 : 60;
  const pte = draft.ielts >= 6.5 ? 58 : draft.ielts >= 6.0 ? 50 : 46;

  return {
    universityCode: "UM",
    slug: draft.slug,
    code: draft.code,
    name: draft.name,
    nameEn: draft.name.en,
    level: draft.level,
    category: draft.category,
    faculty: draft.faculty,
    durationYears: draft.durationYears,
    annualTuitionCny: draft.annualTuitionCny,
    intakeMonths: draft.intakeMonths,
    languageRequirement: { ielts: draft.ielts, toefl, pte, muet: 4 },
    requirement: { gpa: draft.requirementGpa, gaokaoRequired: false, huikaoRequired: false, note },
    applicationDocs: standardDocs,
    curriculum: curriculumMap[draft.category],
    careers: careersMap[draft.category],
    specializations: specializationMap[draft.category],
    description: {
      en: `A representative Universiti Malaya ${levelCopy.en} pathway in ${categoryCopy[draft.category].en}.`,
      ms: `Laluan ${levelCopy.ms} perwakilan Universiti Malaya dalam ${categoryCopy[draft.category].ms}.`,
      "zh-CN": `马来亚大学具有代表性的${levelCopy["zh-CN"]}项目之一，方向聚焦于${categoryCopy[draft.category]["zh-CN"]}。`,
      "zh-TW": `馬來亞大學具有代表性的${levelCopy["zh-TW"]}項目之一，方向聚焦於${categoryCopy[draft.category]["zh-TW"]}。`
    }
  };
}

const drafts: UmDraft[] = [
  { slug: "um-bachelor-computer-science-computer-systems-networking", code: "UM-BCS-CSN", name: text("Bachelor of Computer Science (Computer Systems and Networking)", "计算机科学学士（计算机系统与网络）", "計算機科學學士（計算機系統與網路）"), level: "bachelor", category: "it", faculty: faculty.computing, durationYears: 3.5, annualTuitionCny: 38500, intakeMonths: ["October"], ielts: 5.5, requirementGpa: 3.0 },
  { slug: "um-bachelor-computer-science-information-systems", code: "UM-BCS-IS", name: text("Bachelor of Computer Science (Information Systems)", "计算机科学学士（信息系统）", "計算機科學學士（資訊系統）"), level: "bachelor", category: "it", faculty: faculty.computing, durationYears: 3.5, annualTuitionCny: 38500, intakeMonths: ["October"], ielts: 5.5, requirementGpa: 3.0 },
  { slug: "um-bachelor-information-technology-multimedia", code: "UM-BIT-MM", name: text("Bachelor of Information Technology (Multimedia)", "信息技术学士（多媒体）", "資訊科技學士（多媒體）"), level: "bachelor", category: "it", faculty: faculty.computing, durationYears: 3.5, annualTuitionCny: 37500, intakeMonths: ["October"], ielts: 5.5, requirementGpa: 3.0 },
  { slug: "um-bachelor-information-technology-cybersecurity", code: "UM-BIT-CYB", name: text("Bachelor of Information Technology (Cybersecurity)", "信息技术学士（网络安全）", "資訊科技學士（網路安全）"), level: "bachelor", category: "it", faculty: faculty.computing, durationYears: 3.5, annualTuitionCny: 38500, intakeMonths: ["October"], ielts: 5.5, requirementGpa: 3.0 },
  { slug: "um-bachelor-electrical-engineering", code: "UM-BEE", name: text("Bachelor of Electrical Engineering", "电气工程学士", "電機工程學士"), level: "bachelor", category: "engineering", faculty: faculty.engineering, durationYears: 4, annualTuitionCny: 45800, intakeMonths: ["October"], ielts: 5.5, requirementGpa: 3.1 },
  { slug: "um-bachelor-mechanical-engineering", code: "UM-BME", name: text("Bachelor of Mechanical Engineering", "机械工程学士", "機械工程學士"), level: "bachelor", category: "engineering", faculty: faculty.engineering, durationYears: 4, annualTuitionCny: 45800, intakeMonths: ["October"], ielts: 5.5, requirementGpa: 3.1 },
  { slug: "um-bachelor-chemical-engineering", code: "UM-BCHE", name: text("Bachelor of Chemical Engineering", "化学工程学士", "化學工程學士"), level: "bachelor", category: "engineering", faculty: faculty.engineering, durationYears: 4, annualTuitionCny: 46200, intakeMonths: ["October"], ielts: 5.5, requirementGpa: 3.1 },
  { slug: "um-bachelor-civil-engineering", code: "UM-BCE", name: text("Bachelor of Civil Engineering", "土木工程学士", "土木工程學士"), level: "bachelor", category: "engineering", faculty: faculty.engineering, durationYears: 4, annualTuitionCny: 45800, intakeMonths: ["October"], ielts: 5.5, requirementGpa: 3.1 },
  { slug: "um-bachelor-biomedical-engineering", code: "UM-BBME", name: text("Bachelor of Biomedical Engineering", "生物医学工程学士", "生物醫學工程學士"), level: "bachelor", category: "engineering", faculty: faculty.engineering, durationYears: 4, annualTuitionCny: 46800, intakeMonths: ["October"], ielts: 6.0, requirementGpa: 3.2 },
  { slug: "um-bachelor-architecture", code: "UM-BARCH", name: text("Bachelor of Architecture", "建筑学学士", "建築學學士"), level: "bachelor", category: "arts", faculty: faculty.built, durationYears: 3.5, annualTuitionCny: 39800, intakeMonths: ["October"], ielts: 5.5, requirementGpa: 3.0 },
  { slug: "um-bachelor-quantity-surveying", code: "UM-BQS", name: text("Bachelor of Quantity Surveying", "工料测量学学士", "工料測量學學士"), level: "bachelor", category: "engineering", faculty: faculty.built, durationYears: 4, annualTuitionCny: 38800, intakeMonths: ["October"], ielts: 5.5, requirementGpa: 3.0 },
  { slug: "um-bachelor-built-environment", code: "UM-BBE", name: text("Bachelor of Built Environment", "建筑环境学学士", "建築環境學學士"), level: "bachelor", category: "arts", faculty: faculty.built, durationYears: 3.5, annualTuitionCny: 38600, intakeMonths: ["October"], ielts: 5.5, requirementGpa: 3.0 },
  { slug: "um-bachelor-pharmacy", code: "UM-BPHARM", name: text("Bachelor of Pharmacy", "药学学士", "藥學學士"), level: "bachelor", category: "medicine", faculty: faculty.pharmacy, durationYears: 4, annualTuitionCny: 54800, intakeMonths: ["October"], ielts: 6.0, requirementGpa: 3.3 },
  { slug: "um-bachelor-dental-surgery", code: "UM-BDS", name: text("Bachelor of Dental Surgery", "牙医学士", "牙醫學士"), level: "bachelor", category: "medicine", faculty: faculty.dentistry, durationYears: 5, annualTuitionCny: 73800, intakeMonths: ["October"], ielts: 6.5, requirementGpa: 3.5 },
  { slug: "um-bachelor-nursing", code: "UM-BNURS", name: text("Bachelor of Nursing", "护理学学士", "護理學學士"), level: "bachelor", category: "medicine", faculty: faculty.medicine, durationYears: 4, annualTuitionCny: 36800, intakeMonths: ["October"], ielts: 5.5, requirementGpa: 3.0 },
  { slug: "um-bachelor-biomedical-science", code: "UM-BBMS", name: text("Bachelor of Biomedical Science", "生物医学科学学士", "生物醫學科學學士"), level: "bachelor", category: "medicine", faculty: faculty.medicine, durationYears: 4, annualTuitionCny: 38800, intakeMonths: ["October"], ielts: 5.5, requirementGpa: 3.0 },
  { slug: "um-bachelor-biotechnology", code: "UM-BBIOT", name: text("Bachelor of Biotechnology", "生物技术学士", "生物技術學士"), level: "bachelor", category: "science", faculty: faculty.science, durationYears: 4, annualTuitionCny: 36200, intakeMonths: ["October"], ielts: 5.5, requirementGpa: 3.0 },
  { slug: "um-bachelor-chemistry", code: "UM-BCHEM", name: text("Bachelor of Chemistry", "化学学士", "化學學士"), level: "bachelor", category: "science", faculty: faculty.science, durationYears: 4, annualTuitionCny: 35200, intakeMonths: ["October"], ielts: 5.5, requirementGpa: 3.0 },
  { slug: "um-bachelor-physics", code: "UM-BPHYS", name: text("Bachelor of Physics", "物理学学士", "物理學學士"), level: "bachelor", category: "science", faculty: faculty.science, durationYears: 4, annualTuitionCny: 35200, intakeMonths: ["October"], ielts: 5.5, requirementGpa: 3.0 },
  { slug: "um-bachelor-mathematics", code: "UM-BMATH", name: text("Bachelor of Mathematics", "数学学士", "數學學士"), level: "bachelor", category: "science", faculty: faculty.science, durationYears: 4, annualTuitionCny: 34600, intakeMonths: ["October"], ielts: 5.5, requirementGpa: 3.0 },
  { slug: "um-bachelor-islamic-studies", code: "UM-BIS", name: text("Bachelor of Islamic Studies", "伊斯兰研究学士", "伊斯蘭研究學士"), level: "bachelor", category: "arts", faculty: faculty.islamic, durationYears: 4, annualTuitionCny: 29800, intakeMonths: ["October"], ielts: 5.5, requirementGpa: 3.0 },
  { slug: "um-bachelor-education-tesl", code: "UM-BED-TESL", name: text("Bachelor of Education (TESL)", "教育学学士（TESL）", "教育學學士（TESL）"), level: "bachelor", category: "arts", faculty: faculty.education, durationYears: 4, annualTuitionCny: 31600, intakeMonths: ["October"], ielts: 6.0, requirementGpa: 3.0 },
  { slug: "um-bachelor-media-studies", code: "UM-BMEDIA", name: text("Bachelor of Media Studies", "媒体研究学士", "媒體研究學士"), level: "bachelor", category: "arts", faculty: faculty.arts, durationYears: 3.5, annualTuitionCny: 30800, intakeMonths: ["October"], ielts: 5.5, requirementGpa: 3.0 },
  { slug: "um-bachelor-english-language-studies", code: "UM-BELS", name: text("Bachelor of English Language Studies", "英语语言研究学士", "英語語言研究學士"), level: "bachelor", category: "arts", faculty: faculty.languages, durationYears: 3.5, annualTuitionCny: 30200, intakeMonths: ["October"], ielts: 6.0, requirementGpa: 3.0 },
  { slug: "um-master-finance", code: "UM-MFIN", name: text("Master of Finance", "金融学硕士", "金融學碩士"), level: "master", category: "business", faculty: faculty.business, durationYears: 1.5, annualTuitionCny: 42800, intakeMonths: ["March", "October"], ielts: 6.0, requirementGpa: 3.0 },
  { slug: "um-master-economics", code: "UM-MECO", name: text("Master of Economics", "经济学硕士", "經濟學碩士"), level: "master", category: "business", faculty: faculty.business, durationYears: 1.5, annualTuitionCny: 40500, intakeMonths: ["March", "October"], ielts: 6.0, requirementGpa: 3.0 },
  { slug: "um-master-accounting", code: "UM-MACC", name: text("Master of Accounting", "会计学硕士", "會計學碩士"), level: "master", category: "business", faculty: faculty.business, durationYears: 1.5, annualTuitionCny: 41800, intakeMonths: ["March", "October"], ielts: 6.0, requirementGpa: 3.0 },
  { slug: "um-master-artificial-intelligence", code: "UM-MAI", name: text("Master of Artificial Intelligence", "人工智能硕士", "人工智慧碩士"), level: "master", category: "it", faculty: faculty.computing, durationYears: 1.5, annualTuitionCny: 43800, intakeMonths: ["March", "October"], ielts: 6.0, requirementGpa: 3.0 },
  { slug: "um-master-computer-science", code: "UM-MCS", name: text("Master of Computer Science", "计算机科学硕士", "計算機科學碩士"), level: "master", category: "it", faculty: faculty.computing, durationYears: 1.5, annualTuitionCny: 43200, intakeMonths: ["March", "October"], ielts: 6.0, requirementGpa: 3.0 },
  { slug: "um-master-software-engineering", code: "UM-MSE", name: text("Master of Software Engineering", "软件工程硕士", "軟體工程碩士"), level: "master", category: "it", faculty: faculty.computing, durationYears: 1.5, annualTuitionCny: 43200, intakeMonths: ["March", "October"], ielts: 6.0, requirementGpa: 3.0 },
  { slug: "um-master-cybersecurity", code: "UM-MCYB", name: text("Master of Cybersecurity", "网络安全硕士", "網路安全碩士"), level: "master", category: "it", faculty: faculty.computing, durationYears: 1.5, annualTuitionCny: 43800, intakeMonths: ["March", "October"], ielts: 6.0, requirementGpa: 3.0 },
  { slug: "um-master-public-health", code: "UM-MPH", name: text("Master of Public Health", "公共卫生硕士", "公共衛生碩士"), level: "master", category: "medicine", faculty: faculty.publicHealth, durationYears: 1.5, annualTuitionCny: 41800, intakeMonths: ["March", "October"], ielts: 6.0, requirementGpa: 3.0 },
  { slug: "um-master-clinical-pharmacy", code: "UM-MCPHARM", name: text("Master of Clinical Pharmacy", "临床药学硕士", "臨床藥學碩士"), level: "master", category: "medicine", faculty: faculty.pharmacy, durationYears: 1.5, annualTuitionCny: 42800, intakeMonths: ["March", "October"], ielts: 6.0, requirementGpa: 3.0 },
  { slug: "um-master-biotechnology", code: "UM-MBIOT", name: text("Master of Biotechnology", "生物技术硕士", "生物技術碩士"), level: "master", category: "science", faculty: faculty.science, durationYears: 1.5, annualTuitionCny: 40500, intakeMonths: ["March", "October"], ielts: 6.0, requirementGpa: 3.0 },
  { slug: "um-master-education", code: "UM-MEDU", name: text("Master of Education", "教育学硕士", "教育學碩士"), level: "master", category: "arts", faculty: faculty.education, durationYears: 1.5, annualTuitionCny: 36800, intakeMonths: ["March", "October"], ielts: 6.0, requirementGpa: 3.0 },
  { slug: "um-master-applied-linguistics", code: "UM-MAL", name: text("Master of Applied Linguistics", "应用语言学硕士", "應用語言學碩士"), level: "master", category: "arts", faculty: faculty.languages, durationYears: 1.5, annualTuitionCny: 37200, intakeMonths: ["March", "October"], ielts: 6.0, requirementGpa: 3.0 },
  { slug: "um-master-international-strategic-studies", code: "UM-MISS", name: text("Master of International and Strategic Studies", "国际与战略研究硕士", "國際與戰略研究碩士"), level: "master", category: "arts", faculty: faculty.arts, durationYears: 1.5, annualTuitionCny: 37800, intakeMonths: ["March", "October"], ielts: 6.0, requirementGpa: 3.0 },
  { slug: "um-master-laws", code: "UM-LLM", name: text("Master of Laws", "法学硕士", "法學碩士"), level: "master", category: "law", faculty: faculty.law, durationYears: 1.5, annualTuitionCny: 38800, intakeMonths: ["March", "October"], ielts: 6.5, requirementGpa: 3.0 },
  { slug: "um-master-sustainable-development-studies", code: "UM-MSDS", name: text("Master of Sustainable Development Studies", "可持续发展研究硕士", "永續發展研究碩士"), level: "master", category: "science", faculty: faculty.science, durationYears: 1.5, annualTuitionCny: 39200, intakeMonths: ["March", "October"], ielts: 6.0, requirementGpa: 3.0 },
  { slug: "um-master-mechanical-engineering", code: "UM-MME", name: text("Master of Mechanical Engineering", "机械工程硕士", "機械工程碩士"), level: "master", category: "engineering", faculty: faculty.engineering, durationYears: 1.5, annualTuitionCny: 43200, intakeMonths: ["March", "October"], ielts: 6.0, requirementGpa: 3.0 },
  { slug: "um-phd-business-accounting", code: "UM-PHD-BA", name: text("Doctor of Philosophy in Business and Accounting", "商业与会计哲学博士", "商業與會計哲學博士"), level: "phd", category: "business", faculty: faculty.business, durationYears: 3, annualTuitionCny: 19200, intakeMonths: ["Rolling"], ielts: 6.0, requirementGpa: 3.5 },
  { slug: "um-phd-economics", code: "UM-PHD-ECO", name: text("Doctor of Philosophy in Economics", "经济学哲学博士", "經濟學哲學博士"), level: "phd", category: "business", faculty: faculty.business, durationYears: 3, annualTuitionCny: 18800, intakeMonths: ["Rolling"], ielts: 6.0, requirementGpa: 3.5 },
  { slug: "um-phd-artificial-intelligence", code: "UM-PHD-AI", name: text("Doctor of Philosophy in Artificial Intelligence", "人工智能哲学博士", "人工智慧哲學博士"), level: "phd", category: "it", faculty: faculty.computing, durationYears: 3.5, annualTuitionCny: 19600, intakeMonths: ["Rolling"], ielts: 6.0, requirementGpa: 3.5 },
  { slug: "um-phd-data-science", code: "UM-PHD-DS", name: text("Doctor of Philosophy in Data Science", "数据科学哲学博士", "資料科學哲學博士"), level: "phd", category: "it", faculty: faculty.computing, durationYears: 3.5, annualTuitionCny: 19600, intakeMonths: ["Rolling"], ielts: 6.0, requirementGpa: 3.5 },
  { slug: "um-phd-engineering", code: "UM-PHD-ENG", name: text("Doctor of Philosophy in Engineering", "工程学哲学博士", "工程學哲學博士"), level: "phd", category: "engineering", faculty: faculty.engineering, durationYears: 3.5, annualTuitionCny: 20200, intakeMonths: ["Rolling"], ielts: 6.0, requirementGpa: 3.5 },
  { slug: "um-phd-medicine", code: "UM-PHD-MED", name: text("Doctor of Philosophy in Medicine", "医学哲学博士", "醫學哲學博士"), level: "phd", category: "medicine", faculty: faculty.medicine, durationYears: 3.5, annualTuitionCny: 20500, intakeMonths: ["Rolling"], ielts: 6.5, requirementGpa: 3.5 },
  { slug: "um-phd-education", code: "UM-PHD-EDU", name: text("Doctor of Philosophy in Education", "教育学哲学博士", "教育學哲學博士"), level: "phd", category: "arts", faculty: faculty.education, durationYears: 3, annualTuitionCny: 18200, intakeMonths: ["Rolling"], ielts: 6.0, requirementGpa: 3.5 },
  { slug: "um-phd-law", code: "UM-PHD-LAW", name: text("Doctor of Philosophy in Law", "法学哲学博士", "法學哲學博士"), level: "phd", category: "law", faculty: faculty.law, durationYears: 3, annualTuitionCny: 18600, intakeMonths: ["Rolling"], ielts: 6.5, requirementGpa: 3.5 }
];

export const umExtraPrograms = drafts.map(makeProgram);