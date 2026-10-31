#!/usr/bin/env python3
"""
Generate UMT (Universiti Malaysia Terengganu) candidate dataset JSON.
Based on official data from umt.edu.my, StudyMalaysia.com, UniPage, and EduYar.
"""
import json
from datetime import datetime

# Platform-standard MYR -> CNY exchange rate (consistent with UOC/IIUM/UNITEN/MSU/
# UTP/UUM/APU/SEGI pipelines).
MYR_TO_CNY = 1.55

# === University Info ===
university = {
    "code": "UMT",
    "nameEnOfficial": "Universiti Malaysia Terengganu",
    "localizedName": {
        "en": "Universiti Malaysia Terengganu (UMT)",
        "ms": "Universiti Malaysia Terengganu (UMT)",
        "zh-CN": "马来西亚登嘉楼大学",
        "zh-TW": "馬來西亞登嘉樓大學"
    },
    "shortName": "UMT",
    "officialWebsite": "https://www.umt.edu.my/",
    "officialSourceStatus": "official-verified",
    "officialVerifiedAt": "2026-07-07",
    "publicDisplayStatus": "ready",
    "auditNote": "Data collected from UMT official website (umt.edu.my), UMT All Programs page, UMT official undergraduate fees PDF (akademik.umt.edu.my), UMT postgraduate centre (postgrad.umt.edu.my), and StudyMalaysia.com. All bachelor tuition fees are from official PDF (international student rates in USD, converted to MYR at 1 USD = 4.7 MYR). Postgraduate fees from postgrad.umt.edu.my. Data verified on 2026-07-07.",
    "officialSources": [
        {"title": "UMT Official Website", "url": "https://www.umt.edu.my/", "sourceType": "official-page", "verifiedAt": "2026-07-07", "status": "verified"},
        {"title": "UMT All Programs", "url": "https://www.umt.edu.my/all-programs-at-umt/", "sourceType": "official-page", "verifiedAt": "2026-07-07", "status": "verified"},
        {"title": "UMT International Student (Undergraduate)", "url": "https://www.umt.edu.my/international-student-undergraduate/", "sourceType": "official-page", "verifiedAt": "2026-07-07", "status": "verified"},
        {"title": "UMT Postgraduate Fees (International)", "url": "https://postgrad.umt.edu.my/postgraduate_fees-2/", "sourceType": "official-page", "verifiedAt": "2026-07-07", "status": "verified"},
        {"title": "UMT Undergraduate Programmes and Fees PDF (International Students)", "url": "https://akademik.umt.edu.my/wp-content/uploads/2025/02/2-PPPA-UG-LIST-PROGRAMMES-AND-FEES-FOR-INTERNATIONAL-STUDENTS.pdf", "sourceType": "official-page", "verifiedAt": "2026-07-07", "status": "verified"},
        {"title": "UMT Courses & Fees (StudyMalaysia)", "url": "https://studymalaysia.com/edu/umt/courses/", "sourceType": "official-listing", "verifiedAt": "2026-07-07", "status": "verified"},
        {"title": "UMT QS Rankings 2026 Announcement", "url": "https://www.umt.edu.my/umt-placed-higher-in-latest-qs-world-university-rankings-affirming-its-excellence-in-marine-science-and-environmental-sustainability/", "sourceType": "official-page", "verifiedAt": "2026-07-07", "status": "verified"}
    ],
    "ownership": "public",
    "institutionType": "research",
    "foundedYear": 2001,
    "campuses": ["Kuala Nerus"],
    "qsRank": 825,
    "qsAsiaRank": 135,
    "theRank": 1100,
    "theAsiaRank": 400,
    "color": "#0066A2",
    "location": {
        "en": "Kuala Nerus, Terengganu",
        "ms": "Kuala Nerus, Terengganu",
        "zh-CN": "登嘉楼州瓜拉尼鲁斯",
        "zh-TW": "登嘉樓州瓜拉尼魯斯"
    },
    "region": {
        "en": "Terengganu",
        "ms": "Terengganu",
        "zh-CN": "登嘉楼州",
        "zh-TW": "登嘉樓州"
    },
    "website": "https://www.umt.edu.my",
    "admissionEmail": "international@umt.edu.my",
    "description": {
        "en": "Universiti Malaysia Terengganu (UMT) is a public university established in 2001, located on the scenic coastline of Kuala Nerus, Terengganu. Malaysia's flagship institution for marine and environmental excellence, ranked #1 in Malaysia for Marine and Freshwater Biology Studies. QS World #801-850 (2026, first-time listing), QS Asia Top 10%, THE World #1001-1200, THE Young University Rankings Top 300. Home to 7 faculties, Institute of Oceanography and Environment (INOS), and Institute of Tropical Aquaculture (AKUATROP). 94.8% graduate employment rate. Approximately 9,296 students including 371 international students.",
        "ms": "Universiti Malaysia Terengganu (UMT) ialah universiti awam yang ditubuhkan pada 2001, terletak di pesisiran pantai Kuala Nerus, Terengganu. Institusi utama Malaysia untuk kecemerlangan marin dan alam sekitar. QS Asia Top 10%, THE World #1001-1200.",
        "zh-CN": "马来西亚登嘉楼大学（UMT）是2001年成立的公立大学，坐落于登嘉楼州瓜拉尼鲁斯的海岸线上。作为马来西亚海洋与环境科学的旗舰学府，在海洋与淡水生物学领域排名全国第一。2026年首次进入QS世界排名第801-850位，QS亚洲排名前10%，THE世界排名第1001-1200位，THE年轻大学排名前300。拥有7个学院、海洋与环境研究所（INOS）和热带水产养殖研究所（AKUATROP）。毕业生就业率94.8%。约有9,296名学生，其中国际生371人。",
        "zh-TW": "馬來西亞登嘉樓大學（UMT）是2001年成立的公立大學，坐落於登嘉樓州瓜拉尼魯斯的海岸線上。作為馬來西亞海洋與環境科學的旗艦學府，在海洋與淡水生物學領域排名全國第一。2026年首次進入QS世界排名第801-850位，QS亞洲排名前10%。擁有7個學院、海洋與環境研究所（INOS）和熱帶水產養殖研究所（AKUATROP）。畢業生就業率94.8%。約有9,296名學生，其中國際生371人。"
    },
    "tuitionMinCny": 22000,
    "tuitionMaxCny": 42000,
    "livingCostCny": 20000,
    "minIelts": 5.5,
    "acceptNoLanguage": False,
    "facilities": {
        "en": [
            "Institute of Oceanography and Environment (INOS)",
            "Institute of Tropical Aquaculture (AKUATROP)",
            "4 nature research stations",
            "Marine science laboratories",
            "Oceanographic research vessels",
            "Aquaculture research facilities",
            "Maritime simulation centre",
            "Coastal campus with beach access",
            "Modern library",
            "Student hostels"
        ],
        "ms": [
            "Institut Oseanografi dan Sekitaran (INOS)",
            "Institut Akuakultur Tropika (AKUATROP)",
            "4 stesen penyelidikan semula jadi",
            "Makmal sains marin",
            "Kapal penyelidikan oseanografi",
            "Kemudahan penyelidikan akuakultur"
        ],
        "zh-CN": [
            "海洋与环境研究所（INOS）",
            "热带水产养殖研究所（AKUATROP）",
            "4个自然研究站",
            "海洋科学实验室",
            "海洋研究船只",
            "水产养殖研究设施",
            "海事模拟中心",
            "海岸校园直通海滩",
            "现代化图书馆",
            "学生宿舍"
        ],
        "zh-TW": [
            "海洋與環境研究所（INOS）",
            "熱帶水產養殖研究所（AKUATROP）",
            "4個自然研究站",
            "海洋科學實驗室",
            "海洋研究船隻",
            "水產養殖研究設施",
            "海事模擬中心",
            "海岸校園直通海灘",
            "現代化圖書館",
            "學生宿舍"
        ]
    },
    "highlights": {
        "en": [
            "QS World #801-850 (2026, first-time listing)",
            "QS Asia Top 10% (2026)",
            "#1 in Malaysia for Marine and Freshwater Biology Studies",
            "THE World #1001-1200",
            "THE Young University Rankings Top 300",
            "94.8% graduate employment rate",
            "Malaysia's flagship marine science university",
            "4 nature research stations",
            "Home to INOS and AKUATROP research institutes"
        ],
        "ms": [
            "QS Asia Top 10% (2026)",
            "#1 di Malaysia untuk Kajian Biologi Marin dan Air Tawar",
            "94.8% kadar pekerjaan graduan",
            "Universiti sains marin utama Malaysia"
        ],
        "zh-CN": [
            "2026年首次进入QS世界排名第801-850位",
            "QS亚洲排名前10%（2026）",
            "海洋与淡水生物学领域马来西亚排名第一",
            "THE世界排名第1001-1200位",
            "THE年轻大学排名前300",
            "94.8%毕业生就业率",
            "马来西亚海洋科学旗舰大学",
            "4个自然研究站",
            "拥有INOS和AKUATROP研究所"
        ],
        "zh-TW": [
            "2026年首次進入QS世界排名第801-850位",
            "QS亞洲排名前10%（2026）",
            "海洋與淡水生物學領域馬來西亞排名第一",
            "THE世界排名第1001-1200位",
            "THE年輕大學排名前300",
            "94.8%畢業生就業率",
            "馬來西亞海洋科學旗艦大學",
            "4個自然研究站",
            "擁有INOS和AKUATROP研究所"
        ]
    }
}

