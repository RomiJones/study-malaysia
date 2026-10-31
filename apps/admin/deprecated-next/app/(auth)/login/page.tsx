"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ADMIN_TOKEN_KEY, ADMIN_USER_KEY, apiFetch } from "../../../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [account, setAccount] = useState("admin@studymy.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const response = await apiFetch<{ accessToken: string; user: { role: string } }>("/auth/login", undefined, {
        method: "POST",
        body: JSON.stringify({ method: "email", account, password })
      });
      if (response.user.role !== "admin") {
        throw new Error("当前账号不是 admin 用户。");
      }
      localStorage.setItem(ADMIN_TOKEN_KEY, response.accessToken);
      localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(response.user));
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    }
  }

  return (
    <div className="login-shell">
      <form className="login-card stack" onSubmit={handleSubmit}>
        <div>
          <h1>StudyMY Admin</h1>
          <p className="small">请使用已配置的管理员账号登录。</p>
        </div>
        <label className="stack">
          <span>账号</span>
          <input className="input" value={account} onChange={(event) => setAccount(event.target.value)} />
        </label>
        <label className="stack">
          <span>密码</span>
          <input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <button className="primary" type="submit">登录管理端</button>
        {error ? <div className="small" style={{ color: "#b91c1c" }}>{error}</div> : null}
      </form>
    </div>
  );
}
