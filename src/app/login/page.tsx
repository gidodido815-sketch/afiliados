"use client";
import React, { useState } from "react";
import { Cabecera, Pie } from "@/components/ui";

export default function Login() {
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true); setError("");
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, clave }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { window.location.href = "/"; return; }
      setError(d.error ?? "No se pudo iniciar sesión.");
    } catch { setError("No se pudo conectar con el servidor."); }
    setCargando(false);
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#EEF2F7]">
      <Cabecera />
      <main className="flex-grow flex items-start justify-center px-4 py-10">
        <form onSubmit={entrar} className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-4">
          <h2 className="font-bold text-slate-800 text-lg">Acceso restringido</h2>
          <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-widest text-slate-500">
            Usuario
            <input value={usuario} onChange={e => setUsuario(e.target.value)} autoComplete="username" required maxLength={64}
              className="px-3 py-2.5 border-2 border-slate-200 rounded-lg text-slate-800 text-sm normal-case tracking-normal font-normal focus:outline-none focus:border-[#75AADB]" />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-widest text-slate-500">
            Clave
            <input type="password" value={clave} onChange={e => setClave(e.target.value)} autoComplete="current-password" required maxLength={256}
              className="px-3 py-2.5 border-2 border-slate-200 rounded-lg text-slate-800 text-sm normal-case tracking-normal font-normal focus:outline-none focus:border-[#75AADB]" />
          </label>
          {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}
          <button disabled={cargando} className="py-2.5 rounded-lg bg-[#C8102E] hover:bg-[#a00d23] text-white text-sm font-bold disabled:opacity-40">
            {cargando ? "Ingresando…" : "Ingresar"}
          </button>
          <p className="text-[11px] text-slate-400">Los datos del padrón son personales. Cada consulta y descarga queda registrada con su usuario.</p>
        </form>
      </main>
      <Pie />
    </div>
  );
}
