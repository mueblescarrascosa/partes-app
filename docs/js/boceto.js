// Editor de bocetos a pantalla completa (dibujo interno de muebles, medidas…)
// abrirBoceto({ fondo?: Blob, titulo?: string }) → Promise<Blob PNG | null>

const COLORES = ["#111827", "#dc2626", "#2563eb", "#16a34a"];
const GROSORES = [3, 7, 14];

export function abrirBoceto({ fondo = null, foto = false, titulo = "Boceto" } = {}) {
  return new Promise(async (resolver) => {
    // Tamaño lógico fijo (el dibujo no se deforma si se gira el móvil); lado largo 2000 px
    let W = 2000, H = 1400;
    let imgFondo = null;
    if (fondo) {
      try {
        imgFondo = await createImageBitmap(fondo);
        const k = 2000 / Math.max(imgFondo.width, imgFondo.height);
        W = Math.round(imgFondo.width * k); H = Math.round(imgFondo.height * k);
      } catch { imgFondo = null; }
    }

    const cont = document.createElement("div");
    cont.className = "boceto";
    cont.innerHTML = `
      <div class="boceto-barra">
        <button data-acc="cancelar" class="bb-txt">✕</button>
        <b class="bb-titulo">${titulo}</b>
        <button data-acc="deshacer" title="Deshacer">↶</button>
        <button data-acc="rehacer" title="Rehacer">↷</button>
        <button data-acc="guardar" class="bb-ok">Guardar</button>
      </div>
      <div class="boceto-lienzo"><canvas></canvas></div>
      <div class="boceto-herr">
        <div class="bh-grupo" data-grupo="herr">
          <button data-herr="lapiz" class="on" title="Lápiz">✏️</button>
          <button data-herr="linea" title="Línea recta">📏</button>
          <button data-herr="rect" title="Rectángulo">▭</button>
          <button data-herr="texto" title="Texto / medida">T</button>
          <button data-herr="goma" title="Goma">🧽</button>
        </div>
        <div class="bh-grupo" data-grupo="color">${COLORES.map((c, i) => `<button data-color="${c}" class="${i ? "" : "on"} bh-color" style="--c:${c}"></button>`).join("")}</div>
        <div class="bh-grupo" data-grupo="grosor">${GROSORES.map((g, i) => `<button data-grosor="${g}" class="${i ? "" : "on"}"><i style="width:${4 + i * 4}px;height:${4 + i * 4}px"></i></button>`).join("")}</div>
        <div class="bh-grupo">
          <button data-acc="cuadricula" title="Cuadrícula" class="on">#</button>
          <button data-acc="limpiar" title="Borrar todo">🗑</button>
        </div>
      </div>`;
    document.body.appendChild(cont);
    document.body.classList.add("sin-scroll");

    try { await cont.requestFullscreen?.({ navigationUI: "hide" }); } catch { /* no disponible */ }
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 60)));
    if (!imgFondo) {   // el papel ocupa todo el hueco disponible (lado largo = 2000 px)
      const z = cont.querySelector(".boceto-lienzo").getBoundingClientRect();
      const zw = Math.max(z.width, 100), zh = Math.max(z.height, 100);
      if (zw >= zh) { W = 2000; H = Math.round(2000 * zh / zw); } else { H = 2000; W = Math.round(2000 * zw / zh); }
    }
    const canvas = cont.querySelector("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    const capa = document.createElement("canvas"); capa.width = W; capa.height = H;   // trazos (la goma solo borra trazos)
    const cc = capa.getContext("2d");

    const st = { herr: "lapiz", color: COLORES[0], grosor: GROSORES[0], cuadricula: !imgFondo, ops: [], deshechos: [], actual: null, cambios: false };
    cont.querySelector('[data-acc="cuadricula"]').classList.toggle("on", st.cuadricula);

    const escalaG = () => W / 1000;   // grosores relativos al tamaño lógico
    function dibujarOp(o, g) {
      g.save();
      g.lineCap = "round"; g.lineJoin = "round";
      g.globalCompositeOperation = o.herr === "goma" ? "destination-out" : "source-over";
      g.strokeStyle = o.color; g.fillStyle = o.color;
      g.lineWidth = o.herr === "goma" ? o.grosor * escalaG() * 4 : o.grosor * escalaG();
      const p = o.puntos;
      if (o.herr === "texto") {
        g.font = `600 ${Math.round((22 + o.grosor * 4) * escalaG())}px system-ui, sans-serif`;
        g.textBaseline = "middle";
        g.fillText(o.texto, p[0].x, p[0].y);
      } else if (o.herr === "linea" || o.herr === "rect") {
        const a = p[0], b = p[p.length - 1];
        g.beginPath();
        if (o.herr === "linea") { g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); }
        else g.rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
        g.stroke();
      } else {
        g.beginPath(); g.moveTo(p[0].x, p[0].y);
        if (p.length === 1) g.lineTo(p[0].x + 0.1, p[0].y);
        for (let i = 1; i < p.length - 1; i++) {   // curva suave entre puntos
          const mx = (p[i].x + p[i + 1].x) / 2, my = (p[i].y + p[i + 1].y) / 2;
          g.quadraticCurveTo(p[i].x, p[i].y, mx, my);
        }
        if (p.length > 1) g.lineTo(p[p.length - 1].x, p[p.length - 1].y);
        g.stroke();
      }
      g.restore();
    }
    function pintarBase(g) {
      g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
      if (imgFondo) g.drawImage(imgFondo, 0, 0, W, H);
      if (st.cuadricula) {
        const paso = Math.round(W / 40);
        g.save(); g.strokeStyle = "#e2e8f0"; g.lineWidth = Math.max(1, W / 1500);
        g.beginPath();
        for (let x = paso; x < W; x += paso) { g.moveTo(x, 0); g.lineTo(x, H); }
        for (let y = paso; y < H; y += paso) { g.moveTo(0, y); g.lineTo(W, y); }
        g.stroke(); g.restore();
      }
    }
    function repintarCapa() {
      cc.clearRect(0, 0, W, H);
      for (const o of st.ops) dibujarOp(o, cc);
    }
    function pintar() {
      pintarBase(ctx);
      ctx.drawImage(capa, 0, 0);
      if (st.actual) dibujarOp(st.actual, ctx);
    }
    function ajustar() {   // encaja el lienzo en la pantalla manteniendo la proporción
      const zona = cont.querySelector(".boceto-lienzo").getBoundingClientRect();
      const k = Math.min(zona.width / W, zona.height / H);
      canvas.style.width = `${Math.floor(W * k)}px`; canvas.style.height = `${Math.floor(H * k)}px`;
    }
    const aLogico = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
    };

    let puntero = null;
    canvas.addEventListener("pointerdown", (e) => {
      if (puntero !== null) return;             // un solo dedo a la vez
      e.preventDefault();
      const pt = aLogico(e);
      if (st.herr === "texto") {
        const t = prompt("Texto o medida (p. ej. 80 cm):");
        if (t && t.trim()) { st.ops.push({ herr: "texto", color: st.color, grosor: st.grosor, puntos: [pt], texto: t.trim() }); st.deshechos = []; st.cambios = true; repintarCapa(); pintar(); }
        return;
      }
      puntero = e.pointerId;
      canvas.setPointerCapture(e.pointerId);
      st.actual = { herr: st.herr, color: st.color, grosor: st.grosor, puntos: [pt] };
      if (st.herr === "goma") { st.ops.push(st.actual); repintarCapa(); }
      pintar();
    });
    canvas.addEventListener("pointermove", (e) => {
      if (e.pointerId !== puntero || !st.actual) return;
      const pts = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      if (st.actual.herr === "linea" || st.actual.herr === "rect") st.actual.puntos[1] = aLogico(e);
      else for (const q of pts) st.actual.puntos.push(aLogico(q));
      if (st.actual.herr === "goma") repintarCapa();
      pintar();
    });
    const fin = (e) => {
      if (e.pointerId !== puntero) return;
      puntero = null;
      if (st.actual) {
        if (st.actual.herr !== "goma") st.ops.push(st.actual);
        st.actual = null; st.deshechos = []; st.cambios = true;
        repintarCapa(); pintar();
      }
    };
    canvas.addEventListener("pointerup", fin);
    canvas.addEventListener("pointercancel", fin);

    const marcar = (grupo, btn) => cont.querySelectorAll(`[data-grupo="${grupo}"] button`).forEach((b) => b.classList.toggle("on", b === btn));
    cont.querySelectorAll("[data-herr]").forEach((b) => b.onclick = () => { st.herr = b.dataset.herr; marcar("herr", b); });
    cont.querySelectorAll("[data-color]").forEach((b) => b.onclick = () => {
      st.color = b.dataset.color; marcar("color", b);
      if (st.herr === "goma") { st.herr = "lapiz"; marcar("herr", cont.querySelector('[data-herr="lapiz"]')); }
    });
    cont.querySelectorAll("[data-grosor]").forEach((b) => b.onclick = () => { st.grosor = Number(b.dataset.grosor); marcar("grosor", b); });

    const salir = (resultado) => {
      window.removeEventListener("resize", ajustar);
      window.removeEventListener("popstate", alAtras);
      document.body.classList.remove("sin-scroll");
      cont.remove();
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      resolver(resultado);
    };
    const cancelar = () => {
      if (st.cambios && !confirm("¿Salir sin guardar el dibujo?")) return false;
      return true;
    };
    // El botón "atrás" del móvil no debe tirar el dibujo
    history.pushState({ boceto: 1 }, "");
    const alAtras = () => {
      if (cancelar()) salir(null);
      else history.pushState({ boceto: 1 }, "");
    };
    window.addEventListener("popstate", alAtras);

    cont.querySelector('[data-acc="cancelar"]').onclick = () => { if (cancelar()) { window.removeEventListener("popstate", alAtras); history.back(); salir(null); } };
    cont.querySelector('[data-acc="deshacer"]').onclick = () => { if (st.ops.length) { st.deshechos.push(st.ops.pop()); st.cambios = true; repintarCapa(); pintar(); } };
    cont.querySelector('[data-acc="rehacer"]').onclick = () => { if (st.deshechos.length) { st.ops.push(st.deshechos.pop()); repintarCapa(); pintar(); } };
    cont.querySelector('[data-acc="limpiar"]').onclick = () => { if (st.ops.length && confirm("¿Borrar todo el dibujo?")) { st.ops = []; st.deshechos = []; st.cambios = true; repintarCapa(); pintar(); } };
    cont.querySelector('[data-acc="cuadricula"]').onclick = (e) => { st.cuadricula = !st.cuadricula; e.currentTarget.classList.toggle("on", st.cuadricula); pintar(); };
    cont.querySelector('[data-acc="guardar"]').onclick = () => {
      if (!st.ops.length && !imgFondo) { alert("El dibujo está vacío."); return; }
      pintar();
      // Sobre una foto se guarda en JPG (mucho más ligero); los dibujos a mano, en PNG (trazos nítidos)
      canvas.toBlob((b) => { window.removeEventListener("popstate", alAtras); history.back(); salir(b); }, foto ? "image/jpeg" : "image/png", 0.88);
    };

    window.addEventListener("resize", ajustar);
    ajustar(); pintar();
  });
}
