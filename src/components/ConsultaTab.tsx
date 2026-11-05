"use client";
import React, { useState, useCallback, useRef } from "react";
import { Search, User, MapPin, FileText, Loader2, X, ChevronRight, Hash, BookOpen, Home, AlertCircle } from "lucide-react";
import type { Elector } from "@/lib/campos";
import { etiqueta, ordenarExtra } from "@/lib/campos";
import { Dato, BadgeAfil } from "./ui";

function Campo({ label, icon, value, placeholder, onChange, onEnter, tipo = "text" }: {
  label: string; icon: React.ReactNode; value: string; placeholder: string;
  onChange: (v: string) => void; onEnter: () => void; tipo?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">{icon}{label}</label>
      <div className="relative">
        <input type={tipo} value={value} maxLength={100} onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === "Enter" && onEnter()} placeholder={placeholder}
          className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-lg text-slate-800 text-sm placeholder:text-slate-300 focus:outline-none focus:border-[#75AADB] transition-colors bg-white" />
        {value && (
          <button onClick={() => onChange("")} aria-label="Borrar" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"><X size={14} /></button>
        )}
      </div>
    </div>
  );
}

export function Ficha({ e }: { e: Elector }) {
  const extra = ordenarExtra(e.extra);
  const grupo1 = extra.filter(x => ["seccion", "circuito", "mesa", "seccion_electoral", "circuito_electoral", "numero_mesa"].includes(x.clave.toLowerCase()));
  const resto = extra.filter(x => !grupo1.includes(x));
  return (
    <div className="p-5 flex flex-col gap-3 overflow-y-auto">
      {e.nombre && (
        <div className="bg-gradient-to-r from-[#EEF5FB] to-white rounded-xl p-4 border border-[#75AADB]/20">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#75AADB] mb-1">Apellido y Nombre</p>
          <p className="text-lg font-extrabold text-slate-800 leading-tight">{e.nombre}</p>
        </div>
      )}
      <div className={`rounded-xl p-3 border flex items-center justify-between gap-3 ${e.afiliado ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Partido Justicialista</p>
          <p className={`text-base font-extrabold ${e.afiliado ? "text-emerald-800" : "text-slate-700"}`}>
            {e.afiliado ? "Está afiliado" : "No está afiliado"}
          </p>
          {e.afiliado && e.fechaAfiliacion && <p className="text-xs text-emerald-700">Fecha de afiliación: {e.fechaAfiliacion}</p>}
        </div>
        <BadgeAfil afiliado={e.afiliado} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Dato label="Matrícula / DNI" valor={e.dni} />
        <Dato label="N° de Orden" valor={e.orden} />
      </div>
      <Dato label="Domicilio" valor={e.domicilio} />
      {grupo1.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {grupo1.map(x => <Dato key={x.clave} label={etiqueta(x.clave)} valor={x.valor} />)}
        </div>
      )}
      {resto.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {resto.map(x => <Dato key={x.clave} label={etiqueta(x.clave)} valor={x.valor} />)}
        </div>
      )}
    </div>
  );
}

export default function ConsultaTab() {
  const [dni, setDni] = useState(""); const [nombre, setNombre] = useState(""); const [direccion, setDireccion] = useState("");
  const [resultados, setResultados] = useState<Elector[]>([]);
  const [sel, setSel] = useState<Elector | null>(null);
  const [buscado, setBuscado] = useState(false); const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState(""); const [limitado, setLimitado] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const buscar = useCallback(async () => {
    if (!dni.trim() && !nombre.trim() && !direccion.trim()) return;
    abortRef.current?.abort(); abortRef.current = new AbortController();
    setBuscando(true); setError(""); setLimitado(false); setSel(null); setBuscado(true);
    try {
      const p = new URLSearchParams();
      if (dni.trim()) p.set("dni", dni.replace(/\D/g, ""));
      if (nombre.trim()) p.set("nombre", nombre);
      if (direccion.trim()) p.set("direccion", direccion);
      const res = await fetch(`/api/buscar?${p}`, { signal: abortRef.current.signal });
      if (res.status === 401) { window.location.href = "/login"; return; }
      const d = await res.json();
      if (res.status === 429) { setLimitado(true); setResultados([]); return; }
      if (!res.ok) { setError(d.error ?? "Error en la búsqueda."); setResultados([]); return; }
      setResultados(d.resultados ?? []);
      if ((d.resultados ?? []).length === 1) setSel(d.resultados[0]);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError("No se pudo conectar con el servidor."); setResultados([]);
    } finally { setBuscando(false); }
  }, [dni, nombre, direccion]);

  const limpiar = () => { setDni(""); setNombre(""); setDireccion(""); setResultados([]); setSel(null); setBuscado(false); setError(""); setLimitado(false); };

  return (
    <>
      {limitado && <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-orange-700 text-sm flex gap-2"><AlertCircle size={16} className="mt-0.5" /><span><strong>Demasiadas búsquedas.</strong> Espere un minuto.</span></div>}
      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex gap-2"><AlertCircle size={16} className="mt-0.5" /><span><strong>Error:</strong> {error}</span></div>}

      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center gap-2">
          <Search size={18} className="text-[#75AADB]" />
          <h2 className="font-bold text-slate-800 text-base">Consultar elector y afiliación</h2>
          <span className="text-xs text-slate-400 ml-1 hidden sm:inline">· ingrese uno o varios criterios · Enter para buscar</span>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Campo label="DNI / Matrícula" icon={<Hash size={11} />} value={dni} placeholder="Ej: 32315275" onChange={setDni} onEnter={buscar} tipo="number" />
          <Campo label="Apellido y Nombre" icon={<User size={11} />} value={nombre} placeholder="Ej: NIEVA GUIDO" onChange={setNombre} onEnter={buscar} />
          <Campo label="Dirección (Calle o Barrio)" icon={<Home size={11} />} value={direccion} placeholder="Ej: 8 DE ABRIL" onChange={setDireccion} onEnter={buscar} />
          <div className="flex flex-col gap-2 justify-end">
            <button onClick={buscar} disabled={(!dni && !nombre && !direccion) || buscando}
              className="w-full py-2.5 rounded-lg bg-[#C8102E] hover:bg-[#a00d23] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-30 disabled:cursor-not-allowed">
              {buscando ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Buscar
            </button>
            <button onClick={limpiar} className="py-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 text-xs font-bold transition">Limpiar</button>
          </div>
        </div>
      </section>

      {buscado ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-7 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-slate-50 border-b border-slate-200 px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2"><BookOpen size={16} className="text-[#75AADB]" /><h3 className="font-bold text-slate-800 text-sm">Resultados</h3></div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#75AADB]/15 text-[#4a86c8]">
                {buscando ? "Buscando…" : `${resultados.length}${resultados.length === 150 ? " (máx.)" : ""} encontrados`}
              </span>
            </div>
            {buscando ? (
              <div className="flex-1 flex items-center justify-center py-16"><Loader2 size={32} className="animate-spin text-[#75AADB]" /></div>
            ) : resultados.length > 0 ? (
              <ul className="divide-y divide-slate-100 overflow-y-auto max-h-[500px]">
                {resultados.map((it, i) => (
                  <li key={i}>
                    <button onClick={() => setSel(it)} className={`w-full text-left px-5 py-3.5 flex items-center gap-3 transition group ${sel === it ? "bg-[#EEF5FB] border-l-4 border-[#C8102E]" : "hover:bg-slate-50 border-l-4 border-transparent"}`}>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 text-sm truncate">{it.nombre || "Sin nombre"}</p>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          <span className="text-xs text-slate-500 font-mono whitespace-nowrap">DNI {it.dni || "S/D"}</span>
                          {it.orden && <span className="text-xs text-slate-500 whitespace-nowrap">N° {it.orden}</span>}
                          {it.domicilio && <span className="text-xs text-slate-400 truncate flex items-center gap-1"><MapPin size={10} />{it.domicilio}</span>}
                        </div>
                      </div>
                      <BadgeAfil afiliado={it.afiliado} chico />
                      <ChevronRight size={14} className={`flex-shrink-0 ${sel === it ? "text-[#C8102E]" : "text-slate-200 group-hover:text-slate-400"}`} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-16 text-slate-400">
                <FileText size={40} className="mb-3 opacity-30" /><p className="text-sm font-medium">No se encontraron electores con esos criterios.</p>
              </div>
            )}
          </section>
          <section className="lg:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-slate-50 border-b border-slate-200 px-5 py-3.5 flex items-center gap-2"><User size={16} className="text-[#C8102E]" /><h3 className="font-bold text-slate-800 text-sm">Datos del Elector</h3></div>
            {sel ? <Ficha e={sel} /> : (
              <div className="flex-1 flex flex-col items-center justify-center py-16 text-slate-400"><User size={48} className="mb-3 opacity-20 text-[#75AADB]" /><p className="text-sm font-medium">Seleccione un elector de la lista</p></div>
            )}
          </section>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-dashed border-[#75AADB]/40 p-10 text-center">
          <Search size={40} className="mx-auto mb-3 text-[#75AADB]/30" />
          <p className="text-slate-500 font-semibold">Ingrese un DNI, nombre o dirección para consultar si está afiliado al PJ</p>
        </div>
      )}
    </>
  );
}
