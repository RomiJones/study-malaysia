"use client";

import { useEffect, useState } from "react";
import { ADMIN_TOKEN_KEY, apiFetch, emptyLocale } from "../../../lib/api";

export default function ContentPage() {
  const [items, setItems] = useState<any[]>([]);
  const [keyName, setKeyName] = useState("home.hero");
  const [title, setTitle] = useState<any>(emptyLocale());
  const [body, setBody] = useState<any>(emptyLocale());

  async function load() {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY) || undefined;
    const data = await apiFetch<any[]>("/admin/content", token);
    setItems(data);
  }

  useEffect(() => { load().catch(() => undefined); }, []);

  async function submit() {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY) || undefined;
    await apiFetch(`/admin/content/${keyName}`, token, {
      method: "POST",
      body: JSON.stringify({ title, body })
    });
    setTitle(emptyLocale());
    setBody(emptyLocale());
    await load();
  }

  return (
    <div className="stack">
      <div className="row"><h1>站点内容</h1><span className="badge">可维护首页 Hero 与说明区块</span></div>
      <div className="panel stack">
        <input className="input" value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="content key" />
        <div className="locale-grid">
          {Object.keys(title).map((locale) => (
            <div className="stack" key={locale}>
              <strong>{locale}</strong>
              <input className="input" placeholder="title" value={title[locale]} onChange={(e) => setTitle({ ...title, [locale]: e.target.value })} />
              <textarea className="input" placeholder="body" value={body[locale]} onChange={(e) => setBody({ ...body, [locale]: e.target.value })} />
            </div>
          ))}
        </div>
        <button className="primary" onClick={submit}>保存内容块</button>
      </div>
      <div className="panel">
        <table className="table">
          <thead><tr><th>Key</th><th>标题（简中）</th><th>正文（简中）</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}><td>{item.key}</td><td>{item.title["zh-CN"]}</td><td>{item.body["zh-CN"]}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
