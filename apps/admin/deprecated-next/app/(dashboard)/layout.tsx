"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { ADMIN_TOKEN_KEY } from "../../lib/api";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (!token) router.push("/login");
  }, [router]);

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <h2>StudyMY Admin</h2>
        <Link href="/">Dashboard</Link>
        <Link href="/universities">学校管理</Link>
        <Link href="/programs">专业管理</Link>
        <Link href="/content">站点内容</Link>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
