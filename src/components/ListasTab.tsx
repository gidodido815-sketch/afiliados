"use client";
import React, { useCallback, useEffect, useState } from "react";
import { Download, Loader2, Search, AlertCircle } from "lucide-react";
import type { Elector } from "@/lib/campos";
import { etiqueta } from "@/lib/campos";
import { BadgeAfil } from "./ui";

type Tipo = "afiliados" | "no_afiliados";
interface Filtros { departamentos: string[]; secciones: string[]; circuitos: string[]; tieneMesa: boolean }
const TAM = 50;

export default function ListasTab({ puedeDescargar }: { puedeDescargar: boolean }) {
  const [tipo, setTipo] = useState<Tipo>("afiliados");
  const [q, setQ] = useState(""); const [departamento, setDep] = useState(""); const [seccion, setSec] = useState("");
  const [circuito, setCir] = useState(""); const [mesa, setMesa] = useState("");
  const [pagina, setPagina] = useState(1);
  const [filas, setFilas] = useState<Elector[]>([]); const [total, setTotal] = useState<number | null>(null);
  const [cargando, setCargando] = useState(false); const [error, setError] = useState("");
  const [filtros, setFiltros] = useState<Filtros | null>(null);

  const params = useCallback((extra: Record<string, string> = {}) => {
    const p = new URLSearchParams({ tipo, ...extra });
    if (q.trim()) p.set("q", q.trim());
    if (departamento) p.set("departamento", departamento);
    if (seccion) p.set("seccion", seccion);
    if (circuito) p.set("circuito", circuito);
    if (mesa.trim()) p.set("mesa", mesa.trim());
    return p;
  }, [tipo, q, departamento, seccion, circuito, mesa]);

  useEffect(() => {
    const p = new URLSearchParams(); if (departamento) p.set("departamento", departamento); if (seccion) p.set("seccion", seccion);
    fetch(`/api/listas/filtros?${p}`).then(r => r.ok ? r.json() : null).then(d => d && setFiltros(d)).catch(() => {});
  }, [departamento, seccion]);

  const cargar = useCallback(async (pag: number) => {
    setCargando(true); setError("");
    try {
      const r = await fetch(`/api/listas?${params({ pagina: String(pag), tam: String(TAM) })}`);
      if (r.status === 401) { window.location.href = "/login"; return; }
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Error al cargar la lista."); setFilas([]); setTotal(null); return; }
      setFilas(d.filas); setTotal(d.total); setPagina(pag);
    } catch { setError("No se pudo conectar con el servidor."); }
    finally { setCargando(false); }
  }, [params]);

  // Cargar al cambiar de lista
  useEffect(() => { cargar(1); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tipo]);

  const paginas = total ? Math.max(1, Math.ceil(total / TAM)) : 1;
  const sel = "px-3 py-2 border-2 border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-[#75AADB] w-full";

  return (
    <>
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex gap-2 flex-wrap">
          {(["afiliados", "no_afiliados"] as Tipo[]).map(t => (
            <button key={t} onClick={() => { setTipo(t); setPagina(1); }}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition ${tipo === t ? (t === "afiliados" ? "bg-emerald-600 text-white" : "bg-slate-700 text-white") : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"}`}>
              {t === "afiliados" ? "Afiliados al PJ" : "No afiliados"}
            </button>
          ))}
        </div>
        <form className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end"
          onSubmit={e => { e.preventDefault(); cargar(1); }}>
          <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 flex flex-col gap-1 lg:col-span-2">Nombre o DNI
            <input value={q} onChange={e => setQ(e.target.value)} maxLength={100} placeholder="Apellido y nombre, o DNI" className={sel} /></label>
          <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 flex flex-col gap-1">Departamento
            <select value={departamento} onChange={e => { setDep(e.target.value); setCir(""); }} className={sel}>
              <option value="">Todos</option>{filtros?.departamentos.map(v => <option key={v}>{v}</option>)}</select></label>
          <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 flex flex-col gap-1">Sección
            <select value={seccion} onChange={e => { setSec(e.target.value); setCir(""); }} className={sel}>
              <option value="">Todas</option>{filtros?.secciones.map(v => <option key={v}>{v}</option>)}</select></label>
          <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 flex flex-col gap-1">Circuito
            <select value={circuito} onChange={e => setCir(e.target.value)} className={sel}>
              <option value="">Todos</option>{filtros?.circuitos.map(v => <option key={v}>{v}</option>)}</select></label>
          {filtros?.tieneMesa !== false && (
            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 flex flex-col gap-1">Mesa
              <input value={mesa} onChange={e => setMesa(e.target.value)} maxLength={20} placeholder="Ej: 0422" className={sel} /></label>
          )}
          <button className="py-2.5 rounded-lg bg-[#C8102E] hover:bg-[#a00d23] text-white text-sm font-bold flex items-center justify-center gap-2 lg:col-span-1">
            <Search size={15} /> Filtrar</button>
        </form>
      </section>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex gap-2"><AlertCircle size={16} className="mt-0.5" /><span>{error}</span></div>}

      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3.5 flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-bold text-slate-800 text-sm">
            {tipo === "afiliados" ? "Electores afiliados al PJ" : "Electores NO afiliados al PJ"}
            {total !== null && <span className="ml-2 text-xs font-bold px-2.5 py-1 rounded-full bg-[#75AADB]/15 text-[#4a86c8]">{total.toLocaleString("es-AR")} registros</span>}
          </h3>
          {puedeDescargar && (
            <a href={`/api/listas/descargar?${params()}`}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center gap-2">
              <Download size={15} /> Descargar CSV (Excel)</a>
          )}
        </div>
        {cargando ? <div className="py-16 flex justify-center"><Loader2 size={32} className="animate-spin text-[#75AADB]" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500">
                <tr><th className="text-left px-4 py-2">N° orden</th><th className="text-left px-4 py-2">DNI</th><th className="text-left px-4 py-2">Apellido y nombre</th>
                  <th className="text-left px-4 py-2">Domicilio</th><th className="text-left px-4 py-2">Circuito</th><th className="text-left px-4 py-2">Mesa</th>
                  <th className="text-left px-4 py-2">PJ</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filas.map((f, i) => {
                  const v = (n: string) => f.extra.find(x => etiqueta(x.clave).toLowerCase() === n)?.valor ?? "";
                  return (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-mono text-xs">{f.orden}</td>
                      <td className="px-4 py-2 font-mono text-xs">{f.dni}</td>
                      <td className="px-4 py-2 font-semibold text-slate-800">{f.nombre}</td>
                      <td className="px-4 py-2 text-slate-600">{f.domicilio}</td>
                      <td className="px-4 py-2 text-slate-600">{v("circuito")}</td>
                      <td className="px-4 py-2 text-slate-600">{v("mesa")}</td>
                      <td className="px-4 py-2"><BadgeAfil afiliado={f.afiliado} chico /></td>
                    </tr>
                  );
                })}
                {!filas.length && !error && <tr><td colSpan={7} className="py-12 text-center text-slate-400">Sin resultados.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-sm">
          <button disabled={pagina <= 1 || cargando} onClick={() => cargar(pagina - 1)} className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-30">← Anterior</button>
          <span className="text-slate-500">Página {pagina.toLocaleString("es-AR")} de {paginas.toLocaleString("es-AR")}</span>
          <button disabled={pagina >= paginas || cargando} onClick={() => cargar(pagina + 1)} className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-30">Siguiente →</button>
        </div>
      </section>
    </>
  );
}