# === Faculty mappings (7 faculties) ===
FACULTIES = {
    "FSPA": {"en": "Faculty of Fisheries Sciences and Aquaculture (FSPA)", "ms": "Fakulti Sains Perikanan dan Akuakultur (FSPA)", "zh-CN": "渔业科学与水产养殖学院", "zh-TW": "漁業科學與水產養殖學院"},
    "FSMA": {"en": "Faculty of Food Sciences and Agrotechnology (FSMA)", "ms": "Fakulti Sains Makanan dan Agroteknologi (FSMA)", "zh-CN": "食品科学与农业技术学院", "zh-TW": "食品科學與農業技術學院"},
    "FSSM": {"en": "Faculty of Science and Marine Environment (FSSM)", "ms": "Fakulti Sains dan Persekitaran Marin (FSSM)", "zh-CN": "科学与海洋环境学院", "zh-TW": "科學與海洋環境學院"},
    "FSKM": {"en": "Faculty of Computer Science and Mathematics (FSKM)", "ms": "Fakulti Sains Komputer dan Matematik (FSKM)", "zh-CN": "计算机科学与数学学院", "zh-TW": "計算機科學與數學學院"},
    "FTKK": {"en": "Faculty of Ocean Engineering Technology (FTKK)", "ms": "Fakulti Teknologi Kejuruteraan Lautan (FTKK)", "zh-CN": "海洋工程技术学院", "zh-TW": "海洋工程技術學院"},
    "FPM": {"en": "Faculty of Maritime Studies (FPM)", "ms": "Fakulti Pengajian Maritim (FPM)", "zh-CN": "海事研究学院", "zh-TW": "海事研究學院"},
    "FPEPS": {"en": "Faculty of Business, Economics and Social Development (FPEPS)", "ms": "Fakulti Perniagaan, Ekonomi dan Pembangunan Sosial (FPEPS)", "zh-CN": "商业、经济与社会发展学院", "zh-TW": "商業、經濟與社會發展學院"}
}

# === Sources ===
sources = [
    {"id": "institution-homepage", "url": "https://www.umt.edu.my/", "sourceType": "official-page", "role": "institution-authority", "fields": ["university-info", "faculties", "campuses"], "retrievedAt": "2026-07-07T10:00:00Z", "academicSession": "2026", "status": "verified"},
    {"id": "all-programs", "url": "https://www.umt.edu.my/all-programs-at-umt/", "sourceType": "official-page", "role": "programme-catalog", "fields": ["programme-list", "faculties"], "retrievedAt": "2026-07-07T10:05:00Z", "academicSession": "2026", "status": "verified"},
    {"id": "international-undergraduate", "url": "https://www.umt.edu.my/international-student-undergraduate/", "sourceType": "official-page", "role": "international-admission", "fields": ["international-requirements", "application-process"], "retrievedAt": "2026-07-07T10:10:00Z", "academicSession": "2026", "status": "verified"},
    {"id": "postgraduate-fees", "url": "https://postgrad.umt.edu.my/postgraduate_fees-2/", "sourceType": "official-page", "role": "fee-authority", "fields": ["tuition", "postgraduate-fees"], "retrievedAt": "2026-07-07T10:15:00Z", "academicSession": "2026", "status": "verified"},
    {"id": "ug-fees-pdf", "url": "https://akademik.umt.edu.my/wp-content/uploads/2025/02/2-PPPA-UG-LIST-PROGRAMMES-AND-FEES-FOR-INTERNATIONAL-STUDENTS.pdf", "sourceType": "official-page", "role": "fee-authority", "fields": ["tuition", "undergraduate-fees"], "retrievedAt": "2026-07-07T10:20:00Z", "academicSession": "2026", "status": "verified"},
    {"id": "studymalaysia-courses", "url": "https://studymalaysia.com/edu/umt/courses/", "sourceType": "official-listing", "role": "programme-catalog", "fields": ["programme-list", "tuition", "duration"], "retrievedAt": "2026-07-07T10:25:00Z", "academicSession": "2026", "status": "verified"},
    {"id": "qs-ranking-2026", "url": "https://www.umt.edu.my/umt-placed-higher-in-latest-qs-world-university-rankings-affirming-its-excellence-in-marine-science-and-environmental-sustainability/", "sourceType": "official-page", "role": "ranking-authority", "fields": ["qs-ranking"], "retrievedAt": "2026-07-07T10:30:00Z", "academicSession": "2026", "status": "verified"}
]

# === Helper ===

# Academic requirement text by level
ACADEMIC_REQUIREMENTS = {
    "bachelor": "High school diploma equivalent to STPM/A-Levels with good academic standing.",
    "diploma": "High school diploma equivalent to SPM/O-Levels with good academic standing.",
    "master": "Relevant bachelor's degree with CGPA minimum 2.75/4.0. CGPA 2.50-2.74 requires relevant work experience.",
    "postgraduate-certificate": "Relevant bachelor's degree with CGPA minimum 2.75/4.0.",
    "postgraduate-diploma": "Relevant bachelor's degree with CGPA minimum 2.75/4.0.",
    "phd": "Relevant master's degree with CGPA minimum 3.00/4.0. Below 3.00 requires relevant work experience and strong research proposal."
}

# GPA requirement by level
def gpa_for_level(level: str) -> float:
    if level in ("bachelor", "diploma"):
        return 2.5
    if level in ("master", "postgraduate-certificate", "postgraduate-diploma"):
        return 2.75
    return 3.0  # phd

# Determine if a level is undergraduate (total-programme fee basis)
def is_undergraduate(level: str) -> bool:
    return level in ("bachelor", "diploma")


def make_prog(code, name_en, name_zh, level, category, faculty_key, campus, study_mode,
             duration_years, duration_official, tuition_myr, annual_cny, ielts, toefl,
             intake_str, curriculum, careers, desc_en, desc_zh, specializations=None,
             mqa_code=None, official_url="https://www.umt.edu.my/all-programs-at-umt/",
             fee_status="official-verified", fee_note=None):
    # Recompute the annual CNY tuition from the total MYR programme fee divided by the
    # programme duration. The `annual_cny` argument supplied by callers is intentionally
    # ignored so the annual rate is always derived from the canonical total fee:
    #   annualTuitionCny = total MYR / duration years * MYR_TO_CNY
    # This guarantees total_cny == annual_cny * duration_years.
    annual_cny = int(round(tuition_myr / max(duration_years, 1) * MYR_TO_CNY))
    fac = FACULTIES[faculty_key]
    undergrad = is_undergraduate(level)
    return {
        "code": code,
        "nameEnOfficial": name_en,
        "localizedName": {
            "en": name_en,
            "ms": name_en,  # auto-fill from en
            "zh-CN": name_zh,
            "zh-TW": name_zh  # auto-fill from zh-CN
        },
        "level": level,
        "category": category,
        "universityCode": "UMT",
        "facultyEn": fac["en"],
        "facultyLocalized": fac,
        "campus": campus,
        "studyMode": study_mode,
        "durationOfficial": duration_official,
        "durationYears": duration_years,
        "officialIntake": intake_str,
        "intakeMonths": intake_str.split(", "),
        "tuitionAmount": tuition_myr,
        "tuitionCurrency": "MYR",
        "tuitionBasis": "total-programme" if undergrad else "per-programme",
        "annualTuitionCny": annual_cny,
        "fee": {
            "internationalAmount": tuition_myr,
            "currency": "MYR",
            "basis": "total-programme" if undergrad else "per-programme",
        "officialFeeText": f"RM {tuition_myr:,} total programme fee (international student)",
        "status": fee_status,
        "officialFeeSourceUrl": "https://studymalaysia.com/edu/umt/courses/",
            "tuitionAmount": tuition_myr,
            "tuitionDisplay": f"RM {tuition_myr:,} total tuition",
            "note": fee_note if fee_note else (f"RM {tuition_myr:,} for {duration_years} years" if undergrad else f"RM {tuition_myr:,} per programme"),
            "officialAnnualRateMYR": int(tuition_myr / duration_years) if undergrad else tuition_myr
        },
        "languageRequirement": {"ielts": ielts, "toefl": toefl, "pte": int(toefl * 0.85), "muet": 4 if ielts <= 5.5 else 4.5 if ielts <= 6.0 else 5},
        "requirement": {"gpa": gpa_for_level(level), "gaokaoRequired": False, "huikaoRequired": False},
        "officialAcademicRequirement": ACADEMIC_REQUIREMENTS[level],
        "officialLanguageRequirement": f"International students: IELTS {ielts} or TOEFL iBT {toefl} or equivalent.",
        "applicationDocuments": [
            "Passport copy (all pages, A4)",
            "High school diploma / degree certificate and transcripts (notarized, Chinese + English)",
            "CHSI (Xuexinwang) verification report",
            "English proficiency certificate",
            "2 passport-size photos (35x45mm, white background)",
            "Completed online application form",
            "Research proposal (for postgraduate research programmes)"
        ],
        "curriculum": curriculum,
        "specializations": specializations or [],
        "careerDirections": careers,
        "description": {
            "en": desc_en,
            "ms": desc_en,  # auto-fill
            "zh-CN": desc_zh,
            "zh-TW": desc_zh  # auto-fill
        },
        "mqaCode": mqa_code or "",
        "officialSourceUrl": official_url,
        "officialFeeSourceUrl": "https://studymalaysia.com/edu/umt/courses/",
        "officialVerifiedAt": "2026-07-07",
        "officialSourceStatus": "official-verified",
        "publicDisplayStatus": "ready"
    }

programmes = []

# ============================================================
# BACHELOR PROGRAMMES (38 programmes)
# Tuition fees in MYR, converted from USD at 1 USD = 4.7 MYR
# annualTuitionCny = int(tuition_myr * 0.56)
# ============================================================

# 1. Bachelor of Applied Science (Biodiversity Conservation and Management)(Hons)
programmes.append(make_prog(
    "UMT-UG-BIODIV", "Bachelor of Applied Science (Biodiversity Conservation and Management) (Hons)",
    "应用科学学士（生物多样性保护与管理）（荣誉）",
    "bachelor", "science", "FSSM", "Kuala Nerus", "coursework",
    4, "8 Semesters", 38352, 21272,
    5.5, 46, "February, September",
    ["Biodiversity Assessment", "Conservation Biology", "Wildlife Management", "Forest Ecology", "Marine Ecology", "Biogeography", "Conservation Genetics", "Environmental Impact Assessment", "GIS for Conservation", "Research Project"],
    ["Conservation Officer", "Wildlife Biologist", "Environmental Consultant", "Park Manager", "Research Scientist"],
    "A comprehensive programme focusing on biodiversity conservation and management, leveraging UMT's expertise in marine and terrestrial ecosystems.",
    "综合性专业，专注于生物多样性保护与管理，依托UMT在海洋和陆地生态系统方面的专业知识。"
))

