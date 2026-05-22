"use client";

import { useEffect, useState } from "react";
import { ADMIN_TOKEN_KEY, apiFetch } from "../../lib/api";

export default function DashboardPage() {
  const [stats, setStats] = useState<{ users: number; universities: number; programs: number; contentBlocks: number } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY) || undefined;
    apiFetch<{ users: number; universities: number; programs: number; contentBlocks: number }>("/admin/dashboard", token)
      .then(setStats)
      .catch(() => undefined);
  }, []);

  return (
    <div className="stack">
      <div className="row"><h1>后台总览</h1><span className="badge">MySQL 主存储 + Redis 可选缓存</span></div>
      <div className="grid two">
        <div className="panel"><strong>{stats?.users ?? 0}</strong><div className="small">用户数</div></div>
        <div className="panel"><strong>{stats?.universities ?? 0}</strong><div className="small">学校数</div></div>
        <div className="panel"><strong>{stats?.programs ?? 0}</strong><div className="small">专业数</div></div>
        <div className="panel"><strong>{stats?.contentBlocks ?? 0}</strong><div className="small">内容块</div></div>
      </div>
    </div>
  );
}
