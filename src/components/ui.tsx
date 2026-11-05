import React from "react";

export function Dato({ label, valor }: { label: string; valor?: string | number | null }) {
  const v = String(valor ?? "").trim();
  if (!v) return null;
  return (
    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-slate-800 break-words">{v}</p>
    </div>
  );
}

export function BadgeAfil({ afiliado, chico = false }: { afiliado: boolean; chico?: boolean }) {
  return (
    <span className={`inline-flex items-center rounded-full font-bold whitespace-nowrap ${chico ? "text-[10px] px-2 py-0.5" : "text-xs px-3 py-1"} ${
      afiliado ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
      {afiliado ? "AFILIADO PJ" : "NO AFILIADO"}
    </span>
  );
}

export function Cabecera({ usuario, rol, onSalir }: { usuario?: string; rol?: string; onSalir?: () => void }) {
  return (
    <header>
      <div className="h-3 bg-[#C8102E]" />
      <div className="bg-gradient-to-b from-[#4a86c8] to-[#75AADB] shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-white shadow-md flex items-center justify-center text-2xl border-2 border-[#FFC72C]">☀️</div>
          <div className="flex-1">
            <h1 className="text-white font-extrabold text-2xl sm:text-3xl tracking-tight leading-none drop-shadow">PADRÓN ELECTORAL</h1>
            <p className="text-blue-100 text-xs mt-1 font-medium">Provincia de Santiago del Estero · Afiliación al Partido Justicialista</p>
          </div>
          {usuario && (
            <div className="text-right text-white text-xs">
              <p className="font-bold">{usuario} <span className="opacity-70">({rol})</span></p>
              <button onClick={onSalir} className="underline opacity-90 hover:opacity-100">Cerrar sesión</button>
            </div>
          )}
        </div>
      </div>
      <div className="h-1.5 bg-[#FFC72C]" />
    </header>
  );
}

export function Pie() {
  return (
    <footer className="bg-white border-t border-slate-200 mt-auto">
      <div className="h-1 bg-[#75AADB]" />
      <div className="max-w-6xl mx-auto px-4 py-4 text-center">
        <p className="text-sm font-bold text-slate-700">programador Nieva Guido</p>
        <p className="text-xs text-slate-400 mt-0.5">Sistema de Consulta Electoral · Santiago del Estero</p>
      </div>
      <div className="h-2 bg-[#C8102E]" />
    </footer>
  );
}
