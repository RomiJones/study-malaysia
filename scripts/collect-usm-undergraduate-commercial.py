#!/usr/bin/env python3
"""Build the audited USM undergraduate source manifest from the official prospectus."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

import pdfplumber
from pypdf import PdfReader


PROSPECTUS_URL = (
    "https://admission.usm.my/images/00uginternational/download_2025/"
    "PROSPECTUS_FOR_FIRST_DEGREE_2025-2026.pdf"
)
SUMMARY_URL = (
    "https://admission.usm.my/images/00uginternational/download_2025/"
    "SUMMARY_OF_PROGRAMME.pdf"
)
FEE_URL = (
    "https://admission.usm.my/images/00uginternational/fee_2025/"
    "UNDERGRADUATE_INTERNATIONAL_TUITION_FEES_PER_SEMESTER.pdf"
)
CSV_URL = "https://admission.usm.my/images/data/antarbangsa.csv"

SEMESTER_TWO_CODES = {
    "US6442001",
    "US6442002",
    "US6545002",
    "US6461004",
    "0101",
    "0102",
    "US6222002",
    "US6345001",
    "0020",
}
OFFSHORE_CODES = {"0006", "0101", "0102", "0020"}
MALAY_MEDIUM_CODES = {"US6220001", "US6222001", "US6310001"}

FEE_GROUPS = {
    "US6721001": (13750, 137500, 132.5, 1325, 69),
    "0006": (10000, 100000, 40, 165, 69),
    "US6724001": (11250, 112500, 132.5, 1325, 69),
    "US6545005": (2125, 17000, 95, 1325, 69),
    "US6725001": (2125, 17000, 95, 1325, 69),
    "US6725002": (2125, 17000, 95, 1325, 69),
    "US6726002": (2125, 17000, 95, 1325, 69),
    "US6862001": (2125, 17000, 95, 1325, 69),
    "US6813001": (2125, 14875, 95, 1325, 69),
    "US6481002": (1875, 15000, 112.5, 1325, 69),
    "US6481003": (1875, 15000, 112.5, 1325, 69),
    "US6481004": (1875, 15000, 112.5, 1325, 69),
    "0101": (2500, 20000, 112.5, 1325, 69),
    "0102": (2500, 20000, 112.5, 1325, 69),
    "US6442001": (1718.75, 13750, 112.5, 1325, 69),
    "US6442002": (1718.75, 13750, 112.5, 1325, 69),
    "US6545002": (1718.75, 13750, 112.5, 1325, 69),
    "US6441001": (1718.75, 13750, 112.5, 1325, 70),
    "US6443001": (1718.75, 13750, 112.5, 1325, 70),
    "US6545003": (1718.75, 13750, 112.5, 1325, 70),
    "US6421001": (1718.75, 13750, 112.5, 1325, 70),
    "US6421002": (1718.75, 13750, 112.5, 1325, 70),
    "US6461004": (1718.75, 13750, 112.5, 1325, 70),
    "US6462001": (1718.75, 13750, 112.5, 1325, 70),
    "US6541001": (1875, 15000, 112.5, 1325, 70),
    "US6524006": (1875, 15000, 112.5, 1325, 70),
    "US6543001": (1875, 13125, 112.5, 1325, 70),
    "US6524005": (1875, 13125, 112.5, 1325, 70),
    "US6581002": (2250, 18000, 112.5, 1325, 70),
    "US6582004": (2250, 18000, 112.5, 1325, 70),
    "US6214003": (2250, 18000, 112.5, 1325, 70),
    "US6582003": (2250, 18000, 112.5, 1325, 70),
    "US6581001": (3125, 18750, 112.5, 1325, 70),
    "US6582001": (1928.5, 13500, 112.5, 1325, 70),
    "US6526001": (3125, 18750, 112.5, 1325, 70),
    "US6345001": (2285.71, 16000, 112.5, 1325, 71),
    "0020": (2520, 17640, 112.5, 1325, 71),
    "US6344001": (2250, 18000, 112.5, 1325, 71),
    "US6222002": (2125, 12750, 112.5, 1325, 71),
    "US6145004": (1718.75, 13750, 112.5, 1350, 71),
    "US6212001": (1562.5, 10937.5, 112.5, 1325, 71),
    "US6211001": (1562.5, 12500, 112.5, 1325, 71),
    "US6212002": (1562.5, 12500, 112.5, 1325, 71),
    "US6213001": (1562.5, 12500, 112.5, 1325, 71),
    "US6214001": (1562.5, 12500, 112.5, 1325, 71),
    "US6214002": (1562.5, 12500, 112.5, 1325, 71),
    "US6224001": (1562.5, 10937.5, 112.5, 1325, 71),
    "US6222001": (1562.5, 10937.5, 112.5, 1325, 71),
    "US6220001": (1562.5, 10937.5, 112.5, 1325, 71),
    "US6321001": (2500, 15000, 112.5, 1325, 72),
    "US6310001": (1562.5, 12500, 112.5, 1325, 72),
    "US6314001": (1875, 15000, 112.5, 1325, 72),
    "US6522001": (2250, 18000, 95, 1325, 72),
    "US6523001": (2250, 18000, 95, 1325, 72),
    "US6523002": (2250, 18000, 95, 1325, 72),
    "US6525001": (2750, 22000, 95, 1325, 72),
    "US6524001": (2812.5, 22500, 95, 1325, 72),
    "US6526002": (2250, 18000, 95, 1325, 72),
    "US6521001": (2250, 18000, 95, 1325, 72),
    "US6540001": (2250, 18000, 95, 1325, 72),
    "US6524002": (2250, 18000, 95, 1325, 72),
    "US6527001": (2250, 18000, 95, 1325, 72),
    "US6524003": (2250, 18000, 95, 1325, 72),
}

CAREER_GROUPS = {
    "US6721001": ["Medical Doctor"],
    "0006": ["Medical Doctor"],
    "US6724001": ["Dentist", "Lecturer"],
    "US6725001": ["Science Officer", "Research Officer", "Quality Control Officer", "Technical Advisor"],
    "US6725002": ["Science Officer", "Research Officer", "Radiation Safety Officer", "Technical Advisor"],
    "US6726002": ["Nutrition Officer", "Research Officer", "Nutrition Advisor", "Quality Control Officer"],
    "US6862001": ["Environmental and Occupational Health Officer", "Research Officer", "Quality Control Officer"],
    "US6545005": ["Enforcement Officer", "Science Officer", "Research Officer", "Technical Advisor"],
    "US6813001": ["Sports Officer", "Fitness Consultant", "Sports Coach", "Sports Physiotherapist"],
    "US6481002": ["Software Engineer", "Software Architect", "Software Test Engineer", "IT Project Manager"],
    "US6481003": ["Systems Engineer", "Information Security Analyst", "Network Engineer", "Systems Administrator"],
    "US6481004": ["Data Scientist", "Data Engineer", "Knowledge Engineer", "Intelligent Systems Engineer"],
    "0101": ["Software Engineer", "Software Architect", "Software Test Engineer", "IT Project Manager"],
    "0102": ["Data Scientist", "Data Engineer", "Knowledge Engineer", "Intelligent Systems Engineer"],
    "US6442001": ["Chemist", "Process Engineer", "R&D Officer", "Quality Assurance Officer"],
    "US6442002": ["Chemist", "Process Engineer", "R&D Officer", "Quality Control Officer"],
    "US6545002": ["Chemist", "Process Engineer", "R&D Officer", "Quality Assurance Officer"],
    "US6421001": ["Biotechnologist", "Bioinformatician", "Research Officer", "Environmental Consultant"],
    "US6421002": ["Biotechnologist", "Wildlife Officer", "Forestry Officer", "Research Officer"],
    "US6441001": ["Researcher", "Engineer", "Programmer", "Science Educator"],
    "US6443001": ["Geophysicist", "Meteorologist", "Geoscientist", "Application Engineer"],
    "US6545003": ["Medical Physicist", "Research Officer", "QA Engineer", "Application Specialist"],
    "US6461004": ["Data Analyst", "Financial Analyst", "Research Officer", "Lecturer"],
    "US6462001": ["Statistician", "Data Analyst", "Quality Control Engineer", "Financial Analyst"],
    "US6541001": ["Food Technologist", "HALAL Officer", "Quality Assurance Manager", "Researcher"],
    "US6524006": ["Bioprocess Technologist", "Researcher", "Food Manufacturing Specialist", "Lecturer"],
    "US6524005": ["Environmental Officer", "Environmental Consultant", "Auditor", "Researcher"],
    "US6543001": ["Process Engineer", "Product Engineer", "Quality Assurance Engineer", "R&D Executive"],
    "US6581001": ["Architect", "Assistant Architect", "Designer"],
    "US6581002": ["Urban and Regional Planner", "Planning Consultant", "Government Planning Officer"],
    "US6582001": ["Building Surveyor", "Property Manager", "Facility Manager", "Building Control Inspector"],
    "US6582004": ["Construction Project Manager", "Project Manager", "Construction Manager"],
    "US6582003": ["Building Engineer", "Maintenance Engineer", "Environmental Engineer", "Geotechnical Engineer"],
    "US6526001": ["Quantity Surveyor", "Construction Cost Consultant", "Arbitrator"],
    "US6214003": ["Interior Designer"],
    "US6145004": ["English Teacher", "Language Officer", "English Tutor", "Language Lecturer"],
    "US6345001": ["Business Analyst", "Data Analyst"],
    "0020": ["Business Analyst", "Data Analyst"],
    "US6344001": ["Accountant", "Internal Auditor", "External Auditor", "Tax Consultant"],
    "US6222002": ["Language Consultant", "Writer", "Editor", "Public Relations Executive"],
    "US6212001": ["Musician", "Music Conductor", "Sound Engineer", "Music Producer"],
    "US6212002": ["Actor", "Director", "Producer", "Stage Manager"],
    "US6214001": ["Graphic Designer", "Creative Director", "Communication Designer", "Illustrator"],
    "US6214002": ["Product Designer", "Industrial Designer", "Furniture Designer", "Design Consultant"],
    "US6220001": ["Teacher", "Lecturer", "Writer", "Administrative Officer"],
    "US6222001": ["Translator", "Interpreter", "Editor", "Writer"],
    "US6224001": ["Lecturer", "Editor", "Research Officer", "Creative Writer"],
    "US6321001": ["Journalist", "Public Relations Officer", "Film Producer", "Digital Content Creator"],
    "US6310001": ["Researcher", "Government Officer", "NGO Advocate", "Human Resources Executive"],
    "US6314001": ["Economist", "Researcher", "Government Officer", "Marketing Executive"],
    "US6522001": ["Electrical Engineer", "R&D Engineer", "Product Engineer", "Consulting Engineer"],
    "US6523001": ["Mechatronics Engineer", "Robotics Technologist", "Systems Engineer", "R&D Engineer"],
    "US6523002": ["Electronic Engineer", "Product Engineer", "Quality Engineer", "Consulting Engineer"],
    "US6525001": ["Aerospace Engineer", "Aircraft Engineer", "Manufacturing Engineer", "Systems Engineer"],
    "US6526002": ["Civil Engineer", "Consultant", "Contractor", "Project Manager"],
    "US6521001": ["Mechanical Engineer", "Automotive Engineer", "Process Engineer", "Product Design Engineer"],
    "US6540001": ["Manufacturing Engineer", "Industrial Engineer", "Process Engineer", "Project Engineer"],
    "US6524002": ["Mineral Processing Engineer", "Quarry Engineer", "Drilling Engineer", "Safety Engineer"],
    "US6527001": ["Materials Engineer", "Manufacturing Engineer", "Corrosion Engineer", "QA Engineer"],
    "US6524003": ["Polymer Engineer", "Polymer Chemist", "Process Engineer", "Product Specialist"],
    "US6524001": ["Chemical Engineer", "Researcher", "Consultant", "Lecturer"],
}

SPECIALIZATIONS = {
    "US6421001": ["Agrobiology", "Biotechnology", "Environmental Biology", "Entomology and Parasitology"],
    "US6421002": ["Animal Biology", "Plant Biology", "Microbiology"],
    "US6345001": [
        "Finance",
        "International Business",
        "Marketing",
        "Operations Management",
        "Strategy and Organisational Management",
        "Islamic Finance",
        "Business Analytics",
    ],
    "0020": [
        "Finance",
        "International Business",
        "Marketing",
        "Operations Management",
        "Strategy and Organisational Management",
        "Islamic Finance",
        "Business Analytics",
    ],
    "US6321001": ["Digital Communication", "Journalism", "Strategic Communication", "Creative Screen"],
    "US6310001": ["Anthropology and Sociology", "Development Planning and Management", "Economics", "Political Science"],
}


def clean(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def extract_summary(pdf: pdfplumber.PDF) -> list[dict]:
    records: list[dict] = []
    school = ""
    for page_number in (11, 12):
        table = pdf.pages[page_number - 1].extract_tables()[0]
        for row in table:
            cells = [clean(cell) for cell in row]
            code = next((cell for cell in cells if re.fullmatch(r"(?:US\d{7}|\d{4})", cell)), None)
            if not code:
                continue
            code_index = cells.index(code)
            candidate_school = next((cell for cell in cells[code_index + 1 :] if cell.startswith("School of")), "")
            if candidate_school:
                school = candidate_school
            name = next(
                (cell for cell in cells[code_index + 1 :] if "Bachelor" in cell or "Doctor" in cell or "Programme" in cell),
                "",
            )
            records.append(
                {
                    "ordinal": len(records) + 1,
                    "code": code,
                    "nameEnOfficial": clean(name.replace("#", "").replace("*", "")),
                    "schoolEn": school,
                    "summaryPage": page_number,
                    "interviewRequired": "#" in name,
                    "offshore": code in OFFSHORE_CODES,
                    "mediumInstruction": "Malay" if code in MALAY_MEDIUM_CODES else "English or programme-specific",
                    "intakeMonths": ["October", "March"] if code in SEMESTER_TWO_CODES else ["October"],
                }
            )
    return records


def table_payload(row: list[str | None]) -> tuple[str, str, str, str]:
    cells = [clean(cell) for cell in row]
    first = cells[0] if cells else ""
    general = cells[1] if len(cells) > 1 else ""
    high_school = cells[2] if len(cells) > 2 else ""
    alternatives = next((cell for cell in cells[3:] if len(cell) > 100), "")
    return first, general, high_school, alternatives


def extract_requirements(pdf: pdfplumber.PDF) -> dict[str, dict]:
    result: dict[str, dict] = {}
    for page_number in range(13, 54):
        for table in pdf.pages[page_number - 1].extract_tables():
            if len(table) < 2:
                continue
            for row in table:
                first, general, high_school, alternatives = table_payload(row)
                codes = re.findall(r"(?:US\d{7}|(?<!\d)\d{4}(?!\d))", first)
                if "US654001" in first:
                    codes.append("US6540001")
                if not codes:
                    continue
                cells = [clean(cell) for cell in row]
                general = next((cell for cell in cells if "ACADEMIC" in cell and "IELTS" in cell), general)
                non_general = [cell for cell in cells if cell and cell != general and cell != first]
                high_school = next(
                    (
                        cell
                        for cell in non_general
                        if ("High School Certificate" in cell or "STPM" in cell)
                        and "Diploma in related" not in cell
                    ),
                    high_school,
                )
                alternatives = max(
                    (
                        cell
                        for cell in non_general
                        if cell != high_school and ("Diploma" in cell or "A’ LEVEL" in cell or "A' LEVEL" in cell)
                    ),
                    key=len,
                    default=alternatives,
                )
                duration_matches = re.findall(
                    r"(\d+)\s*Semester\s*/\s*(\d+(?:\s*[½1/]\d*)?)\s*Years?",
                    first,
                    re.IGNORECASE,
                )
                for index, code in enumerate(codes):
                    result[code] = {
                        "requirementsPage": page_number,
                        "durationMatch": duration_matches[index] if index < len(duration_matches) else None,
                        "generalRequirementEn": general,
                        "highSchoolRequirementEn": high_school,
                        "alternativeQualificationRequirementEn": alternatives,
                    }
    return result


def extract_malay_names(brochure: Path | None) -> dict[str, str]:
    if not brochure:
        return {}
    text = "\n".join(page.extract_text() or "" for page in PdfReader(str(brochure)).pages)
    names = {
        code: clean(name.replace("#", ""))
        for code, name in re.findall(
            r"(?m)^\s*\d+\s+(US\d{7})\s+(.+?)\s+(?:-|\d+)\s+(?:3½|3\.5|3|4|5)\s+[N/A]",
            text,
            re.DOTALL,
        )
        if clean(name).startswith(("Sarjana Muda", "Doktor"))
        and not re.search(r"\bUS\d{7}\b", name)
    }
    names.update(
        {
            "US6540001": "Sarjana Muda Kejuruteraan Pembuatan dengan Pengurusan dengan Kepujian",
            "US6524002": "Sarjana Muda Kejuruteraan Sumber Mineral dengan Kepujian",
            "US6421001": "Sarjana Muda Sains Gunaan dalam Agrobiologi / Bioteknologi / Biologi Persekitaran / Entomologi dan Parasitologi dengan Kepujian",
            "US6421002": "Sarjana Muda Sains dalam Biodiversiti Haiwan dan Tumbuhan / Mikrobiologi dengan Kepujian",
            "0006": "Program Perubatan Antarabangsa (IMP) USM-KLE",
            "0101": "Sarjana Muda Kejuruteraan Perisian dengan Kepujian (USM-UOWKDUPG)",
            "0102": "Sarjana Muda Sains Komputer (Perkomputeran Cerdas) dengan Kepujian (USM-UOWKDUPG)",
            "0020": "Sarjana Muda Pengurusan dengan Kepujian (USM International, RECSAM)",
        }
    )
    return names


def parse_years(value: str) -> float:
    value = clean(value)
    if "½" in value or "1/2" in value:
        return float(re.search(r"\d+", value).group()) + 0.5
    return float(value)


def campus_for(school: str, code: str) -> str:
    if code == "0006":
        return "USM-KLE, Belgaum, India"
    if code in {"0101", "0102"}:
        return "UOWM KDU, Batu Kawan, Penang"
    if code == "0020":
        return "USM International, RECSAM Penang"
    if school in {"School of Medical Sciences", "School of Dental Sciences", "School of Health Sciences"}:
        return "Health Campus, Kubang Kerian, Kelantan"
    if "Engineering" in school and school != "School of Housing, Building and Planning":
        return "Engineering Campus, Nibong Tebal, Penang"
    return "Main Campus, Penang Island"


def infer_category(name: str, school: str) -> str:
    text = f"{name} {school}".lower()
    if any(term in text for term in ("management", "accounting", "economics")):
        return "business"
    if any(term in text for term in ("computer", "software")):
        return "it"
    if "engineering" in text or any(term in text for term in ("architecture", "surveying", "construction", "planning")):
        return "engineering"
    if any(term in text for term in ("medicine", "medical", "health", "dental", "nutrition", "forensic")):
        return "medicine"
    if any(term in text for term in ("arts", "music", "language", "linguistics", "communication", "education", "social sciences")):
        return "arts"
    return "science"


def extract_ielts(general: str) -> float:
    match = re.search(r"IELTS(?:/IELTS Online)? minimum Band\s*(\d+(?:\.\d+)?)", general, re.IGNORECASE)
    return float(match.group(1)) if match else 5.0


def build_manifest(prospectus: Path, malay_brochure: Path | None = None) -> dict:
    with pdfplumber.open(str(prospectus)) as pdf:
        summary = extract_summary(pdf)
        requirements = extract_requirements(pdf)
    malay_names = extract_malay_names(malay_brochure)

    requirements["US6310001"] = requirements.get(
        "US6310001",
        {
            "requirementsPage": 44,
            "durationMatch": ("8", "4"),
            "generalRequirementEn": "",
            "highSchoolRequirementEn": "",
            "alternativeQualificationRequirementEn": "",
        },
    )
    manual_duration = {
        "US6721001": ("10", "5"),
        "0006": ("10", "5"),
        "US6526001": ("7", "3.5"),
    }

    programmes = []
    for record in summary:
        code = record["code"]
        requirement = requirements.get(code)
        if not requirement:
            raise ValueError(f"Missing requirement source for {code}")
        duration = manual_duration.get(code) or requirement["durationMatch"]
        if not duration:
            raise ValueError(f"Missing duration for {code}")
        semesters = int(duration[0])
        years = parse_years(duration[1])
        fee = FEE_GROUPS.get(code)
        if not fee:
            raise ValueError(f"Missing fee source for {code}")
        per_semester, total, recurrent, registration, fee_page = fee
        mathematical_total = round(per_semester * semesters, 2)
        fee_note = None
        if mathematical_total != round(total, 2):
            fee_note = (
                f"Official prospectus publishes USD {per_semester:,.2f} per semester and "
                f"USD {total:,.2f} total; the displayed official total is retained without recalculation."
            )
        programme = {
            **record,
            "nameMs": malay_names.get(code, record["nameEnOfficial"]),
            "category": infer_category(record["nameEnOfficial"], record["schoolEn"]),
            "campus": campus_for(record["schoolEn"], code),
            "studyMode": "Full-time",
            "durationSemesters": semesters,
            "durationYears": years,
            "durationOfficial": f"{semesters} semesters / {years:g} years",
            "tuitionPerSemesterUSD": per_semester,
            "totalTuitionUSD": total,
            "recurrentFeePerSemesterUSD": recurrent,
            "registrationFeeUSD": registration,
            "feePage": fee_page,
            "feeNote": fee_note,
            "requirementsPage": requirement["requirementsPage"],
            "generalRequirementEn": requirement["generalRequirementEn"],
            "highSchoolRequirementEn": requirement["highSchoolRequirementEn"],
            "alternativeQualificationRequirementEn": requirement["alternativeQualificationRequirementEn"],
            "ieltsMinimum": extract_ielts(requirement["generalRequirementEn"]),
            "careersEn": CAREER_GROUPS.get(code, []),
            "specializationsEn": SPECIALIZATIONS.get(code, []),
            "officialSourceUrl": PROSPECTUS_URL,
        }
        if not programme["careersEn"]:
            programme["careersEn"] = ["Official prospectus does not list a separate career section for this programme."]
        programmes.append(programme)

    codes = [item["code"] for item in programmes]
    if len(programmes) != 63 or len(set(codes)) != 63:
        raise ValueError(f"Expected 63 unique programmes, got rows={len(programmes)}, unique={len(set(codes))}")
    return {
        "universityCode": "USM",
        "academicSession": "2025/2026",
        "verifiedAt": "2026-06-13",
        "programmeCount": len(programmes),
        "sources": [
            {
                "title": "USM Prospectus for First Degree Academic Session 2025/2026",
                "url": PROSPECTUS_URL,
                "sha256": sha256(prospectus),
                "pages": 73,
                "role": "canonical",
            },
            {"title": "USM Summary of Programme 2025/2026", "url": SUMMARY_URL, "role": "cross-check"},
            {"title": "USM Undergraduate International Tuition Fees", "url": FEE_URL, "role": "cross-check"},
            {"title": "USM International Undergraduate CSV", "url": CSV_URL, "role": "change-detection"},
            *(
                [
                    {
                        "title": "USM First Degree Brochure Academic Session 2026/2027",
                        "url": "https://pohon.usm.my/dokumendoc/2026_2027/Brochure_Saluran%20Perdana%20_Final.pdf",
                        "sha256": sha256(malay_brochure),
                        "pages": 2,
                        "role": "official-Malay-name-cross-check",
                    }
                ]
                if malay_brochure
                else []
            ),
        ],
        "programmes": programmes,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--prospectus", required=True, type=Path)
    parser.add_argument("--malay-brochure", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    manifest = build_manifest(args.prospectus, args.malay_brochure)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(args.output), "programmeCount": manifest["programmeCount"]}, indent=2))


if __name__ == "__main__":
    main()