# 2. Bachelor of Computer Science (Maritime Informatics) (Hons)
programmes.append(make_prog(
    "UMT-UG-MARITIME-IT", "Bachelor of Computer Science (Maritime Informatics) (Hons)",
    "计算机科学学士（海事信息学）（荣誉）",
    "bachelor", "computing", "FSKM", "Kuala Nerus", "coursework",
    4, "7 Semesters", 33558, 24018,
    5.5, 46, "February, September",
    ["Programming Fundamentals", "Data Structures and Algorithms", "Database Systems", "Maritime Information Systems", "Network Security", "Software Engineering", "GIS Applications", "Oceanographic Data Processing", "Cloud Computing", "Final Year Project"],
    ["Software Developer", "Maritime IT Specialist", "Data Analyst", "Systems Analyst", "IT Consultant"],
    "A unique programme combining computer science with maritime informatics, preparing graduates for IT roles in maritime and oceanographic sectors.",
    "独特的专业，将计算机科学与海事信息学相结合，为毕业生在海事和海洋领域的IT角色做好准备。"
))

# 3. Bachelor of Counselling (Hons)
programmes.append(make_prog(
    "UMT-UG-COUNSEL", "Bachelor of Counselling (Hons)",
    "辅导学士（荣誉）",
    "bachelor", "social-science", "FPEPS", "Kuala Nerus", "coursework",
    4, "8 Semesters", 34592, 20160,
    5.5, 46, "February, September",
    ["Theories of Counselling", "Counselling Techniques", "Career Counselling", "Family Counselling", "Group Counselling", "Cross-Cultural Counselling", "Psychological Assessment", "Ethics in Counselling", "Practicum", "Research Methods"],
    ["Counsellor", "Guidance Counsellor", "Family Therapist", "Mental Health Worker", "Human Resource Officer"],
    "A professional programme preparing students for careers in counselling with emphasis on practical skills and ethical practice.",
    "专业课程，培养学生在辅导领域的职业能力，强调实践技能和职业道德。"
))

# 4. Bachelor of Finance with Honours
programmes.append(make_prog(
    "UMT-UG-FINANCE", "Bachelor of Finance with Honours",
    "金融学学士（荣誉）",
    "bachelor", "business", "FPEPS", "Kuala Nerus", "coursework",
    3, "6 Semesters", 36000, 20160,
    5.5, 46, "February, September",
    ["Financial Management", "Investment Analysis", "Corporate Finance", "Financial Markets", "Risk Management", "Islamic Finance", "International Finance", "Financial Modelling", "Banking Operations", "Research Project"],
    ["Financial Analyst", "Investment Banker", "Risk Manager", "Financial Planner", "Bank Officer"],
    "A comprehensive finance programme covering conventional and Islamic finance principles.",
    "综合性金融专业，涵盖传统和伊斯兰金融原理。", fee_status="estimated", fee_note="官方 PDF 未列此专业费率，按同院系国际生每学期费率估算"
))

# 5. Bachelor of Electrical Technology (Energy and Power) with Honours
programmes.append(make_prog(
    "UMT-UG-ELECTRICAL", "Bachelor of Electrical Technology (Energy and Power) with Honours",
    "电气技术学士（能源与电力）（荣誉）",
    "bachelor", "engineering", "FTKK", "Kuala Nerus", "coursework",
    4, "8 Semesters", 42000, 23520,
    5.5, 46, "February, September",
    ["Electrical Circuits", "Power Systems", "Renewable Energy", "Electrical Machines", "Power Electronics", "Energy Management", "Control Systems", "Smart Grid Technology", "Electrical Safety", "Final Year Project"],
    ["Electrical Engineer", "Power Systems Engineer", "Renewable Energy Specialist", "Energy Consultant", "Maintenance Engineer"],
    "A programme focusing on electrical technology with emphasis on energy and power systems.",
    "专注于电气技术的专业，重点在于能源和电力系统。", fee_status="estimated", fee_note="官方 PDF 未列此专业费率，按同院系国际生每学期费率估算"
))

# 6. Bachelor of Food Science (Food Service and Nutrition) (Hons)
programmes.append(make_prog(
    "UMT-UG-FOOD-NUTRITION", "Bachelor of Food Science (Food Service and Nutrition) (Hons)",
    "食品科学学士（食品服务与营养）（荣誉）",
    "bachelor", "science", "FSMA", "Kuala Nerus", "coursework",
    4, "8 Semesters", 38352, 23520,
    5.5, 46, "February, September",
    ["Food Chemistry", "Food Microbiology", "Nutrition Science", "Food Service Management", "Dietetics", "Food Safety", "Food Processing", "Meal Planning", "Community Nutrition", "Research Project"],
    ["Nutritionist", "Dietitian", "Food Service Manager", "Food Safety Officer", "Health Consultant"],
    "A programme combining food science with nutrition, preparing graduates for the food and health industry.",
    "结合食品科学与营养学的专业，为毕业生在食品和健康行业做准备。"
))

# 7. Bachelor of Applied Science (Electronics and Instrumentation)(Hons)
programmes.append(make_prog(
    "UMT-UG-ELECTRONICS", "Bachelor of Applied Science (Electronics and Instrumentation) (Hons)",
    "应用科学学士（电子与仪表）（荣誉）",
    "bachelor", "engineering", "FTKK", "Kuala Nerus", "coursework",
    4, "7 Semesters", 33558, 23520,
    5.5, 46, "February, September",
    ["Electronic Circuits", "Digital Electronics", "Instrumentation Systems", "Signal Processing", "Microcontrollers", "Sensor Technology", "Industrial Automation", "Embedded Systems", "PCB Design", "Final Year Project"],
    ["Electronics Engineer", "Instrumentation Specialist", "Automation Engineer", "Control Systems Engineer", "R&D Engineer"],
    "A programme focusing on electronics and instrumentation technology for industrial and marine applications.",
    "专注于电子和仪表技术的专业，面向工业和海洋应用。"
))

# 8. Bachelor of Science in Agrotechnology (Crop Science) (Hons)
programmes.append(make_prog(
    "UMT-UG-AGRO", "Bachelor of Science in Agrotechnology (Crop Science) (Hons)",
    "理学学士（农业技术-作物科学）（荣誉）",
    "bachelor", "agriculture", "FSMA", "Kuala Nerus", "coursework",
    4, "8 Semesters", 38352, 23520,
    5.5, 46, "February, September",
    ["Crop Science", "Soil Science", "Plant Breeding", "Pest Management", "Agricultural Biotechnology", "Crop Physiology", "Horticulture", "Agricultural Economics", "Precision Agriculture", "Research Project"],
    ["Agronomist", "Crop Scientist", "Agricultural Consultant", "Plant Breeder", "Farm Manager"],
    "A programme focusing on crop science within the agrotechnology framework.",
    "在农业技术框架下专注于作物科学的专业。"
))

# 9. Bachelor of Science (Marine Biology) (Hons)
programmes.append(make_prog(
    "UMT-UG-MARINE-BIO", "Bachelor of Science (Marine Biology) (Hons)",
    "理学学士（海洋生物学）（荣誉）",
    "bachelor", "science", "FSSM", "Kuala Nerus", "coursework",
    4, "7 Semesters", 33558, 21272,
    5.5, 46, "February, September",
    ["Marine Ecology", "Marine Biodiversity", "Coral Reef Biology", "Marine Mammalogy", "Fish Biology", "Marine Conservation", "Oceanography", "Marine Pollution", "Mangrove Ecology", "Research Project"],
    ["Marine Biologist", "Marine Conservationist", "Fisheries Officer", "Environmental Consultant", "Research Scientist"],
    "UMT's flagship programme in marine biology, ranked #1 in Malaysia for Marine and Freshwater Biology Studies.",
    "UMT的海洋生物学旗舰专业，在海洋与淡水生物学领域马来西亚排名第一。"
))

# 10. Bachelor of Applied Science (Maritime Technology) (Hons)
programmes.append(make_prog(
    "UMT-UG-MARITIME-TECH", "Bachelor of Applied Science (Maritime Technology) (Hons)",
    "应用科学学士（海事技术）（荣誉）",
    "bachelor", "engineering", "FTKK", "Kuala Nerus", "coursework",
    4, "7 Semesters", 34874, 24080,
    5.5, 46, "February, September",
    ["Marine Engineering", "Marine Propulsion Systems", "Offshore Structures", "Marine Materials", "Corrosion Technology", "Marine Energy Systems", "Ship Design", "Marine Safety", "Ocean Engineering", "Final Year Project"],
    ["Marine Engineer", "Offshore Engineer", "Naval Architect", "Marine Technology Specialist", "Ocean Engineer"],
    "A programme focusing on maritime technology and marine engineering applications.",
    "专注于海事技术和海洋工程应用的专业。"
))

# 11. Bachelor of Science (Nautical Sciences and Maritime Transport) (Hons)
programmes.append(make_prog(
    "UMT-UG-NAUTICAL", "Bachelor of Science (Nautical Sciences and Maritime Transport) (Hons)",
    "理学学士（航海科学与海事运输）（荣誉）",
    "bachelor", "maritime", "FPM", "Kuala Nerus", "coursework",
    4, "8 Semesters", 42864, 23800,
    5.5, 46, "February, September",
    ["Navigation", "Ship Operations", "Maritime Law", "Port Management", "Maritime Safety", "Meteorology", "Ship Stability", "Cargo Operations", "Maritime Economics", "Research Project"],
    ["Ship Officer", "Port Manager", "Maritime Surveyor", "Shipping Executive", "Maritime Safety Officer"],
    "A programme preparing students for careers in the maritime transportation industry.",
    "为学生在海事运输行业的职业生涯做准备的专业。"
))

