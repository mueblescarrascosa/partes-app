// Genera el PDF del informe final para el tramitador
import { ESTADOS, fFecha, fFechaHora, fEuros, blobADataURL, medirImagen, importeLinea, totalesLineas } from "./util.js";

export async function generarInforme(parte, api, miembros = [], opc = {}) {
  const conPrecios = opc.precios !== false;
  // Conexión = presupuesto para un particular (se manda al cliente, con IVA)
  const cx = parte.tipo === "conexion";
  const ivaPct = opc.iva != null ? opc.iva : (window.APP_CONFIG.IVA || 0);
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
  doc.text(cx ? (esFinal ? "TRABAJO REALIZADO" : "PRESUPUESTO") : (esFinal ? "INFORME DE TRABAJO REALIZADO" : "INFORME DE VISITA"), W - M, 13, { align: "right" });
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

  if (!cx) {
  titulo("Datos del encargo");
  fila("Aseguradora", parte.aseguradora);
  fila("Nº expediente", parte.expediente);
  fila("Nº encargo", parte.num_encargo);
  fila("Nº siniestro", parte.num_siniestro);
  fila("Póliza", parte.poliza);
  fila("Fecha encargo", fFecha(parte.fecha_encargo));
  fila("Tramitador", [parte.tramitador_nombre, parte.tramitador_telefono, parte.tramitador_email].filter(Boolean).join(" · "));
  y += 3;
  }

  titulo(cx ? "Cliente" : "Asegurado");
  fila("Nombre", parte.nombre);
  fila("Dirección", [parte.direccion, [parte.codigo_postal, parte.poblacion].filter(Boolean).join(" "), parte.provincia].filter(Boolean).join(", "));
  fila("Teléfono", [parte.telefono, parte.telefono2].filter(Boolean).join(" / "));
  y += 3;

  titulo(cx ? "Trabajo solicitado" : "Daño / avería");
  parrafo(parte.averia || "—");
  y += 2;

  // ---- Líneas de tarifa
  const lineasFinal = (parte.lineas_realizadas || []).length ? parte.lineas_realizadas : parte.lineas_valoracion || [];
  const lineas = esFinal ? lineasFinal : parte.lineas_valoracion || [];
  if (lineas.length) {
    titulo(esFinal && (parte.lineas_realizadas || []).length ? "Trabajos realizados" : (cx ? "Presupuesto" : "Valoración"), 20);
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
    const iva = ivaPct;
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

  // ---- Seguimiento y observaciones: son internos, no salen en ningún PDF (ni a MULTIBETT ni al cliente)
  const ev = parte.eventos ?? [];
  const CON_SEGUIMIENTO = false;
  if (CON_SEGUIMIENTO && !cx) {
  titulo("Seguimiento");
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
  }

  // ---- Fotos
  const fotos = parte.fotos ?? [];
  if (fotos.length) {
    const grupos = [["firmado", "Parte firmado"], ["antes", "Fotos antes"], ["despues", "Fotos después"], ["otra", "Otras fotos"]];
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
    doc.text(cx ? `${E.nombre ?? ""} · Presupuesto ${parte.expediente ?? ""}` : `${parte.aseguradora ?? ""} · Exp. ${parte.expediente ?? "-"}`, M, ALTO - 8);
    doc.text(`Página ${i} de ${n}`, W - M, ALTO - 8, { align: "right" });
  }

  const nombreArchivo = `${empresaArchivo()}_${esFinal ? "Terminado" : (cx ? "Presupuesto" : "Visita")}_${slug(parte.aseguradora, 20).replace(/-/g, "") || "Parte"}_${slug(parte.expediente) || parte.id.slice(0, 8)}.pdf`;
  return { blob: doc.output("blob"), nombre: nombreArchivo };
}

// Trozo de nombre de archivo seguro (sin tildes ni espacios): "C/ Doctor Muñoz, 20" → "C-Doctor-Munoz-20"
export function slug(t, max = 40) {
  return String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max).replace(/-+$/, "");
}

// "Muebles Carrascosa SL" → "Muebles_Carrascosa": al principio de todos los archivos, para que se vea de quién vienen
export function empresaArchivo() {
  const n = slug(window.APP_CONFIG?.EMPRESA?.nombre || "Muebles Carrascosa", 60).split("-").filter((w) => !/^(sl|sa|slu|sll)$/i.test(w));
  return n.join("_") || "Muebles_Carrascosa";
}

