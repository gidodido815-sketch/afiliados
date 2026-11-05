"use client";
import React, { useEffect, useState } from "react";
import { Cabecera, Pie } from "@/components/ui";
import ConsultaTab from "@/components/ConsultaTab";
import ListasTab from "@/components/ListasTab";
import EstadoTab from "@/components/EstadoTab";

type Tab = "consulta" | "listas" | "estado";

export default function Home() {
  const [me, setMe] = useState<{ usuario: string; rol: string } | null>(null);
  const [tab, setTab] = useState<Tab>("consulta");

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.ok ? r.json() : Promise.reject()).then(setMe).catch(() => { window.location.href = "/login"; });
  }, []);

  async function salir() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }
  if (!me) return null;
  const listas = me.rol === "admin" || me.rol === "operador";
  const admin = me.rol === "admin";
  const tabs: [Tab, string, boolean][] = [["consulta", "Consulta", true], ["listas", "Listas y descargas", listas], ["estado", "Estado de datos", admin]];

  return (
    <div className="min-h-screen flex flex-col bg-[#EEF2F7]">
      <Cabecera usuario={me.usuario} rol={me.rol} onSalir={salir} />
      <main className="max-w-6xl mx-auto w-full px-4 py-6 flex-grow flex flex-col gap-6">
        {tabs.filter(t => t[2]).length > 1 && (
          <nav className="flex gap-2 border-b border-slate-300">
            {tabs.filter(t => t[2]).map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`px-4 py-2 text-sm font-bold -mb-px border-b-4 transition ${tab === k ? "border-[#C8102E] text-slate-800" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{label}</button>
            ))}
          </nav>
        )}
        {tab === "consulta" && <ConsultaTab />}
        {tab === "listas" && listas && <ListasTab puedeDescargar />}
        {tab === "estado" && admin && <EstadoTab />}
      </main>
      <Pie />
    </div>
  );
}