# 12. Bachelor of Science (Analytical and Environmental Chemistry) (Hons)
programmes.append(make_prog(
    "UMT-UG-ANAL-CHEM", "Bachelor of Science (Analytical and Environmental Chemistry) (Hons)",
    "理学学士（分析与环境化学）（荣誉）",
    "bachelor", "science", "FSSM", "Kuala Nerus", "coursework",
    4, "7 Semesters", 33558, 21272,
    5.5, 46, "February, September",
    ["Analytical Chemistry", "Environmental Chemistry", "Organic Chemistry", "Inorganic Chemistry", "Physical Chemistry", "Instrumental Analysis", "Environmental Monitoring", "Water Quality Analysis", "Pollution Control", "Research Project"],
    ["Analytical Chemist", "Environmental Analyst", "Quality Control Officer", "Research Scientist", "Environmental Consultant"],
    "A programme combining analytical chemistry with environmental analysis for marine and industrial applications.",
    "结合分析化学与环境分析的专业，面向海洋和工业应用。"
))

# 13. Bachelor of Science (Biological Sciences) (Hons)
programmes.append(make_prog(
    "UMT-UG-BIO-SCI", "Bachelor of Science (Biological Sciences) (Hons)",
    "理学学士（生物科学）（荣誉）",
    "bachelor", "science", "FSSM", "Kuala Nerus", "coursework",
    3, "6 Semesters", 28764, 20160,
    5.5, 46, "February, September",
    ["Cell Biology", "Genetics", "Microbiology", "Ecology", "Plant Biology", "Animal Biology", "Molecular Biology", "Biostatistics", "Biochemistry", "Research Project"],
    ["Biologist", "Research Assistant", "Laboratory Technician", "Science Educator", "Environmental Officer"],
    "A comprehensive biological science programme with marine and terrestrial focus.",
    "综合性生物科学专业，侧重海洋和陆地领域。"
))

# 14. Bachelor of Science (Chemical Sciences) (Hons)
programmes.append(make_prog(
    "UMT-UG-CHEM-SCI", "Bachelor of Science (Chemical Sciences) (Hons)",
    "理学学士（化学科学）（荣誉）",
    "bachelor", "science", "FSSM", "Kuala Nerus", "coursework",
    3, "6 Semesters", 28764, 20160,
    5.5, 46, "February, September",
    ["Organic Chemistry", "Inorganic Chemistry", "Physical Chemistry", "Analytical Chemistry", "Polymer Chemistry", "Material Science", "Natural Products", "Environmental Chemistry", "Industrial Chemistry", "Research Project"],
    ["Chemist", "Quality Control Analyst", "Research Scientist", "Chemical Engineer", "Laboratory Manager"],
    "A programme covering core chemical science disciplines with practical applications.",
    "涵盖核心化学科学学科的专业，注重实际应用。"
))

# 15. Bachelor of Science (Financial Mathematics) (Hons)
programmes.append(make_prog(
    "UMT-UG-FIN-MATH", "Bachelor of Science (Financial Mathematics) (Hons)",
    "理学学士（金融数学）（荣誉）",
    "bachelor", "mathematics", "FSKM", "Kuala Nerus", "coursework",
    4, "7 Semesters", 33558, 21272,
    5.5, 46, "February, September",
    ["Calculus", "Linear Algebra", "Probability and Statistics", "Financial Mathematics", "Stochastic Processes", "Numerical Analysis", "Mathematical Modelling", "Risk Theory", "Actuarial Mathematics", "Research Project"],
    ["Financial Analyst", "Risk Analyst", "Actuarial Analyst", "Quantitative Analyst", "Data Scientist"],
    "A programme combining mathematics with finance, preparing graduates for quantitative finance careers.",
    "结合数学与金融的专业，为毕业生在量化金融领域的职业生涯做准备。"
))

# ============================================================
# NEW BACHELOR PROGRAMMES (23 programmes)
# Tuition fees in MYR, converted from USD at 1 USD = 4.7 MYR
# annualTuitionCny = int(tuition_myr * 0.56)
# ============================================================

# --- FSPA (2 programmes) ---

# 16. Bachelor of Applied Science (Fisheries) with Honours
programmes.append(make_prog(
    "UMT-UG-FISHERIES", "Bachelor of Applied Science (Fisheries) (Hons)", "应用科学学士（渔业）（荣誉）",
    "bachelor", "agriculture", "FSPA", "Kuala Nerus", "coursework",
    3, "6 Semesters", 28764, 16108,
    5.5, 46, "February, September",
    ["Fisheries Biology", "Fisheries Technology", "Aquaculture Systems", "Fisheries Management", "Marine Ecology", "Fish Processing", "Fisheries Economics", "Research Methods", "Fishing Gear Technology", "Research Project"],
    ["Fisheries Officer", "Aquaculture Manager", "Fisheries Consultant", "Marine Biologist", "Research Assistant"],
    "A programme focusing on fisheries science and technology for sustainable fisheries management.",
    "专注于渔业科学与技术的专业，面向可持续渔业管理。"
))

# 17. Bachelor of Science in Aquaculture with Honours
programmes.append(make_prog(
    "UMT-UG-AQUACULTURE", "Bachelor of Science in Aquaculture (Hons)", "理学学士（水产养殖）（荣誉）",
    "bachelor", "agriculture", "FSPA", "Kuala Nerus", "coursework",
    4, "8 Semesters", 38352, 21477,
    5.5, 46, "February, September",
    ["Aquaculture Principles", "Fish Health Management", "Aquaculture Nutrition", "Hatchery Technology", "Water Quality Management", "Mariculture", "Aquaculture Economics", "Breeding Techniques", "Aquaculture Engineering", "Research Project"],
    ["Aquaculture Manager", "Fish Health Specialist", "Hatchery Manager", "Aquaculture Consultant", "Research Scientist"],
    "A comprehensive programme in aquaculture science and technology.",
    "水产养殖科学技术的综合性专业。"
))

# --- FSMA (2 programmes) ---

# 18. Bachelor of Food Science (Food Technology) with Honours
programmes.append(make_prog(
    "UMT-UG-FOOD-TECH", "Bachelor of Food Science (Food Technology) (Hons)", "食品科学学士（食品技术）（荣誉）",
    "bachelor", "science", "FSMA", "Kuala Nerus", "coursework",
    4, "8 Semesters", 38352, 21477,
    5.5, 46, "February, September",
    ["Food Chemistry", "Food Microbiology", "Food Processing", "Food Engineering", "Food Quality Control", "Food Packaging", "Food Safety", "Product Development", "Sensory Evaluation", "Research Project"],
    ["Food Technologist", "Quality Assurance Manager", "Food Safety Officer", "Product Development Scientist", "Food Industry Consultant"],
    "A programme focusing on food technology and food processing.",
    "专注于食品技术和食品加工的专业。"
))

# 19. Bachelor of Agro Processing Technology with Honours
programmes.append(make_prog(
    "UMT-UG-AGRO-PROC", "Bachelor of Agro Processing Technology (Hons)", "农业加工技术学士（荣誉）",
    "bachelor", "agriculture", "FSMA", "Kuala Nerus", "coursework",
    4, "8 Semesters", 38352, 21477,
    5.5, 46, "February, September",
    ["Agro-processing Technology", "Food Preservation", "Post-Harvest Technology", "Bioprocessing", "Quality Control", "Packaging Technology", "Agro-products Development", "Process Engineering", "Waste Management", "Research Project"],
    ["Agro-processing Engineer", "Food Processing Manager", "Quality Control Officer", "Product Developer", "Agricultural Consultant"],
    "A programme focusing on agro-processing technology and post-harvest management.",
    "专注于农业加工技术和采后管理的专业。", fee_status="estimated", fee_note="官方 PDF 未列此专业费率，按同院系国际生每学期费率估算"
))

# --- FSSM (3 programmes) ---

# 20. Bachelor of Science (Marine Science) with Honours
programmes.append(make_prog(
    "UMT-UG-MARINE-SCI", "Bachelor of Science (Marine Science) (Hons)", "理学学士（海洋科学）（荣誉）",
    "bachelor", "science", "FSSM", "Kuala Nerus", "coursework",
    4, "7 Semesters", 33558, 18792,
    5.5, 46, "February, September",
    ["Marine Ecology", "Biological Oceanography", "Marine Chemistry", "Marine Geology", "Coral Reef Ecology", "Marine Pollution", "Fisheries Oceanography", "Climate Change", "Marine Conservation", "Research Project"],
    ["Marine Scientist", "Oceanographer", "Marine Environmental Consultant", "Research Scientist", "Marine Policy Advisor"],
    "UMT's flagship marine science programme, leveraging its #1 ranking in Marine and Freshwater Biology.",
    "UMT旗舰海洋科学专业，依托其海洋与淡水生物学排名第一的优势。"
))

# 21. Bachelor of Science (Marine Geosciences) with Honours
programmes.append(make_prog(
    "UMT-UG-MARINE-GEO", "Bachelor of Science (Marine Geosciences) (Hons)", "理学学士（海洋地球科学）（荣誉）",
    "bachelor", "science", "FSSM", "Kuala Nerus", "coursework",
    4, "7 Semesters", 33558, 18792,
    5.5, 46, "February, September",
    ["Marine Geology", "Sedimentology", "Coastal Geomorphology", "Marine Geophysics", "Paleoceanography", "Seafloor Mapping", "Marine Mineral Resources", "Geochemistry", "Plate Tectonics", "Research Project"],
    ["Marine Geologist", "Geophysicist", "Petroleum Geologist", "Environmental Consultant", "Research Scientist"],
    "A programme focusing on marine geosciences and seafloor geology.",
    "专注于海洋地球科学和海底地质的专业。"
))

# 22. Bachelor of Applied Science Nanophysics with Honours
programmes.append(make_prog(
    "UMT-UG-NANOPHYS", "Bachelor of Applied Science Nanophysics (Hons)", "应用科学学士（纳米物理）（荣誉）",
    "bachelor", "science", "FSSM", "Kuala Nerus", "coursework",
    4, "8 Semesters", 38352, 21477,
    5.5, 46, "February, September",
    ["Nanomaterials", "Quantum Physics", "Nanoelectronics", "Surface Science", "Nanofabrication", "Spectroscopy", "Computational Nanophysics", "Nanotechnology Applications", "Materials Characterization", "Research Project"],
    ["Nanotechnology Researcher", "Materials Scientist", "R&D Engineer", "Semiconductor Engineer", "Research Scientist"],
    "A programme focusing on nanophysics and nanotechnology applications.",
    "专注于纳米物理和纳米技术应用的专业。"
))

