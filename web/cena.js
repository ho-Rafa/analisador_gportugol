/* Cena do castelo: o fundo em pixel art e o corredor (palco) onde o cavaleiro
   enfrenta os erros do programa. Cada erro do analisador vira um esqueleto. */
const Cena = (() => {
  "use strict";

  const canvas = document.getElementById("cena");
  const ctx = canvas.getContext("2d");
  const palcoEl = document.getElementById("palco");
  const balaoEl = document.getElementById("balao");
  const vitoriaEl = document.getElementById("vitoria");
  const etiquetasEl = document.getElementById("etiquetas");
  const calmo = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const GRAVIDADE = 720, PULO = 236, ANDAR = 72, CORRER = 125;
  const MAX_VISIVEIS = 14;

  let S = 3, W = 0, H = 0;                 // escala e tamanho da cena em "pixels da arte"
  const fundo = document.createElement("canvas");
  const palcoFundo = document.createElement("canvas");
  let palco = { x: 0, y: 0, w: 0, h: 0 };  // retângulo do palco, em pixels da arte
  let palcoTela = { left: 0, top: 0, width: 0 };
  let chao = 0;                            // y (absoluto) do chão do palco
  let porta = { x: 0, w: 20, h: 28, abertura: 0 };   // x relativo ao palco
  let plataformas = [];                    // x relativo ao palco, y relativo ao chão (negativo = acima)
  let janelas = [], tochas = [], morcegos = [], particulas = [], restos = [];
  let inimigos = [], fila = [];
  let excedente = 0, vitoria = false, festaFeita = false, tempo = 0, idSeq = 0;
  let topoY = 0, mouse = null, recado = null, tempoVitoria = null;
  const teclas = new Set();
  let puloPedido = false, ataquePedido = false;
  const etiquetas = new Map();
  const heroi = { x: 14, y: 0, vx: 0, vy: 0, dir: 1, noChao: true, ataque: 0, acertou: false,
                  ferido: 0, comemora: 0, andando: false };
  const ganchos = { aoAbater() {}, aoClicar() {} };

  // ------------------------------------------------------------ utilidades
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function semente(n) {                    // gerador aleatório com semente (cenário sempre igual)
    return () => {
      n = (n + 0x6d2b79f5) | 0;
      let t = Math.imul(n ^ (n >>> 15), 1 | n);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function ret(el) {
    const b = el.getBoundingClientRect();
    return { x: b.left / S, y: b.top / S, w: b.width / S, h: b.height / S, r: b.right / S, b: b.bottom / S };
  }

  /** Linhas [y, x1, x2] que formam um arco gótico (pontudo) de largura w e altura h. */
  function formaArco(x0, y0, w, h, R) {
    R = Math.max(R, w / 2);
    const ha = Math.sqrt(R * R - (R - w / 2) ** 2);
    const linhas = [];
    for (let y = y0; y < y0 + h; y++) {
      const t = y0 + ha - y;
      if (t <= 0) { linhas.push([y, x0, x0 + w]); continue; }
      const s = Math.sqrt(Math.max(0, R * R - t * t));
      const a = Math.round(x0 + R - s), b = Math.round(x0 + w - R + s);
      if (b - a >= 1) linhas.push([y, a, b]);
    }
    return linhas;
  }
  function pintarLinhas(g, linhas, cor) {
    g.fillStyle = cor;
    for (const [y, a, b] of linhas) g.fillRect(a, y, b - a, 1);
  }
  function caminhoDe(linhas) {
    const p = new Path2D();
    for (const [y, a, b] of linhas) p.rect(a, y, b - a, 1);
    return p;
  }

  // ------------------------------------------------------------ medidas
  function medir() {
    S = innerHeight >= 1000 ? 4 : innerHeight >= 600 ? 3 : 2;
    W = Math.ceil(innerWidth / S);
    H = Math.ceil(innerHeight / S);
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = W * S + "px";
    canvas.style.height = H * S + "px";
    ctx.imageSmoothingEnabled = false;
    medirPalco(true);
    desenharFundo();
    if (!morcegos.length) criarMorcegos();
  }

  function medirPalco(forcar = false) {
    const b = palcoEl.getBoundingClientRect();
    palcoTela = b;
    const novo = { x: Math.round(b.left / S), y: Math.round(b.top / S), w: Math.round(b.width / S), h: Math.round(b.height / S) };
    const mudouTamanho = novo.w !== palco.w || novo.h !== palco.h;
    palco = novo;
    chao = palco.y + palco.h - 9;
    if (mudouTamanho || forcar) {
      porta.x = palco.w - 32;
      plataformas = [
        { x: Math.round(palco.w * 0.27), y: -20, w: 34 },
        { x: Math.round(palco.w * 0.6), y: -20, w: 34 },
      ];
      heroi.x = clamp(heroi.x, 2, porta.x - 12);
      desenharPalcoFundo();
      reposicionar();
    }
  }

  // ------------------------------------------------------------ fundo (parado)
  function desenharFundo() {
    fundo.width = W;
    fundo.height = H;
    const g = fundo.getContext("2d");
    g.imageSmoothingEnabled = false;
    const rnd = semente(1234);
    paredeDePedra(g, rnd);
    janelas = [];
    tochas = [];

    const topo = ret(document.querySelector(".topo"));
    topoY = Math.round(topo.b);
    const yBase = palco.y;

    if (innerWidth > 900) {
      const esq = ret(document.querySelector(".pergaminho.esquerdo"));
      const dir = ret(document.querySelector(".pergaminho.direito"));
      const cen = ret(document.querySelector(".centro"));

      const lb = clamp(Math.floor(esq.x) - 3, 5, 14);
      const rb = clamp(Math.floor(W - dir.r) - 3, 5, 14);
      const vao1 = esq.r, vao2 = cen.x, vao3 = cen.r, vao4 = dir.x;
      const p1 = Math.min(12, Math.floor(vao2 - vao1) - 8), p2 = Math.min(12, Math.floor(vao4 - vao3) - 8);
      const pilares = [{ x: 0, w: lb }];
      if (p1 >= 4) pilares.push({ x: Math.round((vao1 + vao2) / 2 - p1 / 2), w: p1 });
      if (p2 >= 4) pilares.push({ x: Math.round((vao3 + vao4) / 2 - p2 / 2), w: p2 });
      pilares.push({ x: W - rb, w: rb });

      for (let i = 0; i < pilares.length - 1; i++) {
        arcada(g, pilares[i].x + pilares[i].w, pilares[i + 1].x, topoY, yBase);
      }
      for (const p of pilares) pilar(g, p.x, p.w, topoY, yBase);

      // janela grande com a lua, acima do grimório
      const livreDir = dir.y - topoY - 16;
      if (livreDir > 34) {
        const w = Math.round(clamp(dir.w * 0.55, 24, 48));
        const h = Math.round(Math.min(livreDir - 6, w * 2.1));
        janelas.push(janela(g, Math.round(dir.x + dir.w / 2 - w / 2), topoY + 12 + Math.round((livreDir - 6 - h) / 2), w, h, true, rnd));
      }
      // janela menor embaixo do pergaminho da esquerda
      const livreEsq = yBase - esq.b - 18;
      if (livreEsq > 30) {
        const w = Math.round(clamp(esq.w * 0.42, 18, 34));
        const h = Math.round(Math.min(livreEsq - 4, w * 2));
        janelas.push(janela(g, Math.round(esq.x + esq.w / 2 - w / 2), Math.round(esq.b + 12 + (livreEsq - 4 - h) / 2), w, h, false, rnd));
      }
      // correntes penduradas no vão do centro
      corrente(g, cen.x + cen.w * 0.08, topoY, cen.y + 2);
      corrente(g, cen.r - cen.w * 0.08, topoY, cen.y + 2);
      // teias nos cantos
      teia(g, lb, topoY, 9, 1);
      teia(g, W - rb - 1, topoY, 9, -1);
      // tochas nos pilares do meio
      for (const p of pilares.slice(1, -1)) {
        tochas.push({ x: Math.round(p.x + p.w / 2 - 2.5), y: Math.round(cen.y + cen.h * 0.42), fase: rnd() * 10 });
      }
    }
    vinheta(g);
  }

  function paredeDePedra(g, rnd) {
    g.fillStyle = "#0d0911";
    g.fillRect(0, 0, W, H);
    const cores = ["#231b29", "#271e2e", "#2b2133", "#201925", "#2d2335", "#251c2b"];
    for (let linha = 0, y = 0; y < H; linha++, y += 8) {
      const desloc = (linha % 2) * 8;
      for (let x = -desloc; x < W; x += 16) {
        g.fillStyle = cores[Math.floor(rnd() * cores.length)];
        g.fillRect(x + 1, y + 1, 15, 7);
        g.fillStyle = "rgba(255,255,255,0.045)";
        g.fillRect(x + 1, y + 1, 15, 1);
        g.fillStyle = "rgba(0,0,0,0.22)";
        g.fillRect(x + 1, y + 7, 15, 1);
        const sorte = rnd();
        if (sorte < 0.1) {                        // rachadura
          g.fillStyle = "rgba(0,0,0,0.4)";
          const cx = x + 3 + Math.floor(rnd() * 9);
          g.fillRect(cx, y + 2, 1, 2);
          g.fillRect(cx + 1, y + 4, 1, 2);
        } else if (sorte < 0.14) {                // musgo
          g.fillStyle = "rgba(70,110,70,0.35)";
          g.fillRect(x + 2 + Math.floor(rnd() * 8), y + 6, 4, 1);
        }
      }
    }
  }

  function pilar(g, x, w, y0, y1) {
    for (let y = y0; y < y1; y += 6) {
      g.fillStyle = (Math.floor(y / 6) % 2) ? "#3a2f44" : "#362b40";
      g.fillRect(x, y, w, 6);
      g.fillStyle = "#4b3f57";
      g.fillRect(x + 1, y, w - 2, 1);
      g.fillStyle = "#211a27";
      g.fillRect(x, y + 5, w, 1);
    }
    g.fillStyle = "#56486a";
    g.fillRect(x + 1, y0, 1, y1 - y0);
    g.fillStyle = "#18121c";
    g.fillRect(x + w - 1, y0, 1, y1 - y0);
    g.fillStyle = "#4e4259";                      // capitel e base
    g.fillRect(x - 2, y0, w + 4, 3);
    g.fillRect(x - 2, y1 - 4, w + 4, 4);
    g.fillStyle = "#0c080e";
    g.fillRect(x - 2, y0 + 3, w + 4, 1);
    g.fillRect(x - 2, y1 - 5, w + 4, 1);
  }

  function arcada(g, x0, x1, yTopo, yBase) {
    x0 = Math.round(x0);
    x1 = Math.round(x1);
    const w = x1 - x0;
    if (w < 12) return;
    const altura = Math.min((yBase - yTopo) * 0.3, w * 0.62);
    const R = (altura * altura + (w * w) / 4) / w;
    const forma = formaArco(x0, yTopo + 3, w, yBase - yTopo - 3, R);
    pintarLinhas(g, forma, "rgba(3, 1, 6, 0.36)");   // recuo escuro do vão
    let aAnt = null, bAnt = null;
    const mola = yTopo + 3 + altura;
    for (const [y, a, b] of forma) {
      if (y > mola + 1) break;
      const la = aAnt === null ? 3 : Math.max(3, aAnt - a + 2);
      const lb = bAnt === null ? 3 : Math.max(3, b - bAnt + 2);
      g.fillStyle = "#4a3e55";
      g.fillRect(a, y, la, 1);
      g.fillRect(b - lb, y, lb, 1);
      g.fillStyle = "#0c080e";
      g.fillRect(a + la, y, 1, 1);
      g.fillRect(b - lb - 1, y, 1, 1);
      aAnt = a;
      bAnt = b;
    }
  }

  function janela(g, x, y, w, h, comLua, rnd) {
    const R = w * 0.78;
    for (const [m, cor] of [[5, "#0b070e"], [4, "#4e4259"], [2, "#2a2234"]]) {
      pintarLinhas(g, formaArco(x - m, y - m, w + 2 * m, h + m, R + m), cor);
    }
    const forma = formaArco(x, y, w, h, R);
    const ceu = ["#060920", "#090e2a", "#0d1434", "#111a3e", "#162149", "#1b2854"];
    for (const [yy, a, b] of forma) {
      g.fillStyle = ceu[Math.min(ceu.length - 1, Math.floor(((yy - y) / h) * ceu.length))];
      g.fillRect(a, yy, b - a, 1);
    }
    const caminho = caminhoDe(forma);
    g.save();
    g.clip(caminho);
    const estrelas = [];
    const quantas = Math.round((w * h) / 45);
    for (let i = 0; i < quantas; i++) {
      const sx = x + Math.floor(rnd() * w), sy = y + Math.floor(rnd() * h);
      g.fillStyle = rnd() < 0.3 ? "#cfd6ff" : "#6c78b0";
      g.fillRect(sx, sy, 1, 1);
      if (rnd() < 0.35) estrelas.push({ x: sx, y: sy, fase: rnd() * 6.28 });
    }
    let lua = null;
    if (comLua) {
      const ha = Math.sqrt(R * R - (R - w / 2) ** 2);
      const r = Math.round(clamp(w * 0.24, 5, 12));
      const lx = x + Math.round(w * 0.58), ly = y + Math.round(Math.max(ha * 0.85, r + 4));
      for (let dy = -r - 4; dy <= r + 4; dy++) {
        for (let dx = -r - 4; dx <= r + 4; dx++) {
          const d = Math.hypot(dx, dy);
          if (d > r && d < r + 4) {
            g.fillStyle = `rgba(190, 200, 255, ${0.13 * (1 - (d - r) / 4)})`;
            g.fillRect(lx + dx, ly + dy, 1, 1);
          } else if (d <= r) {
            g.fillStyle = dx * 0.8 + dy * 0.3 > r * 0.5 ? "#d4cdb2" : "#f1ecd6";
            g.fillRect(lx + dx, ly + dy, 1, 1);
          }
        }
      }
      for (const [cx, cy, cr] of [[-0.35, -0.25, 0.24], [0.15, 0.32, 0.18], [-0.12, 0.5, 0.12], [0.38, -0.38, 0.12]]) {
        const rr = Math.max(1, cr * r);
        for (let dy = -rr; dy <= rr; dy++) {
          for (let dx = -rr; dx <= rr; dx++) {
            if (Math.hypot(dx, dy) <= rr) {
              g.fillStyle = "#c9c0a2";
              g.fillRect(Math.round(lx + cx * r + dx), Math.round(ly + cy * r + dy), 1, 1);
            }
          }
        }
      }
      g.fillStyle = "rgba(58, 70, 112, 0.85)";     // nuvem fina na frente da lua
      g.fillRect(x + Math.round(w * 0.15), ly + Math.round(r * 0.55), Math.round(w * 0.55), 2);
      g.fillRect(x + Math.round(w * 0.3), ly + Math.round(r * 0.55) - 1, Math.round(w * 0.3), 1);
      g.fillRect(x + Math.round(w * 0.05), ly + Math.round(r * 0.55) + 2, Math.round(w * 0.35), 1);
      lua = { x: lx, y: ly, r };
    }
    g.restore();
    // caixilhos de ferro
    const meio = x + Math.floor(w / 2) - 1;
    const ha = Math.sqrt(R * R - (R - w / 2) ** 2);
    const travessa = Math.round(y + ha + (h - ha) * 0.45);
    for (const [yy, a, b] of forma) {
      g.fillStyle = "#0b070e";
      if (meio >= a && meio + 2 <= b) g.fillRect(meio, yy, 2, 1);
      if (yy === travessa || yy === travessa + 1) g.fillRect(a, yy, b - a, 1);
    }
    g.fillStyle = "#5a4c66";                     // parapeito
    g.fillRect(x - 7, y + h, w + 14, 3);
    g.fillStyle = "#1a131e";
    g.fillRect(x - 7, y + h + 3, w + 14, 1);
    return { caminho, estrelas, lua };
  }

  function corrente(g, x, y0, y1) {
    x = Math.round(x);
    for (let y = y0, i = 0; y < y1; y += 3, i++) {
      g.fillStyle = "#3d3646";
      if (i % 2) {
        g.fillRect(x - 1, y, 3, 1);
        g.fillRect(x - 1, y + 3, 3, 1);
        g.fillRect(x - 1, y, 1, 4);
        g.fillRect(x + 1, y, 1, 4);
      } else {
        g.fillRect(x, y, 1, 4);
      }
    }
  }

  function teia(g, x, y, tam, lado) {
    g.fillStyle = "rgba(210, 210, 225, 0.16)";
    for (let i = 0; i < tam; i++) {
      g.fillRect(x + lado * i, y + i, 1, 1);        // diagonal
      g.fillRect(x + lado * i, y, 1, 1);            // borda de cima
      g.fillRect(x, y + i, 1, 1);                   // borda do lado
    }
    for (const r of [tam * 0.45, tam * 0.85]) {
      for (let a = 0; a <= Math.PI / 2; a += 0.12) {
        g.fillRect(Math.round(x + lado * Math.cos(a) * r), Math.round(y + Math.sin(a) * r), 1, 1);
      }
    }
  }

  function vinheta(g) {
    const grad = g.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.25, W / 2, H * 0.5, Math.max(W, H) * 0.72);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.55)");
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
  }

  // ------------------------------------------------------------ palco (parado)
  function desenharPalcoFundo() {
    palcoFundo.width = Math.max(1, palco.w);
    palcoFundo.height = Math.max(1, palco.h);
    const g = palcoFundo.getContext("2d");
    const rnd = semente(99);
    const solo = palco.h - 9;

    // escurece a parede atrás do corredor
    const grad = g.createLinearGradient(0, 0, 0, solo);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.35)");
    g.fillStyle = grad;
    g.fillRect(0, 0, palco.w, solo);

    // chão de blocos de pedra
    const cores = ["#3a2f44", "#352a3e", "#3f3349", "#372c41"];
    for (let x = 0; x < palco.w; x += 16) {
      g.fillStyle = "#0c080e";
      g.fillRect(x, solo, 16, 9);
      g.fillStyle = cores[Math.floor(rnd() * cores.length)];
      g.fillRect(x + 1, solo + 1, 15, 8);
      g.fillStyle = "#6a5c7a";
      g.fillRect(x + 1, solo, 15, 1);
      g.fillStyle = "#4e4259";
      g.fillRect(x + 1, solo + 1, 15, 1);
      g.fillStyle = "rgba(0,0,0,0.3)";
      g.fillRect(x + 1, solo + 6, 15, 3);
      if (rnd() < 0.3) {
        g.fillStyle = "rgba(0,0,0,0.35)";
        g.fillRect(x + 4 + Math.floor(rnd() * 8), solo + 3, 2, 1);
      }
    }

    // plataformas
    for (const p of plataformas) {
      const py = solo + p.y;
      g.fillStyle = "#0c080e";
      g.fillRect(p.x - 1, py - 1, p.w + 2, 6);
      g.fillStyle = "#463a52";
      g.fillRect(p.x, py, p.w, 4);
      g.fillStyle = "#6a5c7a";
      g.fillRect(p.x, py, p.w, 1);
      g.fillStyle = "#2a2131";
      g.fillRect(p.x, py + 3, p.w, 1);
      for (let x = p.x + 8; x < p.x + p.w; x += 9) {
        g.fillStyle = "#0c080e";
        g.fillRect(x, py + 1, 1, 3);
      }
      g.fillStyle = "#2c2633";                     // mãos-francesas de ferro
      for (const bx of [p.x + 4, p.x + p.w - 6]) {
        g.fillRect(bx, py + 4, 2, 1);
        g.fillRect(bx + 1, py + 5, 1, 2);
      }
    }

    // moldura da porta
    const px = porta.x, py = solo - porta.h, pw = porta.w;
    pintarLinhas(g, formaArco(px - 4, py - 4, pw + 8, porta.h + 4, (pw + 8) * 0.62), "#0b070e");
    pintarLinhas(g, formaArco(px - 3, py - 3, pw + 6, porta.h + 3, (pw + 6) * 0.62), "#54476a");
    pintarLinhas(g, formaArco(px - 1, py - 1, pw + 2, porta.h + 1, (pw + 2) * 0.62), "#2a2234");
    g.fillStyle = "#0b070e";
    g.fillRect(px - 4, solo, pw + 8, 1);
  }

  // ------------------------------------------------------------ morcegos e partículas
  function criarMorcegos() {
    morcegos = [];
    if (calmo) return;
    for (let i = 0; i < 6; i++) {
      morcegos.push({
        x: Math.random() * W,
        y0: topoY + 6 + Math.random() * Math.max(10, H * 0.38),
        amp: 2 + Math.random() * 6,
        vel: (12 + Math.random() * 20) * (Math.random() < 0.5 ? -1 : 1),
        fase: Math.random() * 6,
        t: Math.random() * 10,
      });
    }
  }

  function particula(x, y, vx, vy, cor, vida, grav = 0) {
    if (particulas.length > 400) return;
    particulas.push({ x, y, vx, vy, cor, vida, max: vida, grav });
  }

  function luz(x, y, r, a, cor = "255,150,60") {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${cor},${a})`);
    g.addColorStop(1, `rgba(${cor},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }

  function desenharTocha(x, y, fase, dt) {
    ctx.drawImage(Pixel.canvasDe("suporte"), x, y);
    const q = Math.floor(tempo * 9 + fase) % 3;
    ctx.drawImage(Pixel.canvasDe("chama" + q), x, y - 7);
    luz(x + 2.5, y - 3, 28 + Math.sin(tempo * 13 + fase) * 2, 0.2);
    if (!calmo && Math.random() < dt * 3) {
      particula(x + 1 + Math.random() * 3, y - 7, (Math.random() - 0.5) * 8, -12 - Math.random() * 12,
                Math.random() < 0.5 ? "#ffe27a" : "#ff8a2a", 0.9, -4);
    }
  }

  // ------------------------------------------------------------ inimigos (erros)
  function visiveis() {
    return inimigos.filter((e) => e.visivel && e.estado !== "morrendo");
  }

  function reposicionar() {
    const ativos = inimigos.filter((e) => !e.condenado && e.estado !== "morrendo").sort((a, b) => a.linha - b.linha);
    const vis = ativos.slice(0, MAX_VISIVEIS);
    const xi = 52, xf = porta.x - 24;
    const passo = vis.length ? (xf - xi) / vis.length : 0;
    vis.forEach((e, i) => {
      e.base = Math.round(xi + passo * (i + 0.5) - 6);
      e.visivel = true;
      if (e.estado === "surgindo" && e.t === 0) e.x = e.base;
    });
    ativos.slice(MAX_VISIVEIS).forEach((e) => { e.visivel = false; });
    excedente = Math.max(0, ativos.length - MAX_VISIVEIS);
  }

  /** Recebe a lista de erros do analisador e atualiza os esqueletos.
      Erros que sumiram são derrotados pelo cavaleiro; erros novos surgem do chão. */
  function atualizarErros(erros, { reiniciar = false } = {}) {
    const chave = (m) => m.texto.replace(/^Linha \d+:\s*/, "");
    if (reiniciar) {
      inimigos = [];
      fila = [];
      restos = [];
      recado = null;
      porta.abertura = 0;
      festaFeita = false;
      Object.assign(heroi, { x: 14, y: 0, vx: 0, vy: 0, dir: 1, ataque: 0, comemora: 0 });
    }
    const livres = erros.map((m) => ({ chave: chave(m), texto: m.texto, linha: m.linha }));
    let abatidos = 0;
    for (const e of inimigos) {
      if (e.condenado || e.estado === "morrendo") continue;
      const i = livres.findIndex((n) => n.chave === e.chave);
      if (i >= 0) {
        const n = livres.splice(i, 1)[0];
        e.texto = n.texto;
        e.linha = n.linha;
      } else {
        e.condenado = true;
        fila.push(e);
        abatidos++;
      }
    }
    for (const n of livres) {
      inimigos.push({ id: ++idSeq, ...n, x: 0, base: 0, dir: -1, estado: "surgindo", t: 0, flash: 0,
                      fase: Math.random() * 6, condenado: false, visivel: false, andando: false });
    }
    if (livres.length && !reiniciar) heroi.ferido = 0.8;
    vitoria = erros.length === 0;
    if (!vitoria) {
      festaFeita = false;
      vitoriaEl.hidden = true;
    }
    reposicionar();
    return { abatidos, novos: livres.length };
  }

  function matar(e) {
    e.estado = "morrendo";
    e.t = 0;
    e.flash = 0.3;
    ganchos.aoAbater(e);
  }

  function iniciarAtaque() {
    heroi.ataque = 0.3;
    heroi.acertou = false;
  }

  function golpe() {
    const h = heroi;
    const alcance = (e) => {
      const d = (e.x - h.x) * h.dir;
      return d > -2 && d < 21 && h.y > -14;
    };
    const alvo = fila[0];
    if (alvo && alcance(alvo)) {
      fila.shift();
      matar(alvo);
      faiscas(palco.x + alvo.x + 6, chao - 9, "#ffffff");
      return;
    }
    const e = visiveis().find((v) => !v.condenado && alcance(v));
    if (e) {
      e.flash = 0.25;
      e.x += h.dir * 3;
      recado = { inimigo: e, texto: `Ele só cai se você corrigir a linha ${e.linha}!`, ate: tempo + 2.4 };
      faiscas(palco.x + e.x + 6, chao - 9, "#ffe27a");
    }
  }

  function faiscas(x, y, cor) {
    for (let i = 0; i < 10; i++) {
      particula(x, y, (Math.random() - 0.5) * 70, (Math.random() - 0.8) * 60, cor, 0.35 + Math.random() * 0.2, 120);
    }
  }

  // ------------------------------------------------------------ atualização
  function atualizar(dt) {
    tempo += dt;
    medirPalco();

    for (const b of morcegos) {
      b.t += dt;
      b.x += b.vel * dt;
      if (b.x > W + 15) b.x = -15;
      if (b.x < -15) b.x = W + 15;
    }

    for (const p of particulas) {
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vida -= dt;
    }
    particulas = particulas.filter((p) => p.vida > 0);

    for (const r of restos) r.t += dt;
    restos = restos.filter((r) => r.t < 6);

    atualizarInimigos(dt);
    atualizarHeroi(dt);

    // portão: abre quando não há mais erros e o cavaleiro terminou o serviço
    if (vitoria && fila.length === 0) {
      porta.abertura = Math.min(1, porta.abertura + dt / 1.2);
      if (porta.abertura >= 1 && !festaFeita) {
        festaFeita = true;
        heroi.comemora = 1.6;
        vitoriaEl.hidden = false;
        vitoriaEl.style.animation = "none";
        void vitoriaEl.offsetWidth;
        vitoriaEl.style.animation = "";
        clearTimeout(tempoVitoria);
        tempoVitoria = setTimeout(() => { vitoriaEl.hidden = true; }, 4500);
        for (let i = 0; i < 40; i++) {
          particula(palco.x + porta.x + Math.random() * porta.w, chao - Math.random() * porta.h,
                    (Math.random() - 0.5) * 40, -20 - Math.random() * 40, Math.random() < 0.5 ? "#ffe27a" : "#ffffff", 1.2, 30);
        }
      }
    } else {
      porta.abertura = Math.max(0, porta.abertura - dt / 0.6);
    }
  }

  function atualizarInimigos(dt) {
    for (const e of inimigos) {
      e.t += dt;
      e.flash = Math.max(0, e.flash - dt);
      if (e.estado === "surgindo") {
        if (e.visivel && Math.random() < 0.6) {
          particula(palco.x + e.x + 2 + Math.random() * 8, chao - 1, (Math.random() - 0.5) * 20, -15 - Math.random() * 20, "#5a4a3a", 0.5, 80);
        }
        if (e.t >= 0.7) e.estado = "vivo";
        continue;
      }
      if (e.estado === "morrendo") continue;
      const alvo = e.base + Math.sin(e.t * 0.7 + e.fase) * 5;
      const dx = alvo - e.x;
      const passo = Math.sign(dx) * Math.min(Math.abs(dx), (Math.abs(dx) > 8 ? 30 : 12) * dt);
      e.x += passo;
      e.andando = Math.abs(passo) > 0.02;
      const dh = heroi.x - e.x;
      e.dir = Math.abs(dh) < 50 ? (Math.sign(dh) || -1) : (e.andando ? Math.sign(passo) : e.dir);
    }
    for (const e of inimigos) {
      if (e.estado === "morrendo" && e.t > 0.3) {
        restos.push({ x: e.x, t: 0 });
        for (let i = 0; i < 14; i++) {
          particula(palco.x + e.x + 6, chao - 8 - Math.random() * 8, (Math.random() - 0.5) * 60, -30 - Math.random() * 50,
                    Math.random() < 0.6 ? "#d8d0bc" : "#f6f2e8", 0.8, 200);
        }
      }
    }
    inimigos = inimigos.filter((e) => !(e.estado === "morrendo" && e.t > 0.3));
  }

  function atualizarHeroi(dt) {
    const h = heroi;
    h.ferido = Math.max(0, h.ferido - dt);
    h.comemora = Math.max(0, h.comemora - dt);
    if (h.ataque > 0) {
      h.ataque -= dt;
      if (!h.acertou && h.ataque < 0.17) {
        h.acertou = true;
        golpe();
      }
    }

    // erros escondidos (além do limite de esqueletos na tela) caem na hora
    while (fila.length && !fila[0].visivel) matar(fila.shift());

    let direcao = 0, velocidade = ANDAR;
    const alvo = fila[0];
    if (alvo) {                                   // piloto automático: vai até o erro corrigido
      const lado = alvo.x >= h.x ? 1 : -1;
      const destino = alvo.x - lado * 13;
      const dx = destino - h.x;
      if (Math.abs(dx) > 2) {
        direcao = Math.sign(dx);
        velocidade = CORRER;
      } else {
        h.dir = lado;
        if (h.ataque <= 0 && h.noChao) iniciarAtaque();
      }
    } else if (h.comemora <= 0) {                 // controle do jogador
      if (teclas.has("arrowleft") || teclas.has("a")) direcao -= 1;
      if (teclas.has("arrowright") || teclas.has("d")) direcao += 1;
      if (puloPedido && h.noChao) {
        h.vy = -PULO;
        h.noChao = false;
      }
      if (ataquePedido && h.ataque <= 0) iniciarAtaque();
    }
    puloPedido = ataquePedido = false;
    if (h.ataque > 0 && h.noChao) direcao = 0;

    h.vx = direcao * velocidade;
    if (direcao) h.dir = direcao;

    const yAntes = h.y;
    h.vy += GRAVIDADE * dt;
    h.x += h.vx * dt;
    h.y += h.vy * dt;
    const limite = porta.abertura > 0.8 ? porta.x + 4 : porta.x - 13;
    h.x = clamp(h.x, 2, limite);

    h.noChao = false;
    if (h.y >= 0) {
      h.y = 0;
      h.vy = 0;
      h.noChao = true;
    } else if (h.vy >= 0) {
      for (const p of plataformas) {
        if (h.x + 9 > p.x && h.x + 3 < p.x + p.w && yAntes <= p.y + 0.01 && h.y >= p.y) {
          h.y = p.y;
          h.vy = 0;
          h.noChao = true;
        }
      }
    }
    h.andando = direcao !== 0 && h.noChao;
  }

  // ------------------------------------------------------------ desenho
  function desenhar(dt) {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(fundo, 0, 0);

    for (const j of janelas) {
      ctx.save();
      ctx.clip(j.caminho);
      for (const s of j.estrelas) {
        const brilho = Math.sin(tempo * 1.7 + s.fase);
        if (brilho > 0.75) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(s.x, s.y, 1, 1);
          if (brilho > 0.95) {
            ctx.fillStyle = "rgba(255,255,255,0.5)";
            ctx.fillRect(s.x - 1, s.y, 3, 1);
            ctx.fillRect(s.x, s.y - 1, 1, 3);
          }
        }
      }
      if (j.lua) luz(j.lua.x, j.lua.y, j.lua.r * 3 + Math.sin(tempo) * 1.5, 0.12, "170,185,255");
      ctx.restore();
    }

    for (const b of morcegos) {
      const img = Pixel.canvasDe("morcego" + (Math.floor(b.t * 8) % 2));
      ctx.drawImage(img, Math.round(b.x), Math.round(b.y0 + Math.sin(b.t * 3 + b.fase) * b.amp));
    }

    for (const t of tochas) desenharTocha(t.x, t.y, t.fase, dt);

    // ---- palco
    ctx.drawImage(palcoFundo, palco.x, palco.y);
    desenharTocha(palco.x + Math.round(palco.w * 0.12), palco.y + 9, 1.3, dt);
    desenharTocha(palco.x + Math.round(palco.w * 0.78), palco.y + 9, 4.1, dt);
    desenharPorta();
    for (const vx of [8, porta.x - 9, porta.x + porta.w + 6]) {
      const vela = Pixel.canvasDe("vela");
      ctx.drawImage(vela, palco.x + vx, chao - vela.height);
      if (Math.sin(tempo * 17 + vx) > 0.3) {
        ctx.fillStyle = "#ffe27a";
        ctx.fillRect(palco.x + vx + 1, chao - vela.height - 1, 1, 1);
      }
      luz(palco.x + vx + 1.5, chao - vela.height + 1, 12, 0.16);
    }

    for (const r of restos) {
      const img = Pixel.canvasDe("ossos");
      ctx.globalAlpha = r.t > 5 ? Math.max(0, 6 - r.t) : 1;
      ctx.drawImage(img, Math.round(palco.x + r.x), chao - img.height);
      ctx.globalAlpha = 1;
    }
    for (const e of inimigos) desenharInimigo(e);
    desenharHeroi();

    for (const p of particulas) {
      ctx.globalAlpha = Math.max(0, p.vida / p.max);
      ctx.fillStyle = p.cor;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
    }
    ctx.globalAlpha = 1;

    atualizarDom();
  }

  function desenharPorta() {
    const x = palco.x + porta.x, y = chao - porta.h, w = porta.w, h = porta.h;
    const forma = formaArco(x, y, w, h, w * 0.62);
    pintarLinhas(ctx, forma, "#040205");
    if (porta.abertura > 0) {
      for (const [yy, a, b] of forma) {
        ctx.fillStyle = `rgba(255, 214, 130, ${porta.abertura * (0.25 + 0.6 * ((yy - y) / h))})`;
        ctx.fillRect(a, yy, b - a, 1);
      }
      luz(x + w / 2, chao - 8, 34, 0.25 * porta.abertura, "255,210,120");
    }
    const sobe = Math.round(porta.abertura * (h - 3));
    ctx.save();
    ctx.clip(caminhoDe(forma));
    ctx.fillStyle = "#3d3646";
    for (let bx = x + 2; bx < x + w - 1; bx += 4) ctx.fillRect(bx, y - sobe, 1, h);
    ctx.fillRect(x, y + 9 - sobe, w, 1);
    ctx.fillRect(x, y + 19 - sobe, w, 1);
    ctx.fillStyle = "#7a7290";
    for (let bx = x + 2; bx < x + w - 1; bx += 4) ctx.fillRect(bx, y + h - 1 - sobe, 1, 1);
    ctx.restore();
  }

  function desenharInimigo(e) {
    if (!e.visivel) return;
    const quadro = e.andando ? Math.floor(e.t * 6) % 2 : 0;
    const branco = e.flash > 0 && Math.floor(e.flash * 30) % 2 === 0;
    const img = Pixel.canvasDe("esqueleto" + quadro, e.dir > 0, branco ? "#ffffff" : null);
    const x = Math.round(palco.x + e.x), yTopo = chao - img.height;
    if (e.estado === "surgindo") {
      const sobe = Math.round((1 - Math.min(1, e.t / 0.7)) * img.height);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x - 2, chao - 40, img.width + 4, 40);
      ctx.clip();
      ctx.drawImage(img, x, yTopo + sobe);
      ctx.restore();
      return;
    }
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(x + 2, chao, 8, 1);
    luz(x + 6, yTopo + 4, 9, 0.12, "255,50,70");
    ctx.drawImage(img, x, yTopo);
  }

  function desenharHeroi() {
    const h = heroi;
    const inv = h.dir < 0;
    const piscando = h.ferido > 0 && Math.floor(h.ferido * 16) % 2 === 0;
    const cor = piscando ? "#ff6070" : null;
    const bx = Math.round(palco.x + h.x), by = Math.round(chao + h.y) - 18;
    const parte = (nome, ox, oy, corParte = cor) => {
      const img = Pixel.canvasDe(nome, inv, corParte);
      ctx.drawImage(img, inv ? bx + 12 - ox - img.width : bx + ox, by + oy);
    };
    if (h.noChao) {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(bx + 2, Math.round(chao + h.y), 8, 1);
    }
    let pernas = "heroi_pernas0";
    if (!h.noChao) pernas = "heroi_pernas1";
    else if (h.andando) pernas = "heroi_pernas" + [1, 2, 3, 2][Math.floor(tempo * 10) % 4];
    const respira = !h.andando && h.noChao && h.ataque <= 0 && Math.floor(tempo * 1.6) % 2 ? 1 : 0;

    parte(pernas, 0, 14);
    parte("heroi_corpo", 0, respira);
    if (h.ataque > 0) {
      parte("espada_lado", 10, 10);
      if (h.ataque > 0.1) parte("corte", 17, 6, null);
    } else if (h.comemora > 0) {
      parte("espada_alta", 9, -6 - (Math.floor(tempo * 6) % 2));
      if (Math.random() < 0.3) particula(bx + (inv ? 1 : 10) + Math.random() * 3, by - 6, (Math.random() - 0.5) * 20, -10, "#ffe27a", 0.6);
    } else {
      parte("espada_alta", 10, 5 + respira);
    }
  }

  // ------------------------------------------------------------ DOM (etiquetas e balão)
  function inimigoEm(ax, ay) {
    for (const e of visiveis()) {
      const ex = palco.x + e.x;
      if (ax >= ex - 2 && ax <= ex + 14 && ay >= chao - 21 && ay <= chao + 1) return e;
    }
    return null;
  }

  function atualizarDom() {
    const relX = (ax) => ax * S - palcoTela.left;
    const relY = (ay) => ay * S - palcoTela.top;

    const vivos = new Set();
    for (const e of visiveis()) {
      if (e.estado === "surgindo" && e.t < 0.4) continue;
      vivos.add(e.id);
      let el = etiquetas.get(e.id);
      if (!el) {
        el = document.createElement("div");
        el.className = "etiqueta";
        etiquetasEl.appendChild(el);
        etiquetas.set(e.id, el);
      }
      el.textContent = "L" + e.linha;
      el.style.left = relX(palco.x + e.x + 6) + "px";
      el.style.top = relY(chao - 19) + "px";
    }
    if (excedente > 0) {
      vivos.add("mais");
      let el = etiquetas.get("mais");
      if (!el) {
        el = document.createElement("div");
        el.className = "etiqueta";
        etiquetasEl.appendChild(el);
        etiquetas.set("mais", el);
      }
      el.textContent = `+${excedente} erros`;
      el.style.left = relX(palco.x + porta.x - 16) + "px";
      el.style.top = relY(chao - porta.h - 3) + "px";
    }
    for (const [id, el] of etiquetas) {
      if (!vivos.has(id)) {
        el.remove();
        etiquetas.delete(id);
      }
    }

    let foco = null, texto = "";
    const sobMouse = mouse && inimigoEm(mouse.x, mouse.y);
    palcoEl.classList.toggle("sobre-inimigo", !!sobMouse);
    if (recado && tempo < recado.ate && inimigos.includes(recado.inimigo) && recado.inimigo.estado !== "morrendo") {
      foco = recado.inimigo;
      texto = recado.texto;
    } else if (sobMouse) {
      foco = sobMouse;
      texto = sobMouse.texto;
    } else if (!fila.length) {
      const perto = visiveis().find((e) => !e.condenado && Math.abs(e.x - heroi.x) < 16 && heroi.y > -12);
      if (perto) {
        foco = perto;
        texto = perto.texto;
      }
    }
    if (foco) {
      if (balaoEl.textContent !== texto) balaoEl.textContent = texto;
      balaoEl.hidden = false;
      const meia = balaoEl.offsetWidth / 2;
      balaoEl.style.left = clamp(relX(palco.x + foco.x + 6), meia + 6, palcoTela.width - meia - 6) + "px";
      balaoEl.style.top = relY(chao - 23) + "px";
    } else {
      balaoEl.hidden = true;
    }
  }

  // ------------------------------------------------------------ entrada
  const CONTROLES = ["arrowleft", "arrowright", "arrowup", "a", "d", "w", " ", "x", "j", "k"];
  function ignorar(ev) {
    const alvo = ev.target;
    if (!alvo || !alvo.tagName) return false;
    if (alvo.isContentEditable || ["TEXTAREA", "INPUT", "SELECT"].includes(alvo.tagName)) return true;
    if (alvo.tagName === "BUTTON" && (ev.key === " " || ev.key === "Enter")) return true;
    return !!document.querySelector(".modal:not([hidden])");
  }
  addEventListener("keydown", (ev) => {
    const k = ev.key.toLowerCase();
    if (!CONTROLES.includes(k) || ev.ctrlKey || ev.metaKey || ev.altKey || ignorar(ev)) return;
    ev.preventDefault();
    if (!ev.repeat) {
      if (k === "arrowup" || k === "w" || k === " ") puloPedido = true;
      if (k === "x" || k === "j" || k === "k") ataquePedido = true;
    }
    teclas.add(k);
  });
  addEventListener("keyup", (ev) => teclas.delete(ev.key.toLowerCase()));
  addEventListener("blur", () => teclas.clear());

  palcoEl.addEventListener("mousemove", (ev) => { mouse = { x: ev.clientX / S, y: ev.clientY / S }; });
  palcoEl.addEventListener("mouseleave", () => { mouse = null; });
  palcoEl.addEventListener("click", (ev) => {
    const e = inimigoEm(ev.clientX / S, ev.clientY / S);
    if (e) ganchos.aoClicar(e.linha);
  });

  // ------------------------------------------------------------ laço principal
  let anterior = performance.now();
  function quadro(agora) {
    const dt = Math.min(0.05, (agora - anterior) / 1000);
    anterior = agora;
    atualizar(dt);
    desenhar(dt);
    requestAnimationFrame(quadro);
  }

  let espera = null;
  function remedir() {
    clearTimeout(espera);
    espera = setTimeout(medir, 80);
  }
  addEventListener("resize", remedir);
  if ("ResizeObserver" in window) {
    const ro = new ResizeObserver(remedir);
    document.querySelectorAll(".pergaminho.esquerdo, .pergaminho.direito, .centro, .palco, .topo").forEach((el) => ro.observe(el));
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(remedir);

  medir();
  requestAnimationFrame(quadro);

  return { atualizarErros, ganchos };
})();
