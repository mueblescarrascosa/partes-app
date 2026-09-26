// Genera el PDF del informe final para el tramitador
import { ESTADOS, fFecha, fFechaHora, fEuros, blobADataURL, medirImagen, importeLinea, totalesLineas } from "./util.js";

export async function generarInforme(parte, api, miembros = [], opc = {}) {
  const conPrecios = opc.precios !== false;
  const { jsPDF } = window.jspdf;
  const E = window.APP_CONFIG.EMPRESA;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 15, AN = W - 2 * M, ALTO = 297;
  let y = 0;

  const nombreDe = (uid) => miembros.find((m) => m.user_id === uid)?.nombre ?? "";
  const salto = (necesario) => { if (y + necesario > ALTO - 18) { doc.addPage(); y = 18; } };
  const color = (hex) => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };

  // ---- Cabecera
  doc.setFillColor(...color("#0f172a"));
  doc.rect(0, 0, W, 30, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(15);
  doc.text(E.nombre || "Informe de trabajo", M, 13);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
  const contacto = [E.cif && `CIF ${E.cif}`, E.telefono, E.email].filter(Boolean).join("  ·  ");
  if (contacto) doc.text(contacto, M, 19);
  if (E.direccion) doc.text(E.direccion, M, 24);
  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  const esFinal = parte.estado === "realizado";
  doc.text(esFinal ? "INFORME DE TRABAJO REALIZADO" : "INFORME DE VISITA", W - M, 13, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
  doc.text(`Fecha: ${fFecha(new Date())}`, W - M, 19, { align: "right" });
  doc.setTextColor(20);
  y = 40;

  // ---- Bloques de datos
  const titulo = (t, extra = 0) => {
    salto(14 + extra);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(15, 23, 42);
    doc.text(t.toUpperCase(), M, y);
    doc.setDrawColor(203, 213, 225); doc.line(M, y + 1.8, W - M, y + 1.8);
    y += 7; doc.setTextColor(30);
  };
  const fila = (k, v, anchoK = 38) => {
    if (v == null || v === "") return;
    doc.setFontSize(9.5);
    const lineas = doc.splitTextToSize(String(v), AN - anchoK);
    salto(lineas.length * 4.6 + 1);
    doc.setFont("helvetica", "bold"); doc.setTextColor(100, 116, 139); doc.text(k, M, y);
    doc.setFont("helvetica", "normal"); doc.setTextColor(20); doc.text(lineas, M + anchoK, y);
    y += lineas.length * 4.6 + 1.2;
  };
  const parrafo = (txt) => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
    const lineas = doc.splitTextToSize(String(txt), AN);
    for (const l of lineas) { salto(5); doc.text(l, M, y); y += 4.6; }
    y += 1.5;
  };

  titulo("Datos del encargo");
  fila("Aseguradora", parte.aseguradora);
  fila("Nº expediente", parte.expediente);
  fila("Nº encargo", parte.num_encargo);
  fila("Nº siniestro", parte.num_siniestro);
  fila("Póliza", parte.poliza);
  fila("Fecha encargo", fFecha(parte.fecha_encargo));
  fila("Tramitador", [parte.tramitador_nombre, parte.tramitador_telefono, parte.tramitador_email].filter(Boolean).join(" · "));
  y += 3;

  titulo("Asegurado");
  fila("Nombre", parte.nombre);
  fila("Dirección", [parte.direccion, [parte.codigo_postal, parte.poblacion].filter(Boolean).join(" "), parte.provincia].filter(Boolean).join(", "));
  fila("Teléfono", [parte.telefono, parte.telefono2].filter(Boolean).join(" / "));
  y += 3;

  titulo("Daño / avería");
  parrafo(parte.averia || "—");
  y += 2;

  // ---- Líneas de tarifa
  const lineasFinal = (parte.lineas_realizadas || []).length ? parte.lineas_realizadas : parte.lineas_valoracion || [];
  const lineas = esFinal ? lineasFinal : parte.lineas_valoracion || [];
  if (lineas.length) {
    titulo(esFinal && (parte.lineas_realizadas || []).length ? "Trabajos realizados" : "Valoración", 20);
    const cols = conPrecios ? [
      { t: "Código", w: 16, a: "left" }, { t: "Descripción", w: 88, a: "left" }, { t: "Cant.", w: 14, a: "right" },
      { t: "Precio", w: 22, a: "right" }, { t: "Dto", w: 14, a: "right" }, { t: "Importe", w: 26, a: "right" },
    ] : [
      { t: "Código", w: 20, a: "left" }, { t: "Descripción", w: 140, a: "left" }, { t: "Cant.", w: 20, a: "right" },
    ];
    const xs = []; let xx = M; cols.forEach((c) => { xs.push(xx); xx += c.w; });
    const celda = (txt, i, yy) => {
      const c = cols[i];
      doc.text(txt, c.a === "right" ? xs[i] + c.w - 1 : xs[i] + 1, yy, { align: c.a });
    };
    doc.setFillColor(241, 245, 249); doc.rect(M, y - 4, AN, 6, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(71, 85, 105);
    cols.forEach((c, i) => celda(c.t, i, y));
    y += 5; doc.setFont("helvetica", "normal"); doc.setTextColor(20);
    for (const l of lineas) {
      doc.setFontSize(8.5);
      const desc = doc.splitTextToSize(String(l.descripcion || ""), cols[1].w - 2);
      const h = Math.max(1, desc.length) * 3.8 + 1.5;
      salto(h + 2);
      celda(String(l.codigo || ""), 0, y);
      doc.text(desc, xs[1] + 1, y);
      celda(String(Number(l.cantidad).toLocaleString("es-ES")), 2, y);
      if (conPrecios) {
        celda(fEuros(l.precio), 3, y);
        celda(Number(l.dto) ? `${Number(l.dto)}%` : "", 4, y);
        celda(fEuros(importeLinea(l)), 5, y);
      }
      y += h;
      doc.setDrawColor(226, 232, 240); doc.line(M, y - 3, M + AN, y - 3);
    }
    const iva = window.APP_CONFIG.IVA || 0;
    const t = totalesLineas(lineas, iva);
    salto(20); y += 2;
    if (conPrecios) {
    const filaT = (k, v, negrita) => {
      doc.setFont("helvetica", negrita ? "bold" : "normal"); doc.setFontSize(negrita ? 10.5 : 9.5);
      doc.text(k, M + AN - 32, y, { align: "right" }); doc.text(v, M + AN - 1, y, { align: "right" }); y += 5;
    };
    if (iva) { filaT("Base imponible", fEuros(t.base)); filaT(`IVA ${iva}%`, fEuros(t.iva)); filaT("TOTAL", fEuros(t.total), true); }
    else filaT("TOTAL (sin IVA)", fEuros(t.base), true);
    }
    doc.setFont("helvetica", "normal"); y += 3;
  }

  if (conPrecios && !lineas.length && (parte.importe_valorado != null || parte.importe_autorizado != null)) {
    titulo("Importes");
    fila("Valorado", fEuros(parte.importe_valorado));
    fila("Autorizado", fEuros(parte.importe_autorizado));
    y += 3;
  }

  // ---- Fases
  titulo("Seguimiento");
  const ev = parte.eventos ?? [];
  for (const e of ESTADOS) {
    const ult = [...ev].reverse().find((x) => x.estado === e.id);
    salto(6);
    doc.setFillColor(...color(ult ? e.color : "#cbd5e1"));
    doc.circle(M + 1.6, y - 1.2, 1.6, "F");
    doc.setFont("helvetica", ult ? "bold" : "normal"); doc.setFontSize(9.5); doc.setTextColor(ult ? 20 : 150);
    doc.text(e.nombre, M + 6, y);
    doc.setFont("helvetica", "normal");
    if (e.id === "visitado" && parte.fecha_cita && !ult) doc.text(`Cita: ${fFechaHora(parte.fecha_cita)}`, M + 40, y);
    if (ult) doc.text(fFechaHora(ult.created_at) + (nombreDe(ult.creado_por) ? `  ·  ${nombreDe(ult.creado_por)}` : ""), M + 40, y);
    y += 5.6;
  }
  doc.setTextColor(20);
  y += 2;

  const notas = ev.filter((x) => x.nota);
  if (notas.length) {
    titulo("Observaciones");
    for (const n of notas) {
      doc.setFontSize(8.5); doc.setTextColor(100, 116, 139); doc.setFont("helvetica", "bold");
      salto(10);
      const etiqueta = n.estado ? ESTADOS.find((s) => s.id === n.estado)?.nombre : "Nota";
      doc.text(`${fFechaHora(n.created_at)} · ${etiqueta}`, M, y); y += 4.2;
      doc.setTextColor(20); parrafo(n.nota);
    }
  }

  // ---- Fotos
  const fotos = parte.fotos ?? [];
  if (fotos.length) {
    const grupos = [["antes", "Fotos antes"], ["despues", "Fotos después"], ["otra", "Otras fotos"]];
    for (const [tipo, nombre] of grupos) {
      const lista = fotos.filter((f) => (f.tipo || "otra") === tipo);
      if (!lista.length) continue;
      titulo(nombre, 60);
      const colW = (AN - 6) / 2, maxH = 68;
      let col = 0, filaH = 0;
      for (const f of lista) {
        let src;
        try { const b = await api.descargarArchivo(f.path); if (!b) continue; src = await blobADataURL(b); } catch { continue; }
        const { w, h } = await medirImagen(src);
        let dw = colW, dh = (h / w) * dw;
        if (dh > maxH) { dh = maxH; dw = (w / h) * dh; }
        if (col === 0) salto(maxH + 4);
        const x = M + col * (colW + 6) + (colW - dw) / 2;
        try { doc.addImage(src, "JPEG", x, y, dw, dh, undefined, "FAST"); } catch { /* imagen no válida */ }
        filaH = Math.max(filaH, dh);
        col++;
        if (col === 2) { col = 0; y += filaH + 5; filaH = 0; }
      }
      if (col) y += filaH + 5;
    }
  }

  // ---- Firma
  if (parte.firma_path) {
    try {
      const b = await api.descargarArchivo(parte.firma_path);
      if (b) {
        const src = await blobADataURL(b);
        titulo("Conformidad del cliente", 35);
        doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(60);
        doc.text(`El cliente ${parte.nombre ?? ""} manifiesta su conformidad con el trabajo realizado.`, M, y); y += 3;
        const { w, h } = await medirImagen(src);
        const dw = 70, dh = Math.min(30, (h / w) * dw);
        doc.addImage(src, "PNG", M, y, dw, dh);
        doc.setDrawColor(148, 163, 184); doc.line(M, y + dh + 1, M + dw, y + dh + 1);
        y += dh + 5; doc.setFontSize(8.5); doc.text("Firma del cliente", M, y);
      }
    } catch { /* sin firma */ }
  }

  // ---- Pie con número de página
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(148, 163, 184);
    doc.text(`${parte.aseguradora ?? ""} · Exp. ${parte.expediente ?? "-"}`, M, ALTO - 8);
    doc.text(`Página ${i} de ${n}`, W - M, ALTO - 8, { align: "right" });
  }

  const nombreArchivo = `${esFinal ? "Terminado" : "Visita"}_${(parte.aseguradora || "parte").replace(/\s+/g, "")}_${(parte.expediente || parte.id.slice(0, 8)).replace(/[^\w-]/g, "")}.pdf`;
  return { blob: doc.output("blob"), nombre: nombreArchivo };
}
