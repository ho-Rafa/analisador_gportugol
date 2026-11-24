/* Editor, console, grimório e barra de status. Conversa com o analisador em Python (interface.py). */
(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const editor = $("#editor"), realce = $("#realce"), calha = $("#calha"), faixas = $("#faixas");
  const consoleEl = $("#console"), grimorio = $("#grimorio"), listaEl = $("#lista-programas");
  const modal = $("#modal-ajuda");

  const estado = {
    arquivo: null,
    salvo: true,
    marcas: new Map(),      // linha -> { tipo: 'erro' | 'aviso', textos: [] }
    linhaAtual: 1,
    resultado: null,
    abates: Number(lerLocal("castelo.abates")) || 0,
  };

  function lerLocal(chave) {
    try { return localStorage.getItem(chave); } catch { return null; }
  }
  function gravarLocal(chave, valor) {
    try { localStorage.setItem(chave, valor); } catch { /* navegador sem armazenamento: tudo bem */ }
  }
  const semAcento = (t) => t.normalize("NFD").replace(/\p{Mn}/gu, "");
  const escapar = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // ícones em pixel
  Pixel.preencherIcones();
  document.documentElement.style.setProperty("--icone-caveira", `url(${Pixel.iconeURL("caveira")})`);
  document.documentElement.style.setProperty("--icone-sino", `url(${Pixel.iconeURL("sino")})`);

  // ------------------------------------------------------------ realce de sintaxe
  const ESTRUTURA = new Set(["algoritmo", "variaveis", "fim-variaveis", "inicio", "fim", "se", "entao", "senao",
    "fim-se", "enquanto", "faca", "fim-enquanto", "para", "de", "ate", "passo", "fim-para", "funcao", "retorne"]);
  const TIPOS = new Set(["inteiro", "real", "caractere", "literal", "logico", "inteiros", "reais", "caracteres",
    "literais", "logicos", "matriz"]);
  const VALORES = new Set(["verdadeiro", "falso"]);
  const OPERADORES = new Set(["e", "ou", "nao"]);
  const EMBUTIDAS = new Set(["imprima", "leia"]);
  const RE_TOKEN = /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|("(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?)|(0[xX][0-9a-fA-F]+|\d+(?:\.\d+)?)|(fim-(?:vari[áa]veis|se|enquanto|para)(?![\p{L}\p{N}_]))|([\p{L}_][\p{L}\p{N}_]*)|(:=|<>|<=|>=|[-+*/%=<>&|^~])|([()[\],;:])/gu;

  function realcar(texto) {
    let html = "", ultimo = 0;
    for (const m of texto.matchAll(RE_TOKEN)) {
      html += escapar(texto.slice(ultimo, m.index));
      let classe = "pontuacao";
      if (m[1]) classe = "comentario";
      else if (m[2]) classe = "texto";
      else if (m[3]) classe = "numero";
      else if (m[4]) classe = "estrutura";
      else if (m[5]) {
        const p = semAcento(m[5]);
        classe = ESTRUTURA.has(p) ? "estrutura" : TIPOS.has(p) ? "tipo" : VALORES.has(p) ? "valor"
          : OPERADORES.has(p) ? "operador" : EMBUTIDAS.has(p) ? "embutida" : "nome";
      } else if (m[6]) classe = "operador";
      html += `<span class="t-${classe}">${escapar(m[0])}</span>`;
      ultimo = m.index + m[0].length;
    }
    return html + escapar(texto.slice(ultimo)) + "\n ";
  }

  // ------------------------------------------------------------ editor
  function totalLinhas() {
    let n = 1;
    for (const c of editor.value) if (c === "\n") n++;
    return n;
  }

  function desenharCalha() {
    const n = totalLinhas();
    let html = "";
    for (let i = 1; i <= n; i++) {
      const marca = estado.marcas.get(i);
      const classes = ["n"];
      if (marca) classes.push(marca.tipo);
      if (i === estado.linhaAtual) classes.push("atual");
      const titulo = marca ? ` title="${escapar(marca.textos.join("\n")).replace(/"/g, "&quot;")}"` : "";
      html += `<div class="${classes.join(" ")}" data-linha="${i}"${titulo}>${i}</div>`;
    }
    calha.innerHTML = html;
  }

  function desenharFaixas() {
    const lh = alturaLinha();
    let html = `<div class="faixa atual" style="top:${8 + (estado.linhaAtual - 1) * lh}px"></div>`;
    for (const [linha, marca] of estado.marcas) {
      html += `<div class="faixa ${marca.tipo}" style="top:${8 + (linha - 1) * lh}px"></div>`;
    }
    faixas.innerHTML = html;
  }

  function alturaLinha() {
    return parseFloat(getComputedStyle(editor).lineHeight) || 24;
  }

  function atualizarEditor() {
    realce.innerHTML = realcar(editor.value);
    desenharCalha();
    desenharFaixas();
    sincronizarRolagem();
  }

  function sincronizarRolagem() {
    const t = editor.scrollTop, l = editor.scrollLeft;
    realce.style.transform = `translate(${-l}px, ${-t}px)`;
    faixas.style.transform = `translateY(${-t}px)`;
    calha.style.transform = `translateY(${-t}px)`;
  }

  function atualizarLinhaAtual() {
    const n = editor.value.slice(0, editor.selectionStart).split("\n").length;
    if (n !== estado.linhaAtual) {
      estado.linhaAtual = n;
      calha.querySelectorAll(".n.atual").forEach((el) => el.classList.remove("atual"));
      const el = calha.querySelector(`[data-linha="${n}"]`);
      if (el) el.classList.add("atual");
      desenharFaixas();
    }
  }

  function definirTexto(codigo) {
    editor.value = codigo;
    editor.scrollTop = 0;
    editor.scrollLeft = 0;
    estado.marcas = new Map();
    estado.linhaAtual = 1;
    faixas.classList.remove("velho");
    atualizarEditor();
  }

  function inserir(texto) {
    if (!document.execCommand || !document.execCommand("insertText", false, texto)) {
      editor.setRangeText(texto, editor.selectionStart, editor.selectionEnd, "end");
      aoEditar();
    }
  }

  function aoEditar() {
    atualizarEditor();
    atualizarLinhaAtual();
    if (estado.salvo) {
      estado.salvo = false;
      atualizarTitulo();
    }
    faixas.classList.add("velho");                 // as marcas de erro podem ter mudado de linha
  }

  editor.addEventListener("input", aoEditar);
  editor.addEventListener("scroll", sincronizarRolagem);
  ["keyup", "click", "focus", "select"].forEach((ev) => editor.addEventListener(ev, atualizarLinhaAtual));
  document.addEventListener("selectionchange", () => { if (document.activeElement === editor) atualizarLinhaAtual(); });

  editor.addEventListener("keydown", (ev) => {
    if (ev.key === "Tab" && !ev.ctrlKey && !ev.altKey) {
      ev.preventDefault();
      if (!ev.shiftKey) inserir("    ");
    } else if (ev.key === "Enter" && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey) {
      ev.preventDefault();
      const antes = editor.value.slice(0, editor.selectionStart);
      const linha = antes.slice(antes.lastIndexOf("\n") + 1);
      let recuo = linha.match(/^[ \t]*/)[0];
      if (/(entao|faca|inicio|variaveis|senao)$/.test(semAcento(linha.trim()))) recuo += "    ";
      inserir("\n" + recuo);
    } else if (ev.key === "Escape") {
      editor.blur();
    }
  });

  calha.addEventListener("click", (ev) => {
    const el = ev.target.closest(".n.erro, .n.aviso");
    if (el) irParaLinha(Number(el.dataset.linha));
  });

  function irParaLinha(n) {
    const linhas = editor.value.split("\n");
    n = Math.max(1, Math.min(n, linhas.length));
    let inicio = 0;
    for (let i = 0; i < n - 1; i++) inicio += linhas[i].length + 1;
    editor.focus({ preventScroll: true });
    editor.setSelectionRange(inicio, inicio + linhas[n - 1].length);
    const lh = alturaLinha();
    editor.scrollTop = Math.max(0, (n - 1) * lh - editor.clientHeight / 2 + lh);
    sincronizarRolagem();
    atualizarLinhaAtual();
  }

  // ------------------------------------------------------------ servidor
  async function api(caminho, dados) {
    const opcoes = dados
      ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dados) }
      : {};
    const resposta = await fetch(caminho, opcoes);
    const json = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(json.erro || `o servidor respondeu ${resposta.status}`);
    return json;
  }

  function semServidor(erro) {
    escreverConsole([
      { tipo: "erro", texto: "Não consegui falar com o analisador em Python." },
      { tipo: "prompt", texto: "Abra o castelo pelo terminal:  python interface.py" },
      { tipo: "prompt", texto: `(${erro.message})` },
    ]);
  }

  // ------------------------------------------------------------ programas
  async function carregarLista() {
    const nomes = await api("/api/programas");
    listaEl.innerHTML = "";
    for (const nome of nomes) {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.innerHTML = `<i class="ic" data-icone="pergaminho"></i><span></span>`;
      b.querySelector("span").textContent = nome;
      b.dataset.nome = nome;
      b.title = `Abrir ${nome}`;
      b.classList.toggle("ativo", nome === estado.arquivo);
      b.addEventListener("click", () => abrir(nome));
      li.appendChild(b);
      listaEl.appendChild(li);
    }
    Pixel.preencherIcones(listaEl);
    return nomes;
  }

  function confirmarDescarte() {
    return estado.salvo || confirm(`Você tem alterações não salvas em ${estado.arquivo || "este programa"}. Descartar?`);
  }

  async function abrir(nome) {
    if (nome === estado.arquivo && estado.salvo) return;
    if (!confirmarDescarte()) return;
    try {
      const { codigo } = await api(`/api/programa?nome=${encodeURIComponent(nome)}`);
      estado.arquivo = nome;
      estado.salvo = true;
      gravarLocal("castelo.ultimo", nome);
      definirTexto(codigo);
      atualizarTitulo();
      await analisar({ reiniciar: true });
    } catch (erro) {
      semServidor(erro);
    }
  }

  async function salvar() {
    if (!estado.arquivo) {
      const nome = pedirNome();
      if (!nome) return;
      estado.arquivo = nome;
    }
    try {
      await api("/api/salvar", { nome: estado.arquivo, codigo: editor.value });
      estado.salvo = true;
      gravarLocal("castelo.ultimo", estado.arquivo);
      atualizarTitulo();
      await carregarLista();
      anotarConsole(`> salvo em programas/${estado.arquivo}`);
    } catch (erro) {
      anotarConsole(`> não deu para salvar: ${erro.message}`, "erro");
    }
  }

  function pedirNome() {
    let nome = prompt("Nome do programa (letras, números, _ ou -):", "meu_programa");
    if (!nome) return null;
    nome = nome.trim().replace(/\.gpt$/i, "").replace(/[^\p{L}\p{N}_\- ]/gu, "_").slice(0, 60);
    return nome ? nome + ".gpt" : null;
  }

  async function novoPrograma() {
    if (!confirmarDescarte()) return;
    const nome = pedirNome();
    if (!nome) return;
    let ident = semAcento(nome.replace(/\.gpt$/, "")).replace(/[^A-Za-z0-9_]/g, "_");
    if (/^\d/.test(ident)) ident = "_" + ident;
    const modelo = `algoritmo ${ident};\n\nvariáveis\n    x: inteiro;\nfim-variáveis\n\ninício\n    x := 1;\n    imprima("x vale ", x);\nfim\n`;
    try {
      await api("/api/salvar", { nome, codigo: modelo });
      estado.salvo = true;
      estado.arquivo = null;
      await carregarLista();
      await abrir(nome);
    } catch (erro) {
      anotarConsole(`> não deu para criar: ${erro.message}`, "erro");
    }
  }

  function atualizarTitulo() {
    const nome = estado.arquivo || "programa.gpt";
    $("#nome-aba").textContent = nome;
    $("#trilha-arquivo").textContent = nome;
    $("#marca-sujo").hidden = estado.salvo;
    $("#st-fase").textContent = nome + (estado.salvo ? "" : "*");
    document.title = `${estado.salvo ? "" : "● "}${nome} · Castelo Semântico`;
    listaEl.querySelectorAll("button").forEach((b) => b.classList.toggle("ativo", b.dataset.nome === estado.arquivo));
  }

  // ------------------------------------------------------------ análise
  let analisando = false;
  async function analisar({ reiniciar = false } = {}) {
    if (analisando) return;
    analisando = true;
    try {
      const r = await api("/api/analisar", { codigo: editor.value });
      mostrarResultado(r, reiniciar);
    } catch (erro) {
      semServidor(erro);
    } finally {
      analisando = false;
    }
  }

  function mostrarResultado(r, reiniciar) {
    estado.resultado = r;
    estado.marcas = new Map();
    for (const m of r.mensagens) {
      if (m.tipo === "ok") continue;
      const marca = estado.marcas.get(m.linha) || { tipo: m.tipo, textos: [] };
      if (m.tipo === "erro") marca.tipo = "erro";
      marca.textos.push(m.texto);
      estado.marcas.set(m.linha, marca);
    }
    faixas.classList.remove("velho");
    desenharCalha();
    desenharFaixas();

    const linhas = [{ tipo: "prompt", texto: `> analisando ${estado.arquivo || "programa"}...` }];
    for (const m of r.mensagens) linhas.push({ tipo: m.tipo, texto: m.texto, linha: m.linha });
    linhas.push({ tipo: r.erros ? "final" : "final vitoria", texto: r.resultado });
    escreverConsole(linhas);

    const f = r.por_fase;
    const fase = (nome, n) => n ? `<span class="falha">${nome} ✗${n}</span>` : `<span class="ok">${nome} ✓</span>`;
    $("#fases").innerHTML = `${fase("léxica", f["léxico"])} · ${fase("sintática", f["sintático"])} · ${fase("semântica", f["semântico"])}`;

    mostrarGrimorio(r.simbolos);

    const erros = r.mensagens.filter((m) => m.tipo === "erro");
    Cena.atualizarErros(erros, { reiniciar });
    atualizarStatus();
  }

  function escreverConsole(linhas) {
    consoleEl.innerHTML = "";
    for (const l of linhas) {
      const clicavel = l.linha && (l.tipo === "erro" || l.tipo === "aviso");
      const el = document.createElement(clicavel ? "button" : "div");
      el.className = `msg ${l.tipo}`;
      el.textContent = l.texto;
      if (clicavel) {
        el.title = "Ir para a linha";
        el.addEventListener("click", () => irParaLinha(l.linha));
      }
      consoleEl.appendChild(el);
    }
    consoleEl.scrollTop = 0;
  }

  function anotarConsole(texto, tipo = "prompt") {
    const el = document.createElement("div");
    el.className = `msg ${tipo}`;
    el.textContent = texto;
    consoleEl.appendChild(el);
    consoleEl.scrollTop = consoleEl.scrollHeight;
  }

  const ICONE_TIPO = { inteiro: "moeda", real: "pocao", caractere: "runa", literal: "pergaminho", "lógico": "chave" };

  function mostrarGrimorio(simbolos) {
    grimorio.innerHTML = "";
    if (!simbolos.length) {
      grimorio.innerHTML = `<p class="vazio">Nenhum símbolo ainda. Declare variáveis entre <b>variáveis</b> e <b>fim-variáveis</b>.</p>`;
      return;
    }
    const escopos = new Map();
    for (const s of simbolos) {
      const chave = s.escopo === "global" ? "global" : `função ${s.escopo}`;
      if (!escopos.has(chave)) escopos.set(chave, []);
      escopos.get(chave).push(s);
    }
    for (const [nome, lista] of escopos) {
      lista.sort((a, b) => (a.categoria === "função") - (b.categoria === "função"));   // variáveis antes das funções
      const titulo = document.createElement("div");
      titulo.className = "escopo";
      titulo.textContent = nome;
      grimorio.appendChild(titulo);
      for (const s of lista) {
        const icone = s.categoria === "função" ? "livro" : s.matriz ? "bau" : ICONE_TIPO[s.base] || "runa";
        const tipo = s.categoria === "função" ? `função ${s.tipo}` : s.categoria === "parâmetro" ? `${s.tipo} · parâmetro` : s.tipo;
        const b = document.createElement("button");
        b.className = "simbolo" + (s.usado || s.categoria === "parâmetro" ? "" : " nao-usado");
        b.title = `${s.categoria} ${s.nome}: ${tipo} (linha ${s.linha}). Clique para ir à declaração.`;
        b.innerHTML = `<i class="ic" data-icone="${icone}"></i><span class="nome"></span><span class="ln">L${s.linha}</span><span class="tipo"></span>`;
        b.querySelector(".nome").textContent = s.nome;
        b.querySelector(".tipo").textContent = tipo;
        b.addEventListener("click", () => irParaLinha(s.linha));
        grimorio.appendChild(b);
      }
    }
    Pixel.preencherIcones(grimorio);
  }

  // ------------------------------------------------------------ status
  function atualizarStatus() {
    const r = estado.resultado;
    const erros = r ? r.erros : 0;
    $("#st-problemas").textContent = erros;
    $("#st-problemas").parentElement.classList.toggle("ruim", erros > 0);
    $("#st-avisos").textContent = r ? r.avisos : 0;
    $("#st-hp").textContent = Math.max(0, 100 - 10 * erros);
    $("#st-hp").parentElement.classList.toggle("ruim", erros > 0);
    $("#st-mana").textContent = r ? r.simbolos.length : 0;
    $("#st-abates").textContent = estado.abates;
  }

  Cena.ganchos.aoAbater = () => {
    estado.abates++;
    gravarLocal("castelo.abates", String(estado.abates));
    const el = $("#st-abates");
    el.textContent = estado.abates;
    el.classList.remove("pulsar");
    void el.offsetWidth;
    el.classList.add("pulsar");
  };
  Cena.ganchos.aoClicar = irParaLinha;

  // ------------------------------------------------------------ botões e atalhos
  $("#btn-analisar").addEventListener("click", () => analisar());
  $("#btn-salvar").addEventListener("click", salvar);
  $("#btn-novo").addEventListener("click", novoPrograma);

  function abrirAjuda() {
    modal.hidden = false;
    Pixel.preencherIcones(modal);
    $("#fechar-ajuda").focus();
  }
  function fecharAjuda() {
    modal.hidden = true;
  }
  $("#btn-ajuda").addEventListener("click", abrirAjuda);
  $("#btn-ajuda-2").addEventListener("click", abrirAjuda);
  $("#fechar-ajuda").addEventListener("click", fecharAjuda);
  modal.addEventListener("click", (ev) => { if (ev.target === modal) fecharAjuda(); });

  addEventListener("keydown", (ev) => {
    const ctrl = ev.ctrlKey || ev.metaKey;
    if (ctrl && ev.key === "Enter") {
      ev.preventDefault();
      analisar();
    } else if (ctrl && ev.key.toLowerCase() === "s") {
      ev.preventDefault();
      salvar();
    } else if (ev.key === "Escape" && !modal.hidden) {
      fecharAjuda();
    }
  });

  addEventListener("beforeunload", (ev) => {
    if (!estado.salvo) {
      ev.preventDefault();
      ev.returnValue = "";
    }
  });

  // ------------------------------------------------------------ início
  async function iniciar() {
    atualizarTitulo();
    atualizarStatus();
    try {
      const nomes = await carregarLista();
      const pedido = new URLSearchParams(location.search).get("abrir");
      const escolhido = [pedido, lerLocal("castelo.ultimo"), "cadastro.gpt", nomes[0]].find((n) => n && nomes.includes(n));
      if (escolhido) {
        await abrir(escolhido);
      } else {
        definirTexto("algoritmo novo;\n\nvariáveis\n    x: inteiro;\nfim-variáveis\n\ninício\n    x := 1;\nfim\n");
        await analisar({ reiniciar: true });
      }
    } catch (erro) {
      definirTexto("algoritmo novo;\n\ninício\n    imprima(\"olá\");\nfim\n");
      semServidor(erro);
    }
  }

  iniciar();
})();
