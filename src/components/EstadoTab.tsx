"use client";
import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface Est { electores: number; afiliados: number; electoresAfiliados: number; electoresNoAfiliados: number; afiliadosSinPadron: number;
  ultimaCarga: { fecha: string; archivo: string; filas: number } | null; hayAfiliados: boolean }

export default function EstadoTab() {
  const [e, setE] = useState<Est | null>(null); const [err, setErr] = useState("");
  useEffect(() => {
    fetch("/api/estadisticas").then(async r => { const d = await r.json(); r.ok ? setE(d) : setErr(d.error ?? "Error"); }).catch(() => setErr("Sin conexión"));
  }, []);
  if (err) return <p className="text-red-700 text-sm">{err}</p>;
  if (!e) return <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-[#75AADB]" size={32} /></div>;
  const n = (x: number) => x.toLocaleString("es-AR");
  const Tarjeta = ({ t, v, c = "text-slate-800" }: { t: string; v: string; c?: string }) => (
    <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t}</p><p className={`text-2xl font-extrabold ${c}`}>{v}</p></div>
  );
  return (
    <section className="flex flex-col gap-4">
      {!e.hayAfiliados && <p className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-orange-700 text-sm">Todavía no se cargó el padrón de afiliados. Use <code>scripts/cargar_afiliados.py</code> (ver README).</p>}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Tarjeta t="Electores en el padrón" v={n(e.electores)} />
        <Tarjeta t="Afiliados cargados (PJ)" v={n(e.afiliados)} c="text-emerald-700" />
        <Tarjeta t="Electores afiliados" v={n(e.electoresAfiliados)} c="text-emerald-700" />
        <Tarjeta t="Electores no afiliados" v={n(e.electoresNoAfiliados)} />
        <Tarjeta t="Afiliados que no figuran en el padrón" v={n(e.afiliadosSinPadron)} c="text-orange-700" />
        <Tarjeta t="Última carga" v={e.ultimaCarga ? e.ultimaCarga.fecha : "—"} />
      </div>
      {e.ultimaCarga && <p className="text-xs text-slate-400">Archivo: {e.ultimaCarga.archivo} · {n(e.ultimaCarga.filas)} filas</p>}
    </section>
  );
}