// ---- Relación mensual de trabajos terminados (para facturar a MULTIBETT)
export function generarRelacion(filas, titulo, destino = "", ivaPct = 0) {
  const { jsPDF } = window.jspdf;
  const E = window.APP_CONFIG.EMPRESA;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const W = 297, M = 12, ALTO = 210;
  let y = 0;
  const cab = () => {
    doc.setFillColor(15, 23, 42); doc.rect(0, 0, W, 24, "F");
    doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(14);
    doc.text(E.nombre || "", M, 11);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    doc.text([E.cif && `CIF ${E.cif}`, E.telefono, E.email, E.direccion].filter(Boolean).join("  ·  "), M, 18);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text(titulo, W - M, 11, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    doc.text(`${destino ? "Para: " + destino + "  ·  " : ""}Emitida: ${fFecha(new Date())}`, W - M, 18, { align: "right" });
    doc.setTextColor(20); y = 33;
  };
  const cols = [
    { t: "Terminado", w: 19 }, { t: "Aseguradora", w: 24 }, { t: "Expediente", w: 25 }, { t: "Encargo", w: 19 },
    { t: "Cliente", w: 38 }, { t: "Dirección / Población", w: 48 }, { t: "Código", w: 15 }, { t: "Trabajo", w: 48 }, { t: "Precio", w: 17, r: true }, { t: "Total parte", w: 20, r: true },
  ];
  const IC = 6, IT = 7, IP = 8;   // código, trabajo y precio: un renglón por código
  const xs = []; let xx = M; cols.forEach((c) => { xs.push(xx); xx += c.w; });
  // vals[IC] y vals[IT] pueden ser listas: cada código va en su propio renglón, alineado con su descripción
  const fila = (vals, negrita) => {
    doc.setFont("helvetica", negrita ? "bold" : "normal"); doc.setFontSize(8);
    const LH = 3.6;
    const partir = (v, i) => doc.splitTextToSize(String(v ?? ""), cols[i].w - 2);
    const sube = (i) => i === IC || i === IT || i === IP;
    const partes = vals.map((v, i) => sube(i) ? null : partir(v, i));
    const lista = (v) => (Array.isArray(v) ? v : [v]);
    const cods = lista(vals[IC]), trabs = lista(vals[IT]), precs = lista(vals[IP]);
    const sub = cods.map((c, k) => { const a = partir(c, IC), b = partir(trabs[k], IT); return { a, b, pr: String(precs[k] ?? ""), n: Math.max(a.length, b.length, 1) }; });
    const nSub = sub.reduce((t, x) => t + x.n, 0);
    const h = Math.max(nSub, ...partes.filter(Boolean).map((p) => p.length)) * LH + 2 + (sub.length - 1) * 1;
    if (y + h > ALTO - 14) { doc.addPage(); cab(); cabecera(); }
    partes.forEach((p, i) => {
      if (!p) return;
      if (i === vals.length - 1 && !negrita) doc.setFont("helvetica", "bold");
      cols[i].r ? doc.text(p, xs[i] + cols[i].w - 1, y, { align: "right" }) : doc.text(p, xs[i] + 1, y);
      doc.setFont("helvetica", negrita ? "bold" : "normal");
    });
    let yy = y;
    sub.forEach((x, k) => {
      if (k) { doc.setDrawColor(241, 245, 249); doc.line(xs[IC], yy - 2.8, xs[IP] + cols[IP].w, yy - 2.8); }
      if (!negrita) doc.setFont("helvetica", "bold");
      doc.text(x.a, xs[IC] + 1, yy);
      doc.setFont("helvetica", negrita ? "bold" : "normal");
      doc.text(x.b, xs[IT] + 1, yy);
      doc.text(x.pr, xs[IP] + cols[IP].w - 1, yy, { align: "right" });
      yy += x.n * LH + 1;
    });
    y += h; doc.setDrawColor(226, 232, 240); doc.line(M, y - 2.5, W - M, y - 2.5);
  };
  const cabecera = () => {
    doc.setFillColor(241, 245, 249); doc.rect(M, y - 4, W - 2 * M, 6, "F");
    doc.setTextColor(71, 85, 105); fila(cols.map((c) => c.t), true); doc.setTextColor(20);
  };
  cab(); cabecera();
  let total = 0;
  for (const f of filas) {
    total += Number(f.importe) || 0;
    const ls = (f.lineas || []).length ? f.lineas : [{ codigo: "", descripcion: f.trabajo }];
    const cant = (l) => (Number(l.cantidad) && Number(l.cantidad) !== 1 ? `${Number(l.cantidad).toLocaleString("es-ES")} × ` : "");
    const lugar = [f.direccion, [f.codigo_postal, f.poblacion].filter(Boolean).join(" ")].filter(Boolean).join("\n");
    fila([fFecha(f.realizado_at), f.aseguradora, f.expediente, f.num_encargo, f.nombre, lugar,
      ls.map((l) => l.codigo || ""),
      ls.map((l) => cant(l) + (l.descripcion || "") + (cant(l) && l.precio != null ? ` (${fEuros(l.precio)}/ud.)` : "")),
      ls.map((l) => (l.precio != null && l.precio !== "" ? fEuros(importeLinea(l)) : "")),
      f.autorizado ? `Valor autorizado\n${fEuros(f.importe)}` : fEuros(f.importe)]);
  }
  if (y + 26 > ALTO - 14) { doc.addPage(); cab(); }
  const iva = Math.round(total * ivaPct) / 100;
  const filaT = (k, v, negrita) => {
    doc.setFont("helvetica", negrita ? "bold" : "normal"); doc.setFontSize(negrita ? 11 : 9.5);
    doc.text(k, W - M - 40, y, { align: "right" }); doc.text(v, W - M, y, { align: "right" }); y += negrita ? 6 : 5;
  };
  y += 3;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text(`${filas.length} trabajos`, M, y);
  filaT("Base imponible", fEuros(total));
  if (ivaPct) { filaT(`IVA ${ivaPct}%`, fEuros(iva)); doc.setDrawColor(148, 163, 184); doc.line(W - M - 75, y - 3.5, W - M, y - 3.5); filaT("TOTAL", fEuros(total + iva), true); }
  else filaT("TOTAL (sin IVA)", fEuros(total), true);
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(150); doc.text(`Página ${i} de ${n}`, W - M, ALTO - 6, { align: "right" }); }
  return doc.output("blob");
}
