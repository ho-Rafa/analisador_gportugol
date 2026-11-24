/* Arte em pixel: cada sprite é um mapa de caracteres, cada caractere é uma cor da PALETA.
   '.' é transparente. Nada de imagens externas: tudo é desenhado aqui. */
const Pixel = (() => {
  const PALETA = {
    K: "#120a14", k: "#2a1c2e",
    W: "#f6f2e8", w: "#d8d0bc", x: "#9c8f78",
    S: "#e6ebf5", s: "#a7b1c4", d: "#646e86",
    R: "#d0303c", r: "#8c1c2a",
    B: "#3c62d0", b: "#243a8c",
    G: "#f2c94c", g: "#b08420",
    L: "#8a5a32", l: "#5a3620",
    F: "#ffe27a", O: "#ff8a2a", o: "#d8401c",
    E: "#ff3348",
    C: "#ecdcae", c: "#b8955a",
    N: "#4a4252", n: "#1e1426",
    M: "#8c9cff", m: "#4a3cb0",
    A: "#62d6e8", a: "#2a8aa8",
  };

  const MAPAS = {
    /* ------------------------------------------------ herói (cavaleiro) */
    heroi_corpo: [
      "....RR......",
      "..RRRrR.....",
      ".RrKKKKKK...",
      "...KSSSSsK..",
      "..KSSSSsssK.",
      "..KSSsKKKKK.",
      "..KSsKFKKFK.",
      "..KssKKKKKK.",
      "..KdssssddK.",
      "...KKKKKKK..",
      "..KsBBBBBsK.",
      ".KsKBBGBBKsK",
      ".KdKBBBBBKdK",
      "..KKLLGLLKK.",
    ],
    heroi_pernas0: [
      "...KbBKBbK..",
      "...KsK.KsK..",
      "...KsK.KsK..",
      "..KKKK.KKKK.",
    ],
    heroi_pernas1: [
      "...KbBKBbK..",
      "..KsK..KsK..",
      ".KsK....KsK.",
      ".KKK....KKKK",
    ],
    heroi_pernas2: [
      "...KbBKBbK..",
      "....KsKsK...",
      "....KsKsK...",
      "...KKKKKKK..",
    ],
    heroi_pernas3: [
      "...KbBKBbK..",
      "...KsKKsK...",
      "..KsK..KsK..",
      "..KKK..KKKK.",
    ],
    espada_alta: [
      ".S.",
      ".W.",
      ".W.",
      ".W.",
      ".W.",
      "GgG",
      ".l.",
      ".G.",
    ],
    espada_lado: [
      ".G.......",
      "lGWWWWWWS",
      ".G.......",
    ],
    corte: [
      "..WS..",
      "....S.",
      ".....W",
      ".....W",
      ".....W",
      "....S.",
      "..WS..",
    ],

    /* ------------------------------------------------ esqueleto (olha p/ esquerda) */
    esqueleto0: [
      "....KKKKK...",
      "...KwWWWWK..",
      "..KwWWWWWWK.",
      "..KKKWKKWWK.",
      "..KEKWKEWwK.",
      "..KWWKWWWwK.",
      "...KWKWKwK..",
      "...KKKKKK...",
      "....KwK.....",
      "..KwKWKwK...",
      ".KwKWWWKwK..",
      ".Kw.KWK.wK..",
      ".Kx.KWK.xK..",
      ".KK.KxK.KK..",
      "...KwWwK....",
      "...Kw.wK....",
      "..KKK.KKK...",
    ],
    esqueleto1: [
      "....KKKKK...",
      "...KwWWWWK..",
      "..KwWWWWWWK.",
      "..KKKWKKWWK.",
      "..KEKWKEWwK.",
      "..KWWKWWWwK.",
      "...KWKWKwK..",
      "...KKKKKK...",
      "....KwK.....",
      "..KwKWKwK...",
      ".KwKWWWKwK..",
      ".Kw.KWK.wK..",
      ".Kx.KWK.xK..",
      ".KK.KxK.KK..",
      "...KwWwK....",
      "..Kw...wK...",
      ".KKK...KKK..",
    ],
    ossos: [
      "...KKKK.....",
      "..KWWWWK....",
      "..KKWKKW.KK.",
      ".KxWWWWKKwWK",
      "KwWKKKKwWwxK",
      "KKKKKKKKKKKK",
    ],

    /* ------------------------------------------------ cenário */
    morcego0: [
      "n.........n",
      "nn.......nn",
      "nnn.n.n.nnn",
      ".nnnnnnnnn.",
      "..nnEnEnn..",
      "....nnn....",
    ],
    morcego1: [
      "...........",
      "....n.n....",
      "..nnnnnnn..",
      ".nnnEnEnnn.",
      "nnn.nnn.nnn",
      "n.........n",
    ],
    suporte: [
      "KNNNK",
      "KnNnK",
      ".KNK.",
      ".KLK.",
      ".KLK.",
      ".KlK.",
      "..K..",
    ],
    chama0: [
      "..O..",
      "..FO.",
      ".OFO.",
      ".FFFO",
      "OFWFO",
      "OFFFO",
      ".OoO.",
    ],
    chama1: [
      ".O...",
      ".OF..",
      ".OFO.",
      "OFFFO",
      "OFWFO",
      "OFFFO",
      ".OoO.",
    ],
    chama2: [
      "...O.",
      "..O..",
      ".OFO.",
      "OFFF.",
      "OFWFO",
      "OFFFO",
      ".OoO.",
    ],
    vela: [
      ".F.",
      "FWF",
      ".k.",
      "WWW",
      "WwW",
      "WwW",
      "wxw",
      "xxx",
    ],

    /* ------------------------------------------------ ícones da interface (9x9) */
    coracao: [
      ".KK...KK.",
      "KRRK.KRRK",
      "KRWRKRRRK",
      "KRRRRRRRK",
      ".KRRRRRK.",
      "..KRRRK..",
      "...KRK...",
      "....K....",
    ],
    caveira: [
      "..KKKKK..",
      ".KWWWWWK.",
      "KWWWWWWWK",
      "KWKKWKKWK",
      "KWKKWKKWK",
      "KWWWKWWWK",
      ".KWWWWWK.",
      "..KWKWK..",
      "...KKK...",
    ],
    espadas: [
      "W.......W",
      ".W.....W.",
      "..W...W..",
      "...W.W...",
      "....W....",
      "...W.W...",
      ".GW...WG.",
      "..G...G..",
      ".l.....l.",
    ],
    orbe: [
      "...KKK...",
      "..KMMMK..",
      ".KMWMMmK.",
      "KMWMMMMmK",
      "KMMMMMMmK",
      "KMMMMMmmK",
      ".KmMMmmK.",
      "..KmmmK..",
      "...KKK...",
    ],
    sino: [
      "....K....",
      "...KGK...",
      "..KGGgK..",
      "..KGGgK..",
      ".KGGGGgK.",
      ".KGGGGgK.",
      "KGGGGGGgK",
      "KKKKKKKKK",
      "...KgK...",
    ],
    moeda: [
      "..KKKKK..",
      ".KGGGGgK.",
      "KGWGgGGgK",
      "KGGggGGgK",
      "KGGGgGGgK",
      "KGGGgGGgK",
      "KgGgggGgK",
      ".KgggggK.",
      "..KKKKK..",
    ],
    pocao: [
      "...KKK...",
      "...KLK...",
      "...KwK...",
      "..KwwwK..",
      ".KwAAAwK.",
      "KwAAAAAaK",
      "KAWAAAAaK",
      "KAAAAAaaK",
      ".KKKKKKK.",
    ],
    runa: [
      ".KKKKKKK.",
      "KssssssdK",
      "KssAAAsdK",
      "KssAsssdK",
      "KssAAssdK",
      "KssAsssdK",
      "KssAsssdK",
      "KdddddddK",
      ".KKKKKKK.",
    ],
    pergaminho: [
      ".KKKKKKK.",
      "KcCCCCCcK",
      ".KCCCCCK.",
      ".KCkkkCK.",
      ".KCCCCCK.",
      ".KCkkCCK.",
      ".KCCCCCK.",
      "KcCCCCCcK",
      ".KKKKKKK.",
    ],
    chave: [
      "..KKK....",
      ".KGGGK...",
      "KGK.KGK..",
      "KGK.KGK..",
      ".KGGGK...",
      "..KGK....",
      "..KGGK...",
      "..KGK....",
      "..KGGK...",
    ],
    bau: [
      ".KKKKKKK.",
      "KLLLLLLLK",
      "KLlLLLlLK",
      "KGGGGGGGK",
      "KLLLGLLLK",
      "KLLKgKLLK",
      "KLLLLLLLK",
      "KKKKKKKKK",
    ],
    livro: [
      "KKKKKKKK.",
      "KrRRRRRRK",
      "KrRGGGRRK",
      "KrRGRGRRK",
      "KrRGGGRRK",
      "KrRRRRRRK",
      "KrRRRRRRK",
      "KWWWWWWWK",
      "KKKKKKKKK",
    ],
    torre: [
      "KK.KKK.KK",
      "KsKsssKsK",
      "KsssssssK",
      "KdsssssdK",
      ".KsssssK.",
      ".KssKssK.",
      ".KsKFKsK.",
      ".KsKFKsK.",
      ".KsssssK.",
      ".KdssssK.",
      ".KsssdsK.",
      "KKKKKKKKK",
    ],
    bandeira: [
      "K........",
      "KRRRRR...",
      "KRRRRRR..",
      "KRRWRRR..",
      "KRRRRR...",
      "K........",
      "K........",
      "K........",
      "KK.......",
    ],
    tocha: [
      "....O....",
      "...OFO...",
      "...FWF...",
      "...OFO...",
      "..KNNNK..",
      "...KLK...",
      "...KLK...",
      "...KlK...",
      "....K....",
    ],
  };

  const cache = new Map();

  /** Desenha o mapa num canvas do tamanho exato do sprite (1 caractere = 1 pixel).
      invertido: espelha na horizontal.  cor: pinta tudo de uma cor só (ex.: piscar branco). */
  function canvasDe(nome, invertido = false, cor = null) {
    const chave = `${nome}|${invertido}|${cor}`;
    if (cache.has(chave)) return cache.get(chave);
    const linhas = MAPAS[nome];
    const alt = linhas.length, larg = linhas[0].length;
    const c = document.createElement("canvas");
    c.width = larg;
    c.height = alt;
    const g = c.getContext("2d");
    for (let y = 0; y < alt; y++) {
      for (let x = 0; x < larg; x++) {
        const ch = linhas[y][invertido ? larg - 1 - x : x];
        if (ch === "." || ch === undefined) continue;
        g.fillStyle = cor || PALETA[ch] || "#f0f";
        g.fillRect(x, y, 1, 1);
      }
    }
    cache.set(chave, c);
    return c;
  }

  const urls = new Map();
  /** Ícone em PNG (data URL), já ampliado, para usar em CSS/<img>. */
  function iconeURL(nome, escala = 4) {
    const chave = `${nome}|${escala}`;
    if (urls.has(chave)) return urls.get(chave);
    const base = canvasDe(nome);
    const c = document.createElement("canvas");
    c.width = base.width * escala;
    c.height = base.height * escala;
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = false;
    g.drawImage(base, 0, 0, c.width, c.height);
    const url = c.toDataURL();
    urls.set(chave, url);
    return url;
  }

  /** Troca todo <i data-icone="nome"> da página pelo ícone em pixel. */
  function preencherIcones(raiz = document) {
    raiz.querySelectorAll("[data-icone]").forEach((el) => {
      if (!MAPAS[el.dataset.icone]) return;
      el.style.backgroundImage = `url(${iconeURL(el.dataset.icone)})`;
    });
  }

  return { PALETA, MAPAS, canvasDe, iconeURL, preencherIcones };
})();
