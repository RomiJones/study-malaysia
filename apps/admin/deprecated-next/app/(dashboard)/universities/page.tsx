"use client";

import { useEffect, useState } from "react";
import { ADMIN_TOKEN_KEY, apiFetch, emptyLocale } from "../../../lib/api";

const initialForm = {
  slug: "",
  code: "",
  shortName: "",
  logoUrl: "",
  imageUrl: "",
  color: "#6C47FF",
  qsRank: 500,
  qsAsiaRank: 100,
  ownership: "private",
  institutionType: "comprehensive",
  foundedYear: 2000,
  students: 0,
  intlStudents: 0,
  csrCertified: true,
  website: "",
  admissionEmail: "",
  tuitionMinCny: 30000,
  tuitionMaxCny: 80000,
  livingCostCny: 30000,
  minIelts: 5,
  acceptNoLanguage: true,
  name: emptyLocale(),
  location: emptyLocale(),
  region: emptyLocale(),
  description: emptyLocale(),
  facilities: { en: [], ms: [], "zh-CN": [], "zh-TW": [] },
  highlights: { en: [], ms: [], "zh-CN": [], "zh-TW": [] }
};

export default function UniversitiesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState<any>(initialForm);

  async function load() {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY) || undefined;
    const data = await apiFetch<any[]>("/admin/universities", token);
    setItems(data);
  }

  useEffect(() => { load().catch(() => undefined); }, []);

  async function submit() {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY) || undefined;
    await apiFetch("/admin/universities", token, { method: "POST", body: JSON.stringify(form) });
    setForm(initialForm);
    await load();
  }

  function updateLocale(field: string, locale: string, value: string) {
    setForm((current: any) => ({ ...current, [field]: { ...current[field], [locale]: value } }));
  }

  return (
    <div className="stack">
      <div className="row"><h1>学校管理</h1><span className="badge">支持四语录入</span></div>
      <div className="panel stack">
        <div className="grid two">
          <input className="input" placeholder="slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          <input className="input" placeholder="code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <input className="input" placeholder="shortName" value={form.shortName} onChange={(e) => setForm({ ...form, shortName: e.target.value })} />
          <input className="input" placeholder="website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
          <input className="input" placeholder="logoUrl" value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} />
          <input className="input" placeholder="imageUrl" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
        </div>
        <div className="locale-grid">
          {Object.keys(form.name).map((locale) => (
            <div className="stack" key={locale}>
              <strong>{locale}</strong>
              <input className="input" placeholder="name" value={form.name[locale]} onChange={(e) => updateLocale("name", locale, e.target.value)} />
              <input className="input" placeholder="location" value={form.location[locale]} onChange={(e) => updateLocale("location", locale, e.target.value)} />
              <input className="input" placeholder="region" value={form.region[locale]} onChange={(e) => updateLocale("region", locale, e.target.value)} />
              <textarea className="input" placeholder="description" value={form.description[locale]} onChange={(e) => updateLocale("description", locale, e.target.value)} />
            </div>
          ))}
        </div>
        <div className="grid two">
          <input className="input" type="number" placeholder="qsRank" value={form.qsRank} onChange={(e) => setForm({ ...form, qsRank: Number(e.target.value) })} />
          <input className="input" type="number" placeholder="qsAsiaRank" value={form.qsAsiaRank} onChange={(e) => setForm({ ...form, qsAsiaRank: Number(e.target.value) })} />
          <input className="input" type="number" placeholder="foundedYear" value={form.foundedYear} onChange={(e) => setForm({ ...form, foundedYear: Number(e.target.value) })} />
          <input className="input" type="number" placeholder="livingCostCny" value={form.livingCostCny} onChange={(e) => setForm({ ...form, livingCostCny: Number(e.target.value) })} />
        </div>
        <button className="primary" onClick={submit}>创建学校</button>
      </div>
      <div className="panel">
        <table className="table">
          <thead><tr><th>ID</th><th>学校</th><th>QS</th><th>城市</th><th>学校代码</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}><td>{item.id}</td><td>{item.name["zh-CN"]}</td><td>{item.qsRank}</td><td>{item.location["zh-CN"]}</td><td>{item.code}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