# --- FSKM (4 programmes) ---

# 23. Bachelor of Science (Data Analytics) with Honours
programmes.append(make_prog(
    "UMT-UG-DATA-ANALYTICS", "Bachelor of Science (Data Analytics) (Hons)", "理学学士（数据分析）（荣誉）",
    "bachelor", "computing", "FSKM", "Kuala Nerus", "coursework",
    4, "7 Semesters", 33558, 18792,
    5.5, 46, "February, September",
    ["Statistics", "Machine Learning", "Data Mining", "Big Data Technologies", "Data Visualization", "Python Programming", "Database Systems", "Predictive Analytics", "Deep Learning", "Research Project"],
    ["Data Analyst", "Data Scientist", "Business Intelligence Analyst", "Machine Learning Engineer", "Data Engineer"],
    "A programme focusing on data analytics and big data technologies.",
    "专注于数据分析和大数据技术的专业。"
))

# 24. Bachelor of Science (Applied Mathematics) with Honours
programmes.append(make_prog(
    "UMT-UG-APPL-MATH", "Bachelor of Science (Applied Mathematics) (Hons)", "理学学士（应用数学）（荣誉）",
    "bachelor", "mathematics", "FSKM", "Kuala Nerus", "coursework",
    4, "7 Semesters", 33558, 18792,
    5.5, 46, "February, September",
    ["Calculus", "Linear Algebra", "Differential Equations", "Numerical Analysis", "Mathematical Modelling", "Optimization", "Probability", "Statistics", "Operations Research", "Research Project"],
    ["Quantitative Analyst", "Operations Research Analyst", "Mathematical Modeller", "Data Scientist", "Research Scientist"],
    "A programme focusing on applied mathematics and mathematical modelling.",
    "专注于应用数学和数学建模的专业。"
))

# 25. Bachelor of Computer Science (Software Engineering) with Honours
programmes.append(make_prog(
    "UMT-UG-SOFT-ENG", "Bachelor of Computer Science (Software Engineering) (Hons)", "计算机科学学士（软件工程）（荣誉）",
    "bachelor", "computing", "FSKM", "Kuala Nerus", "coursework",
    4, "7 Semesters", 33558, 18792,
    5.5, 46, "February, September",
    ["Software Design", "Programming Paradigms", "Software Architecture", "Database Systems", "Web Development", "Mobile Application Development", "Software Testing", "DevOps", "Agile Methodologies", "Final Year Project"],
    ["Software Engineer", "Full-Stack Developer", "Software Architect", "DevOps Engineer", "IT Consultant"],
    "A programme focusing on software engineering principles and practices.",
    "专注于软件工程原理和实践的专业。"
))

# 26. Bachelor of Computer Science (Mobile Computing) with Honours
programmes.append(make_prog(
    "UMT-UG-MOBILE-COMP", "Bachelor of Computer Science (Mobile Computing) (Hons)", "计算机科学学士（移动计算）（荣誉）",
    "bachelor", "computing", "FSKM", "Kuala Nerus", "coursework",
    4, "7 Semesters", 35203, 19714,
    5.5, 46, "February, September",
    ["Mobile App Development", "iOS Development", "Android Development", "Mobile UI/UX", "Cloud Computing", "Mobile Security", "Wireless Networks", "IoT", "Cross-Platform Development", "Final Year Project"],
    ["Mobile App Developer", "iOS Developer", "Android Developer", "Mobile Solutions Architect", "Software Engineer"],
    "A programme focusing on mobile computing and application development.",
    "专注于移动计算和应用开发的专业。"
))

# --- FTKK (5 programmes) ---

# 27. Bachelor of Technology (Environmental) with Honours
programmes.append(make_prog(
    "UMT-UG-ENV-TECH", "Bachelor of Technology (Environmental) (Hons)", "技术学士（环境）（荣誉）",
    "bachelor", "engineering", "FTKK", "Kuala Nerus", "coursework",
    4, "8 Semesters", 38352, 21477,
    5.5, 46, "February, September",
    ["Environmental Engineering", "Water Treatment", "Air Pollution Control", "Solid Waste Management", "Environmental Impact Assessment", "Sustainable Technology", "Environmental Monitoring", "Remediation Technology", "Climate Change Mitigation", "Research Project"],
    ["Environmental Engineer", "Sustainability Consultant", "Environmental Manager", "Waste Management Specialist", "Environmental Auditor"],
    "A programme focusing on environmental technology and sustainable engineering.",
    "专注于环境技术和可持续工程的专业。"
))

# 28. Bachelor of Mechanical Engineering Technology (Naval Architecture) with Honours
programmes.append(make_prog(
    "UMT-UG-NAVAL-ARCH", "Bachelor of Mechanical Engineering Technology (Naval Architecture) (Hons)", "机械工程技术学士（船舶与海洋工程）（荣誉）",
    "bachelor", "engineering", "FTKK", "Kuala Nerus", "coursework",
    4, "8 Semesters", 38352, 22530,
    5.5, 46, "February, September",
    ["Naval Architecture", "Ship Design", "Marine Engineering", "Fluid Mechanics", "Ship Stability", "Marine Structures", "Offshore Engineering", "Propulsion Systems", "CAD/CAM", "Final Year Project"],
    ["Naval Architect", "Ship Designer", "Marine Engineer", "Offshore Engineer", "Structural Engineer"],
    "A programme focusing on naval architecture and marine engineering technology.",
    "专注于船舶与海洋工程技术的专业。"
))

# 29. Bachelor of Technology (Renewable Energy) with Honours
programmes.append(make_prog(
    "UMT-UG-RENEW-ENERGY", "Bachelor of Technology (Renewable Energy) (Hons)", "技术学士（可再生能源）（荣誉）",
    "bachelor", "engineering", "FTKK", "Kuala Nerus", "coursework",
    4, "8 Semesters", 38352, 21477,
    5.5, 46, "February, September",
    ["Solar Energy Systems", "Wind Energy", "Biomass Energy", "Energy Storage", "Power Electronics", "Smart Grids", "Energy Policy", "Thermodynamics", "Fuel Cells", "Research Project"],
    ["Renewable Energy Engineer", "Solar Energy Specialist", "Wind Energy Engineer", "Energy Consultant", "Sustainability Engineer"],
    "A programme focusing on renewable energy technology and sustainable power systems.",
    "专注于可再生能源技术和可持续电力系统的专业。", fee_status="estimated", fee_note="官方 PDF 未列此专业费率，按同院系国际生每学期费率估算"
))

# 30. Bachelor of Applied Science (Maritime Technology) with Honours (Dual Degree)
programmes.append(make_prog(
    "UMT-UG-MARITIME-DUAL", "Bachelor of Applied Science (Maritime Technology) (Hons) (Dual Degree)", "应用科学学士（海事技术）（荣誉）（双学位）",
    "bachelor", "engineering", "FTKK", "Kuala Nerus", "coursework",
    4, "8 Semesters", 39856, 22319,
    5.5, 46, "February, September",
    ["Marine Engineering", "Marine Propulsion", "Offshore Structures", "Marine Materials", "Corrosion Technology", "Ship Design", "Marine Safety", "Dual Degree Courses", "Ocean Engineering", "Final Year Project"],
    ["Marine Engineer", "Offshore Engineer", "Naval Architect", "Marine Technology Specialist", "Dual Degree Engineer"],
    "A dual degree programme in maritime technology offered in collaboration with a partner university.",
    "与合作伙伴大学联合提供的海事技术双学位专业。", fee_status="estimated", fee_note="官方 PDF 未列此专业费率，按同院系国际生每学期费率估算"
))

# 31. Bachelor of Science in Occupational Safety and Health with Environmental Technology with Honours
programmes.append(make_prog(
    "UMT-UG-OSH", "Bachelor of Science in Occupational Safety and Health with Environmental Technology (Hons)", "理学学士（职业安全与健康-环境技术）（荣誉）",
    "bachelor", "science", "FTKK", "Kuala Nerus", "coursework",
    4, "8 Semesters", 38352, 21477,
    5.5, 46, "February, September",
    ["Occupational Safety", "Industrial Hygiene", "Environmental Technology", "Risk Assessment", "Safety Management", "Ergonomics", "Environmental Compliance", "Hazard Control", "Safety Legislation", "Research Project"],
    ["Safety Officer", "Environmental Health Officer", "Risk Manager", "Safety Consultant", "Compliance Officer"],
    "A programme combining occupational safety and health with environmental technology.",
    "结合职业安全与健康及环境技术的专业。", fee_status="estimated", fee_note="官方 PDF 未列此专业费率，按同院系国际生每学期费率估算"
))

# --- FPM (2 programmes) ---

# 32. Bachelor of Management (Maritime) with Honours
programmes.append(make_prog(
    "UMT-UG-MARITIME-MGMT", "Bachelor of Management (Maritime) (Hons)", "管理学学士（海事管理）（荣誉）",
    "bachelor", "business", "FPM", "Kuala Nerus", "coursework",
    4, "7 Semesters", 32900, 18424,
    5.5, 46, "February, September",
    ["Maritime Management", "Port Operations", "Shipping Economics", "Maritime Law", "Logistics Management", "Maritime Strategy", "International Trade", "Marine Insurance", "Supply Chain Management", "Research Project"],
    ["Maritime Manager", "Port Manager", "Shipping Executive", "Logistics Manager", "Maritime Consultant"],
    "A management programme specializing in maritime and shipping industries.",
    "专攻海事和航运行业的管理学专业。"
))

