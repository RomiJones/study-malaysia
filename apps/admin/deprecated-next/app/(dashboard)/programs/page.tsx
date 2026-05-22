"use client";

import { useEffect, useState } from "react";
import { ADMIN_TOKEN_KEY, apiFetch, emptyLocale } from "../../../lib/api";

const initialForm = {
  universityId: 1,
  slug: "",
  code: "",
  level: "master",
  category: "it",
  durationYears: 1.5,
  annualTuitionCny: 50000,
  intakeMonths: ["January", "May", "September"],
  languageRequirement: { ielts: 5.5, toefl: 46, pte: 51, muet: 4 },
  requirement: { gpa: 2.8, gaokaoRequired: false, huikaoRequired: false, note: emptyLocale() },
  name: emptyLocale(),
  faculty: emptyLocale(),
  description: emptyLocale(),
  applicationDocs: { en: [], ms: [], "zh-CN": [], "zh-TW": [] },
  curriculum: { en: [], ms: [], "zh-CN": [], "zh-TW": [] },
  careers: { en: [], ms: [], "zh-CN": [], "zh-TW": [] },
  specializations: { en: [], ms: [], "zh-CN": [], "zh-TW": [] }
};

export default function ProgramsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [universities, setUniversities] = useState<any[]>([]);
  const [form, setForm] = useState<any>(initialForm);

  async function load() {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY) || undefined;
    const [programs, universityList] = await Promise.all([
      apiFetch<any[]>("/admin/programs", token),
      apiFetch<any[]>("/admin/universities", token)
    ]);
    setItems(programs);
    setUniversities(universityList);
  }

  useEffect(() => { load().catch(() => undefined); }, []);

  function updateLocale(field: string, locale: string, value: string) {
    setForm((current: any) => ({ ...current, [field]: { ...current[field], [locale]: value } }));
  }

  async function submit() {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY) || undefined;
    await apiFetch("/admin/programs", token, { method: "POST", body: JSON.stringify(form) });
    setForm(initialForm);
    await load();
  }

  return (
    <div className="stack">
      <div className="row"><h1>专业管理</h1><span className="badge">支持多语言专业录入</span></div>
      <div className="panel stack">
        <div className="grid two">
          <select className="input" value={form.universityId} onChange={(e) => setForm({ ...form, universityId: Number(e.target.value) })}>
            {universities.map((item) => <option value={item.id} key={item.id}>{item.name["zh-CN"]}</option>)}
          </select>
          <input className="input" placeholder="slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          <input className="input" placeholder="code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <input className="input" placeholder="annualTuitionCny" type="number" value={form.annualTuitionCny} onChange={(e) => setForm({ ...form, annualTuitionCny: Number(e.target.value) })} />
        </div>
        <div className="locale-grid">
          {Object.keys(form.name).map((locale) => (
            <div className="stack" key={locale}>
              <strong>{locale}</strong>
              <input className="input" placeholder="name" value={form.name[locale]} onChange={(e) => updateLocale("name", locale, e.target.value)} />
              <input className="input" placeholder="faculty" value={form.faculty[locale]} onChange={(e) => updateLocale("faculty", locale, e.target.value)} />
              <textarea className="input" placeholder="description" value={form.description[locale]} onChange={(e) => updateLocale("description", locale, e.target.value)} />
            </div>
          ))}
        </div>
        <button className="primary" onClick={submit}>创建专业</button>
      </div>
      <div className="panel">
        <table className="table">
          <thead><tr><th>ID</th><th>专业</th><th>层级</th><th>方向</th><th>学校ID</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}><td>{item.id}</td><td>{item.name["zh-CN"]}</td><td>{item.level}</td><td>{item.category}</td><td>{item.universityId}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