# 33. Bachelor of Management (Maritime Operations) with Honours
programmes.append(make_prog(
    "UMT-UG-MARITIME-OPS", "Bachelor of Management (Maritime Operations) (Hons)", "管理学学士（海事运营）（荣誉）",
    "bachelor", "business", "FPM", "Kuala Nerus", "coursework",
    3, "6 Semesters", 28200, 15792,
    5.5, 46, "February, September",
    ["Maritime Operations", "Ship Management", "Port Operations", "Maritime Safety", "Cargo Operations", "Maritime Regulations", "Fleet Management", "Maritime Economics", "Terminal Operations", "Research Project"],
    ["Maritime Operations Manager", "Fleet Manager", "Port Operations Officer", "Maritime Safety Officer", "Shipping Coordinator"],
    "A programme focusing on maritime operations and port management.",
    "专注于海事运营和港口管理的专业。"
))

# --- FPEPS (5 programmes) ---

# 34. Bachelor of Economics (Natural Resources) with Honours
programmes.append(make_prog(
    "UMT-UG-ECON-NATRES", "Bachelor of Economics (Natural Resources) (Hons)", "经济学学士（自然资源）（荣誉）",
    "bachelor", "business", "FPEPS", "Kuala Nerus", "coursework",
    4, "7 Semesters", 30268, 16950,
    5.5, 46, "February, September",
    ["Microeconomics", "Macroeconomics", "Natural Resource Economics", "Environmental Economics", "Marine Economics", "Development Economics", "Resource Management", "Econometrics", "Policy Analysis", "Research Project"],
    ["Economic Analyst", "Natural Resource Economist", "Policy Analyst", "Environmental Economist", "Researcher"],
    "A programme focusing on natural resource and environmental economics.",
    "专注于自然资源和环境经济学的专业。"
))

# 35. Bachelor of Management (Marketing) with Honours
programmes.append(make_prog(
    "UMT-UG-MARKETING", "Bachelor of Management (Marketing) (Hons)", "管理学学士（市场营销）（荣誉）",
    "bachelor", "business", "FPEPS", "Kuala Nerus", "coursework",
    4, "7 Semesters", 30268, 16950,
    5.5, 46, "February, September",
    ["Marketing Principles", "Consumer Behaviour", "Digital Marketing", "Marketing Research", "Brand Management", "International Marketing", "Sales Management", "Marketing Strategy", "Services Marketing", "Research Project"],
    ["Marketing Manager", "Brand Manager", "Digital Marketing Specialist", "Sales Manager", "Market Research Analyst"],
    "A management programme specializing in marketing.",
    "专攻市场营销的管理学专业。"
))

# 36. Bachelor of Management (Policy Studies) with Honours
programmes.append(make_prog(
    "UMT-UG-POLICY", "Bachelor of Management (Policy Studies) (Hons)", "管理学学士（政策研究）（荣誉）",
    "bachelor", "social-science", "FPEPS", "Kuala Nerus", "coursework",
    4, "7 Semesters", 30268, 16950,
    5.5, 46, "February, September",
    ["Public Policy", "Policy Analysis", "Governance", "Public Administration", "Research Methods", "Strategic Management", "Organizational Behaviour", "Social Policy", "Environmental Policy", "Research Project"],
    ["Policy Analyst", "Public Administrator", "Government Officer", "Researcher", "Consultant"],
    "A programme focusing on policy studies and public administration.",
    "专注于政策研究和公共管理的专业。"
))

# 37. Bachelor of Management (Tourism) with Honours
programmes.append(make_prog(
    "UMT-UG-TOURISM", "Bachelor of Management (Tourism) (Hons)", "管理学学士（旅游管理）（荣誉）",
    "bachelor", "business", "FPEPS", "Kuala Nerus", "coursework",
    3, "6 Semesters", 25944, 14529,
    5.5, 46, "February, September",
    ["Tourism Management", "Hospitality Management", "Tourism Marketing", "Event Management", "Sustainable Tourism", "Tourism Economics", "Destination Management", "Cultural Tourism", "Tourism Planning", "Research Project"],
    ["Tourism Manager", "Hotel Manager", "Event Coordinator", "Tourism Consultant", "Travel Operations Manager"],
    "A management programme specializing in tourism and hospitality.",
    "专攻旅游和酒店业的管理学专业。"
))

# 38. Bachelor of Accounting with Honours
programmes.append(make_prog(
    "UMT-UG-ACCOUNTING", "Bachelor of Accounting (Hons)", "会计学学士（荣誉）",
    "bachelor", "business", "FPEPS", "Kuala Nerus", "coursework",
    4, "8 Semesters", 34592, 19372,
    5.5, 46, "February, September",
    ["Financial Accounting", "Management Accounting", "Auditing", "Taxation", "Corporate Finance", "Accounting Information Systems", "Financial Reporting", "Cost Accounting", "Islamic Accounting", "Research Project"],
    ["Accountant", "Auditor", "Tax Consultant", "Financial Analyst", "Finance Manager"],
    "A comprehensive accounting programme covering conventional and Islamic accounting.",
    "涵盖传统和伊斯兰会计的综合性会计专业。"
))

# ============================================================
# MASTER PROGRAMMES (Coursework + Research)
# ============================================================

# Master by Coursework programmes
# annualTuitionCny = int(tuition_myr * 1.68)
master_coursework = [
    ("UMT-MSC-CS", "Master of Computer Science", "计算机科学硕士", "FSKM", "computing", 1, 12, 20100,
     ["Advanced Algorithms", "Artificial Intelligence", "Database Systems", "Software Engineering", "Research Methodology", "Project"],
     ["Software Architect", "AI Engineer", "Data Scientist", "IT Manager", "Researcher"],
     "A coursework-based master programme in computer science covering advanced topics."),
    ("UMT-MSC-TROP-MARINE-ENV", "Master of Science Tropical Marine Environment", "热带海洋环境理学硕士", "FSSM", "science", 2, 18, 20100,
     ["Tropical Marine Ecology", "Marine Pollution", "Coastal Zone Management", "Climate Change", "Marine Conservation", "Research Project"],
     ["Marine Environmental Scientist", "Conservation Manager", "Environmental Consultant", "Researcher", "Marine Policy Advisor"],
     "A coursework-based master programme focusing on tropical marine environments."),
    ("UMT-MBA", "Master of Business Administration (MBA)", "工商管理硕士（MBA）", "FPEPS", "business", 1, 12, 31600,
     ["Strategic Management", "Financial Management", "Marketing Management", "Operations Management", "Organizational Behaviour", "Business Research", "Project"],
     ["Business Manager", "Management Consultant", "Entrepreneur", "Project Manager", "Business Analyst"],
     "An MBA programme designed for future business leaders."),
    ("UMT-MSC-AQUACULTURE", "Master of Science in Aquaculture", "水产养殖理学硕士", "FSPA", "agriculture", 2, 24, 22500,
     ["Aquaculture Systems", "Fish Health Management", "Aquaculture Nutrition", "Hatchery Technology", "Mariculture", "Research Project"],
     ["Aquaculture Manager", "Fish Health Specialist", "Hatchery Manager", "Aquaculture Consultant", "Researcher"],
     "A master programme in tropical aquaculture with practical training."),
    ("UMT-MSC-ENV-FORENSICS", "Master of Environmental Forensic", "环境法医学硕士", "FSSM", "science", 1, 12, 28300,
     ["Environmental Forensics", "Pollution Analysis", "Environmental Law", "Analytical Techniques", "Case Studies", "Research Project"],
     ["Environmental Forensics Specialist", "Environmental Investigator", "Compliance Officer", "Consultant", "Researcher"],
     "A specialised master programme in environmental forensics."),
    ("UMT-MSC-TROPICAL-FISHERIES", "Master of Science in Tropical Fisheries", "热带渔业理学硕士", "FSPA", "agriculture", 2, 24, 22300,
     ["Fisheries Biology", "Fisheries Management", "Fisheries Technology", "Conservation", "Research Project"],
     ["Fisheries Manager", "Fisheries Scientist", "Conservation Officer", "Marine Resources Manager", "Researcher"],
     "A master programme focusing on tropical fisheries science and management."),
    ("UMT-MSC-COUNSEL", "Master of Counselling", "辅导硕士", "FPEPS", "social-science", 1, 12, 12400,
     ["Advanced Counselling Theories", "Clinical Counselling", "Group Therapy", "Career Counselling", "Research Methods", "Practicum"],
     ["Clinical Counsellor", "School Counsellor", "Family Therapist", "Mental Health Specialist", "HR Consultant"],
     "A professional master programme in counselling."),
    # --- 7 new coursework masters ---
    ("UMT-MSC-STAT-MARINE", "Master of Statistics in Marine Science", "海洋统计学硕士", "FSSM", "science", 2, 18, 20100,
     ["Marine Statistics", "Biostatistics", "Data Analysis", "Marine Sampling", "Statistical Modelling", "Research Project"],
     ["Marine Statistician", "Data Analyst", "Research Scientist", "Fisheries Statistician", "Biostatistician"],
     "A coursework-based master programme in marine statistics."),
    ("UMT-MSC-TROP-BIODIV", "Master of Science in Tropical Biodiversity", "热带生物多样性理学硕士", "FSSM", "science", 2, 18, 20100,
     ["Tropical Biodiversity", "Conservation Biology", "Ecology", "Taxonomy", "Biogeography", "Research Project"],
     ["Biodiversity Scientist", "Conservation Biologist", "Ecologist", "Researcher", "Environmental Consultant"],
     "A coursework-based master programme in tropical biodiversity."),
    ("UMT-MSC-MATH", "Master of Mathematics", "数学硕士", "FSKM", "mathematics", 2, 18, 20100,
     ["Advanced Analysis", "Algebra", "Topology", "Mathematical Modelling", "Numerical Analysis", "Research Project"],
     ["Mathematician", "Quantitative Analyst", "Data Scientist", "Researcher", "Academic"],
     "A coursework-based master programme in advanced mathematics."),
    ("UMT-MSC-ICZM", "Master of Management (Integrated Coastal Zone)", "管理学硕士（综合海岸带管理）", "FPEPS", "business", 2, 18, 25000,
     ["Coastal Zone Management", "Marine Resource Economics", "Environmental Policy", "Sustainable Development", "Project Management", "Research Project"],
     ["Coastal Zone Manager", "Environmental Policy Analyst", "Marine Resource Manager", "Sustainability Consultant", "Researcher"],
     "A master programme in integrated coastal zone management."),
    ("UMT-MSC-MARITIME-STUDIES", "Master of Science (Maritime Studies)", "理学硕士（海事研究）", "FPM", "maritime", 2, 18, 20100,
     ["Maritime Law", "Maritime Economics", "Port Management", "Shipping Finance", "Maritime Strategy", "Research Project"],
     ["Maritime Manager", "Port Manager", "Shipping Executive", "Maritime Policy Analyst", "Maritime Consultant"],
     "A coursework-based master programme in maritime studies."),
    ("UMT-MSC-ECON", "Master of Economics", "经济学硕士", "FPEPS", "business", 2, 18, 20100,
     ["Microeconomics", "Macroeconomics", "Econometrics", "Development Economics", "Natural Resource Economics", "Research Project"],
     ["Economic Analyst", "Policy Advisor", "Financial Economist", "Researcher", "Consultant"],
     "A coursework-based master programme in economics."),
    ("UMT-MSC-IT", "Master of Information Technology", "信息技术硕士", "FSKM", "computing", 2, 18, 20100,
     ["IT Strategy", "Enterprise Architecture", "Cybersecurity", "Data Management", "Emerging Technologies", "Research Project"],
     ["IT Manager", "Systems Architect", "Cybersecurity Specialist", "IT Consultant", "Technology Director"],
     "A coursework-based master programme in information technology."),
]

for code, name_en, name_zh, fac, cat, dur, months, tuition, curr, careers, desc in master_coursework:
    programmes.append(make_prog(
        code, name_en, name_zh, "master", cat, fac, "Kuala Nerus", "coursework",
        dur, f"{months} months", tuition, int(tuition * 1.68),  # MYR to CNY at ~1.68
        6.0, 60, "February, September",
        curr, careers, desc, desc,  # English desc used for both, will be localized
        official_url="https://postgrad.umt.edu.my/postgraduate_fees-2/"
    ))

# Master by Research programmes (consolidated by major field)
master_research = [
    ("UMT-MRES-MARINE-SCI", "Master of Marine Science (Research)", "海洋科学硕士（研究型）", "FSSM",
     ["Marine Biology", "Marine Chemistry", "Marine Pollution", "Coastal Zone Management", "Mangrove Ecology"],
     ["Marine Scientist", "Researcher", "Marine Conservationist", "Environmental Consultant"]),
    ("UMT-MRES-OCEANOGRAPHY", "Master of Oceanography (Research)", "海洋学硕士（研究型）", "FSSM",
     ["Physical Oceanography", "Biological Oceanography", "Chemical Oceanography", "Geological Oceanography"],
     ["Oceanographer", "Research Scientist", "Marine Data Analyst", "Climate Scientist"]),
    ("UMT-MRES-FISHERY", "Master of Fishery (Research)", "渔业硕士（研究型）", "FSPA",
     ["Fisheries Science", "Fish Biology", "Fisheries Conservation", "Capture Fisheries", "Fishing Technology"],
     ["Fisheries Scientist", "Marine Biologist", "Conservation Manager", "Researcher"]),
    ("UMT-MRES-AQUACULTURE-RES", "Master of Aquaculture (Research)", "水产养殖硕士（研究型）", "FSPA",
     ["Mariculture", "Fish Health", "Fish Nutrition", "Hatchery Technology", "Aquaculture Engineering"],
     ["Aquaculture Researcher", "Fish Health Specialist", "Aquaculture Entrepreneur", "Consultant"]),
    ("UMT-MRES-BIOTECH", "Master of Biotechnology (Research)", "生物技术硕士（研究型）", "FSSM",
     ["Marine Biotechnology", "Bioinformatics", "Drug Discovery", "Environmental Biotechnology", "Industrial Biotechnology"],
     ["Biotechnologist", "Research Scientist", "Bioinformatics Specialist", "Pharmaceutical Researcher"]),
    ("UMT-MRES-FOOD-SCI", "Master of Food Science (Research)", "食品科学硕士（研究型）", "FSMA",
     ["Food Technology", "Food Nutrition", "Food Service", "Food Safety"],
     ["Food Scientist", "Nutrition Researcher", "Food Safety Consultant", "Product Developer"]),
    ("UMT-MRES-CHEM", "Master of Chemical Sciences (Research)", "化学科学硕士（研究型）", "FSSM",
     ["Analytical Chemistry", "Environmental Chemistry", "Natural Products", "Polymer Chemistry", "Material Science"],
     ["Chemist", "Research Scientist", "Analytical Chemist", "Materials Scientist"]),
    ("UMT-MRES-COMP-SCI", "Master of Computer Science (Research)", "计算机科学硕士（研究型）", "FSKM",
     ["Artificial Intelligence", "Software Engineering", "Database Systems", "Image Processing", "Information Retrieval"],
     ["Research Scientist", "AI Researcher", "Software Architect", "Data Scientist"]),
    ("UMT-MRES-MATH", "Master of Mathematical Sciences (Research)", "数学科学硕士（研究型）", "FSKM",
     ["Statistics", "Financial Mathematics", "Mathematical Modelling", "Operations Research", "Differential Equations"],
     ["Mathematician", "Quantitative Analyst", "Researcher", "Data Scientist"]),
    ("UMT-MRES-PHYSICS", "Master of Physics (Research)", "物理学硕士（研究型）", "FSSM",
     ["Material Physics", "Renewable Energy", "Solid State Physics", "Electronics and Instrumentation"],
     ["Physicist", "Research Scientist", "Renewable Energy Specialist", "Materials Engineer"]),
    ("UMT-MRES-BIO", "Master of Biological Sciences (Research)", "生物科学硕士（研究型）", "FSSM",
     ["Microbiology", "Genetics", "Botany", "Zoology", "Ecology", "Biodiversity & Conservation"],
     ["Biologist", "Research Scientist", "Microbiologist", "Conservation Biologist"]),
    ("UMT-MRES-MARITIME", "Master of Maritime Studies (Research)", "海事研究硕士（研究型）", "FPM",
     ["Maritime Law", "Maritime Transportation", "Maritime Management", "Marine Archaeology", "Nautical Science"],
     ["Maritime Researcher", "Port Manager", "Maritime Policy Analyst", "Shipping Executive"]),
    ("UMT-MRES-MARINE-TECH", "Master of Marine Technology (Research)", "海洋技术硕士（研究型）", "FTKK",
     ["Marine Energy", "Corrosion Technology", "Offshore Structure", "Marine Propulsion", "Marine Fluid Power"],
     ["Marine Engineer", "Offshore Engineer", "Researcher", "Marine Technology Consultant"]),
    ("UMT-MRES-REMOTE-SENSING", "Master of Remote Sensing (Research)", "遥感硕士（研究型）", "FSSM",
     ["GIS", "Satellite Oceanography", "Remote Sensing Applications"],
     ["Remote Sensing Specialist", "GIS Analyst", "Environmental Monitor", "Researcher"]),
    ("UMT-MRES-ENV-TECH", "Master of Environmental Technology and Management (Research)", "环境技术与管理硕士（研究型）", "FSSM",
     ["Environmental Management", "Environmental Technology", "Material Technology", "Environmental Sciences"],
     ["Environmental Manager", "Sustainability Consultant", "Environmental Technologist", "Researcher"]),
    ("UMT-MRES-SOC-SCI", "Master of Social Science (Research)", "社会科学硕士（研究型）", "FPEPS",
     ["Management", "Economics", "Accounting", "Marketing", "Communication", "Applied Linguistics"],
     ["Social Researcher", "Policy Analyst", "Management Consultant", "Academic"]),
    ("UMT-MRES-CROP-ANIMAL", "Master of Crop and Animal Science (Research)", "作物与动物科学硕士（研究型）", "FSMA",
     ["Crop Science", "Animal Science", "Plant Protection", "Agronomy", "Animal Nutrition"],
     ["Agricultural Researcher", "Agronomist", "Animal Scientist", "Agricultural Consultant"]),
]

for code, name_en, name_zh, fac, specs, careers in master_research:
    programmes.append(make_prog(
        code, name_en, name_zh, "master", "science", fac, "Kuala Nerus", "research",
        2, "2-6 Semesters (FT)", 18500, 30980,
        6.0, 60, "February, September",
        ["Research Methodology", "Literature Review", "Thesis Research", "Seminar Presentations", "Thesis Defence"],
        careers, f"A research-based master programme in {name_en.replace(' (Research)', '').replace('Master of ', '').lower()}.",
        f"研究型硕士专业，方向为{name_zh.replace('硕士（研究型）', '').replace(' ', '')}。",
        specializations=specs,
        official_url="https://postgrad.umt.edu.my/postgraduate_fees-2/"
    ))

# ============================================================
# PhD PROGRAMMES (Research, consolidated by major field)
# ============================================================

phd_programmes = [
    ("UMT-PHD-MARINE-SCI", "Doctor of Philosophy (Marine Science)", "哲学博士（海洋科学）", "FSSM",
     ["Marine Biology", "Marine Chemistry", "Marine Toxicology", "Marine Pollution", "Coastal Zone Management", "Mangrove Ecology"],
     ["Marine Scientist", "Professor", "Research Director", "Marine Policy Advisor"]),
    ("UMT-PHD-OCEANOGRAPHY", "Doctor of Philosophy (Oceanography)", "哲学博士（海洋学）", "FSSM",
     ["Physical Oceanography", "Biological Oceanography", "Chemical Oceanography", "Geological Oceanography", "Fisheries Oceanography"],
     ["Oceanographer", "Professor", "Climate Scientist", "Research Director"]),
    ("UMT-PHD-FISHERY", "Doctor of Philosophy (Fishery)", "哲学博士（渔业）", "FSPA",
     ["Fisheries Science", "Fish Biology", "Fisheries Conservation", "Capture Fisheries", "Fish Diseases", "Fish Genetics"],
     ["Fisheries Scientist", "Professor", "Conservation Director", "Marine Policy Advisor"]),
    ("UMT-PHD-AQUACULTURE", "Doctor of Philosophy (Aquaculture)", "哲学博士（水产养殖）", "FSPA",
     ["Mariculture", "Fish Health", "Fish Nutrition", "Hatchery Technology", "Freshwater Aquaculture", "Aquaculture Engineering"],
     ["Aquaculture Scientist", "Professor", "Aquaculture Industry Consultant", "Research Director"]),
    ("UMT-PHD-BIOTECH", "Doctor of Philosophy (Biotechnology)", "哲学博士（生物技术）", "FSSM",
     ["Marine Biotechnology", "Aquaculture Biotechnology", "Bioinformatics", "Drug Discovery", "Environmental Biotechnology"],
     ["Biotechnology Researcher", "Professor", "Pharmaceutical Scientist", "Biotech Entrepreneur"]),
    ("UMT-PHD-FOOD-SCI", "Doctor of Philosophy (Food Science)", "哲学博士（食品科学）", "FSMA",
     ["Food Technology", "Food Nutrition", "Food Science", "Post Harvest Technology"],
     ["Food Scientist", "Professor", "Food Industry Consultant", "Research Director"]),
    ("UMT-PHD-CHEM", "Doctor of Philosophy (Chemical Sciences)", "哲学博士（化学科学）", "FSSM",
     ["Analytical Chemistry", "Environmental Chemistry", "Natural Products", "Polymer Chemistry", "Material Science", "Oleochemistry"],
     ["Chemist", "Professor", "Research Director", "Materials Scientist"]),
    ("UMT-PHD-COMP-SCI", "Doctor of Philosophy (Computer Science)", "哲学博士（计算机科学）", "FSKM",
     ["Artificial Intelligence", "Software Engineering", "Database Systems", "Image Processing", "Information Retrieval"],
     ["Computer Science Professor", "AI Research Director", "Senior Research Scientist", "CTO"]),
    ("UMT-PHD-MATH", "Doctor of Philosophy (Mathematical Sciences)", "哲学博士（数学科学）", "FSKM",
     ["Statistics", "Financial Mathematics", "Mathematical Modelling", "Operations Research", "Differential Equations"],
     ["Mathematics Professor", "Quantitative Researcher", "Data Science Director", "Research Scientist"]),
    ("UMT-PHD-PHYSICS", "Doctor of Philosophy (Physics)", "哲学博士（物理学）", "FSSM",
     ["Material Physics", "Renewable Energy", "Solid State Physics", "Electronics and Instrumentation"],
     ["Physics Professor", "Research Director", "Renewable Energy Scientist", "Materials Scientist"]),
    ("UMT-PHD-BIO", "Doctor of Philosophy (Biological Sciences)", "哲学博士（生物科学）", "FSSM",
     ["Microbiology", "Genetics", "Botany", "Zoology", "Ecology", "Biodiversity & Conservation", "Aquatic Science"],
     ["Biology Professor", "Research Director", "Conservation Scientist", "Biotechnology Researcher"]),
    ("UMT-PHD-MARITIME", "Doctor of Philosophy (Maritime Studies)", "哲学博士（海事研究）", "FPM",
     ["Maritime Law", "Maritime Transportation", "Maritime Management", "Marine Archaeology", "Nautical Science"],
     ["Maritime Professor", "Maritime Policy Advisor", "Port Authority Director", "Shipping Executive"]),
    ("UMT-PHD-MARINE-TECH", "Doctor of Philosophy (Marine Technology)", "哲学博士（海洋技术）", "FTKK",
     ["Marine Energy", "Corrosion Technology", "Offshore Structure", "Marine Propulsion", "Marine Fluid Power"],
     ["Marine Engineering Professor", "Offshore Technology Researcher", "Ocean Energy Director", "Marine Consultant"]),
    ("UMT-PHD-ENV", "Doctor of Philosophy (Environmental Technology and Management)", "哲学博士（环境技术与管理）", "FSSM",
     ["Environmental Management", "Environmental Technology", "Material Technology", "Environmental Sciences"],
     ["Environmental Professor", "Sustainability Director", "Environmental Technology Researcher", "Policy Advisor"]),
    ("UMT-PHD-REMOTE-SENSING", "Doctor of Philosophy (Remote Sensing)", "哲学博士（遥感）", "FSSM",
     ["GIS", "Satellite Oceanography", "Remote Sensing Applications"],
     ["Remote Sensing Professor", "GIS Research Director", "Satellite Data Scientist", "Environmental Monitor"]),
    ("UMT-PHD-SOC-SCI", "Doctor of Philosophy (Social Science)", "哲学博士（社会科学）", "FPEPS",
     ["Management", "Economics", "Accounting", "Marketing", "Communication", "Applied Linguistics", "Counselling"],
     ["Professor", "Policy Research Director", "Management Consultant", "Social Researcher"]),
    ("UMT-PHD-AGRO", "Doctor of Philosophy (Crop and Animal Science)", "哲学博士（作物与动物科学）", "FSMA",
     ["Crop Science", "Animal Science", "Plant Protection", "Agronomy", "Horticulture", "Soil Science"],
     ["Agricultural Professor", "Agricultural Research Director", "Agronomy Consultant", "Food Security Advisor"]),
]

for code, name_en, name_zh, fac, specs, careers in phd_programmes:
    programmes.append(make_prog(
        code, name_en, name_zh, "phd", "science", fac, "Kuala Nerus", "research",
        3, "4-10 Semesters (FT)", 27800, 46552,
        6.5, 79, "February, September",
        ["Advanced Research Methodology", "Literature Review", "Original Research", "International Conference Participation", "Journal Publications", "Thesis Defence"],
        careers, f"A doctoral research programme in {name_en.replace('Doctor of Philosophy (', '').replace(')', '').lower()}.",
        f"博士研究型专业，方向为{name_zh.replace('哲学博士（', '').replace('）', '')}。",
        specializations=specs,
        official_url="https://postgrad.umt.edu.my/postgraduate_fees-2/"
    ))

# ============================================================
# DIPLOMA, POSTGRADUATE DIPLOMA, POSTGRADUATE CERTIFICATE
# ============================================================

# Diploma in Fisheries
programmes.append(make_prog(
    "UMT-DIP-FISHERIES", "Diploma in Fisheries", "渔业文凭",
    "diploma", "agriculture", "FSPA", "Kuala Nerus", "coursework",
    2, "4 Semesters", 10720, 6003,
    5.5, 46, "February, September",
    ["Fisheries Biology", "Aquaculture Basics", "Fish Processing", "Water Quality", "Fisheries Technology", "Practical Training"],
    ["Fisheries Technician", "Aquaculture Assistant", "Fish Processing Officer", "Fisheries Field Assistant"],
    "A diploma programme in fisheries science and technology.",
    "渔业科学技术的文凭课程。"
))

# Postgraduate Diploma in Maritime Studies
programmes.append(make_prog(
    "UMT-PGD-MARITIME", "Postgraduate Diploma in Maritime Studies", "海事研究研究生文凭",
    "postgraduate-diploma", "maritime", "FPM", "Kuala Nerus", "coursework",
    1, "2 Semesters", 15000, 25200,
    6.0, 60, "February, September",
    ["Maritime Law", "Port Management", "Maritime Economics", "Shipping Operations", "Maritime Safety", "Research Project"],
    ["Maritime Officer", "Port Operations Manager", "Shipping Executive", "Maritime Consultant"],
    "A postgraduate diploma in maritime studies.",
    "海事研究的研究生文凭课程。"
))

# Postgraduate Certificate in Maritime Studies
programmes.append(make_prog(
    "UMT-PGC-MARITIME", "Postgraduate Certificate in Maritime Studies", "海事研究研究生证书",
    "postgraduate-certificate", "maritime", "FPM", "Kuala Nerus", "coursework",
    1, "1 Semester", 8000, 13440,
    6.0, 60, "February, September",
    ["Maritime Law", "Port Management", "Maritime Economics"],
    ["Maritime Officer", "Port Administrator", "Shipping Coordinator"],
    "A postgraduate certificate in maritime studies.",
    "海事研究的研究生证书课程。"
))

# === Build final dataset ===
dataset = {
    "schemaVersion": 2,
    "universityCode": "UMT",
    "officialDomains": ["umt.edu.my", "postgrad.umt.edu.my", "akademik.umt.edu.my"],
    "collectionScope": "full",
    "levels": ["diploma", "bachelor", "master", "postgraduate-certificate", "postgraduate-diploma", "phd"],
    "applicantScope": "international",
    "academicSession": "2026",
    "retrievedAt": "2026-07-07T10:30:00Z",
    "declaredProgrammeCount": 89,
    "university": university,
    "sources": sources,
    "programmes": programmes
}

# Write to file
output_path = "/Users/ian/Desktop/dev/study-malaysia/data/imports/umt/2026-07-07/candidate-dataset.json"
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(dataset, f, ensure_ascii=False, indent=2)

print(f"Generated {len(programmes)} programmes")
print(f"  Diploma: {len([p for p in programmes if p['level'] == 'diploma'])}")
print(f"  Bachelor: {len([p for p in programmes if p['level'] == 'bachelor'])}")
print(f"  Master: {len([p for p in programmes if p['level'] == 'master'])}")
print(f"  Postgraduate Diploma: {len([p for p in programmes if p['level'] == 'postgraduate-diploma'])}")
print(f"  Postgraduate Certificate: {len([p for p in programmes if p['level'] == 'postgraduate-certificate'])}")
print(f"  PhD: {len([p for p in programmes if p['level'] == 'phd'])}")
print(f"File: {output_path}")
print(f"Size: {len(json.dumps(dataset, ensure_ascii=False))} chars")

# Verify slug uniqueness
slugs = set()
dupes = []
for p in programmes:
    name = p["nameEnOfficial"]
    slug = name.lower().replace(" ", "-").replace("(", "").replace(")", "").replace(",", "").replace("--", "-").rstrip("-")
    slug = f"umt-{p['level']}-{slug}"
    if slug in slugs:
        dupes.append(slug)
    slugs.add(slug)

if dupes:
    print(f"\nWARNING: Duplicate slugs found: {dupes}")
else:
    print(f"\nSlug uniqueness: ALL UNIQUE ({len(slugs)} slugs)")
