"""
FASE 2 - ANÁLISE SINTÁTICA

Lê os tokens e monta a árvore do programa (AST), seguindo a gramática do G-Portugol:

    algoritmo nome;
    variáveis
        x, y: inteiro;
        v: matriz[5] de reais;
    fim-variáveis
    início
        x := 10;
        se x > 5 então ... senão ... fim-se
        enquanto x > 0 faça ... fim-enquanto
        para x de 1 até 10 passo 2 faça ... fim-para
    fim
    função soma(a: inteiro, b: inteiro) : inteiro
    início
        retorne a + b;
    fim

Técnica: "descida recursiva" (uma função para cada regra da gramática).
Quando encontra um erro de sintaxe, anota e pula até um ponto seguro
(o próximo ';' ou o próximo comando) para continuar analisando o resto.
"""
from dataclasses import dataclass

from lexico import valor_inteiro


# ----------------------------------------------------------------- tipos ----

PRIMITIVOS = {"inteiro": "inteiro", "real": "real", "caractere": "caractere",
              "literal": "literal", "logico": "lógico"}
PLURAIS = {"inteiros": "inteiro", "reais": "real", "caracteres": "caractere",
           "literais": "literal", "logicos": "lógico"}
NOME_PLURAL = {v: k.replace("logicos", "lógicos") for k, v in PLURAIS.items()}


@dataclass(frozen=True)
class Tipo:
    base: str          # 'inteiro', 'real', 'caractere', 'literal' ou 'lógico'
    dims: tuple = ()   # tamanhos, se for matriz. Ex.: matriz[3][4] -> (3, 4)

    def __str__(self):
        if not self.dims:
            return self.base
        tamanhos = "".join(f"[{d}]" for d in self.dims)
        return f"matriz{tamanhos} de {NOME_PLURAL.get(self.base, self.base)}"


# ----------------------------------------------------- nós da árvore (AST) ----

class No:
    """Nó da árvore. Ex.: No('atribuicao', 12, alvo=..., valor=...)"""

    def __init__(self, tipo, linha, **campos):
        self.tipo = tipo
        self.linha = linha
        self.__dict__.update(campos)

    def __repr__(self):
        campos = ", ".join(f"{k}={v!r}" for k, v in self.__dict__.items() if k not in ("tipo", "linha"))
        return f"{self.tipo}@{self.linha}({campos})"


class ErroSintatico(Exception):
    def __init__(self, linha, texto):
        super().__init__(texto)
        self.linha = linha
        self.texto = texto


# Palavras que fecham algum bloco: o analisador para de ler comandos quando vê uma delas.
FECHA_BLOCO = {"fim", "fim-se", "senao", "fim-enquanto", "fim-para",
               "fim-variaveis", "inicio", "funcao"}
COMECA_COMANDO = {"se", "enquanto", "para", "retorne"}

# Precedência dos operadores, da mais fraca para a mais forte.
NIVEIS = [("ou",), ("e",), ("|",), ("^",), ("&",), ("=", "<>"),
          ("<", "<=", ">", ">="), ("+", "-"), ("*", "/", "%")]

BONITO = {"inicio": "início", "entao": "então", "senao": "senão", "faca": "faça",
          "ate": "até", "funcao": "função", "variaveis": "variáveis",
          "fim-variaveis": "fim-variáveis", "nao": "não", "logico": "lógico"}


def bonito(palavra):
    return BONITO.get(palavra, palavra)


class Parser:
    def __init__(self, tokens):
        self.tokens = tokens
        self.pos = 0
        self.erros = []          # (linha, 'sintático', mensagem)
        self.abertos = []        # pilha com os fechamentos esperados pelos blocos abertos

    # ------------------------------------------------------- utilidades ----

    @property
    def atual(self):
        return self.tokens[self.pos]

    @property
    def anterior(self):
        return self.tokens[self.pos - 1] if self.pos > 0 else self.tokens[0]

    def proximo(self):
        return self.tokens[min(self.pos + 1, len(self.tokens) - 1)]

    def acabou(self):
        return self.atual.tipo == "fim"

    def avancar(self):
        tok = self.atual
        if not self.acabou():
            self.pos += 1
        return tok

    def eh(self, *valores):
        """O token atual é uma dessas palavras-chave ou símbolos?"""
        return self.atual.tipo in ("palavra", "simbolo") and self.atual.valor in valores

    def aceitar(self, valor):
        return self.avancar() if self.eh(valor) else None

    def erro(self, linha, texto):
        self.erros.append((linha, "sintático", texto))

    def encontrado(self):
        return f"'{self.atual.texto}'" if not self.acabou() else "o fim do arquivo"

    def esperar(self, valor):
        if self.eh(valor):
            return self.avancar()
        raise ErroSintatico(self.atual.linha,
                            f"esperado '{bonito(valor)}', mas encontrou {self.encontrado()}.")

    def esperar_no_fim_da_linha(self, valor):
        """Para ';', 'então' e 'faça': se o aluno só esqueceu no fim da linha,
        anota o erro e continua normalmente (sem perder o resto da análise)."""
        if self.eh(valor):
            return self.avancar()
        if self.acabou() or self.atual.linha > self.anterior.linha:
            self.erro(self.anterior.linha, f"faltou '{bonito(valor)}' no fim da linha.")
            return None
        raise ErroSintatico(self.atual.linha,
                            f"esperado '{bonito(valor)}', mas encontrou {self.encontrado()}.")

    def esperar_nome(self, oque):
        if self.atual.tipo == "id":
            return self.avancar()
        if self.atual.tipo == "palavra":
            raise ErroSintatico(self.atual.linha,
                                f"'{self.atual.texto}' é palavra reservada e não pode ser usada como {oque}.")
        raise ErroSintatico(self.atual.linha, f"esperado {oque}, mas encontrou {self.encontrado()}.")

    def pular_ate(self, *valores):
        while not self.acabou() and not self.eh(*valores):
            self.avancar()

    def sincronizar(self, pos_inicial, linha_erro):
        """Depois de um erro, pula tokens até um lugar seguro para recomeçar."""
        if self.pos == pos_inicial:
            self.avancar()                        # garante que sempre anda pelo menos um token
        while not self.acabou():
            if self.eh(";"):
                self.avancar()
                return
            if self.eh(*FECHA_BLOCO):
                return
            novo_comando = self.atual.tipo == "id" or self.eh(*COMECA_COMANDO)
            if novo_comando and self.atual.linha > linha_erro:
                return
            self.avancar()

    # ---------------------------------------------------------- programa ----

    def programa(self):
        linha = self.atual.linha
        nome = "?"
        if self.acabou():
            self.erro(1, "o programa está vazio. Comece com 'algoritmo <nome>;'.")
            return No("programa", 1, nome=nome, globais=[], corpo=[], funcoes=[])
        if self.aceitar("algoritmo"):
            try:
                nome = self.esperar_nome("o nome do algoritmo").valor
                self.esperar_no_fim_da_linha(";")
            except ErroSintatico as e:
                self.erro(e.linha, e.texto)
                self.pular_ate("variaveis", "inicio")
        else:
            self.erro(linha, f"o programa deve começar com 'algoritmo <nome>;', mas começa com {self.encontrado()}.")
            self.pular_ate("variaveis", "inicio")

        globais = self.bloco_variaveis() if self.eh("variaveis") else []
        corpo = self.bloco("do algoritmo")

        funcoes = []
        while not self.acabou():
            if self.eh("funcao"):
                funcao = self.funcao()
                if funcao:
                    funcoes.append(funcao)
            else:
                self.erro(self.atual.linha, f"{self.encontrado()} fora do lugar: depois do 'fim' "
                                            "do algoritmo só podem vir funções.")
                self.avancar()
                self.pular_ate("funcao")

        return No("programa", linha, nome=nome, globais=globais, corpo=corpo, funcoes=funcoes)

    # ------------------------------------------------------- declarações ----

    def bloco_variaveis(self):
        linha = self.avancar().linha                     # 'variáveis'
        declaracoes = []
        while not self.acabou() and not self.eh("fim-variaveis", "inicio", "funcao", "fim"):
            inicio = self.pos
            try:
                declaracoes.append(self.declaracao())
                self.esperar_no_fim_da_linha(";")
            except ErroSintatico as e:
                self.erro(e.linha, e.texto)
                self.sincronizar(inicio, e.linha)
        if not self.aceitar("fim-variaveis"):
            self.erro(linha, "o bloco 'variáveis' aberto aqui não foi fechado com 'fim-variáveis'.")
        return declaracoes

    def declaracao(self):
        """x, y, z : tipo"""
        primeiro = self.esperar_nome("o nome de uma variável")
        nomes = [(primeiro.valor, primeiro.linha)]
        while self.aceitar(","):
            t = self.esperar_nome("o nome de uma variável")
            nomes.append((t.valor, t.linha))
        self.esperar(":")
        return No("declaracao", primeiro.linha, nomes=nomes, tipo_var=self.tipo())

    def tipo(self, aceita_matriz=True):
        if self.eh(*PRIMITIVOS):
            return Tipo(PRIMITIVOS[self.avancar().valor])
        if aceita_matriz and self.aceitar("matriz"):
            dims = []
            while self.aceitar("["):
                if self.atual.tipo != "inteiro":
                    raise ErroSintatico(self.atual.linha, "o tamanho da matriz deve ser um número inteiro.")
                dims.append(valor_inteiro(self.avancar().texto))
                self.esperar("]")
            if not dims:
                raise ErroSintatico(self.atual.linha, "faltou o tamanho da matriz. Ex.: matriz[10] de inteiros.")
            self.esperar("de")
            if not self.eh(*PLURAIS):
                raise ErroSintatico(self.atual.linha, "esperado o tipo dos elementos no plural "
                                                      "(inteiros, reais, caracteres, literais ou lógicos).")
            return Tipo(PLURAIS[self.avancar().valor], tuple(dims))
        raise ErroSintatico(self.atual.linha, f"tipo desconhecido {self.encontrado()}. "
                                              "Use inteiro, real, caractere, literal ou lógico.")

    # ----------------------------------------------------------- funções ----

    def funcao(self):
        """função nome(a: tipo, b: tipo) : tipo_retorno   [variáveis locais]   início ... fim"""
        linha = self.avancar().linha                     # 'função'
        try:
            nome = self.esperar_nome("o nome da função").valor
            self.esperar("(")
            params = []
            if not self.eh(")"):
                params.append(self.parametro())
                while self.aceitar(","):
                    params.append(self.parametro())
            self.esperar(")")
            retorno = self.tipo(aceita_matriz=False) if self.aceitar(":") else None
        except ErroSintatico as e:
            self.erro(e.linha, e.texto)
            self.pular_ate("funcao")                      # cabeçalho quebrado: pula a função inteira
            return None

        # Variáveis locais: dentro de 'variáveis ... fim-variáveis' ou soltas antes do 'início'.
        if self.eh("variaveis"):
            locais = self.bloco_variaveis()
        else:
            locais = []
            while self.atual.tipo == "id":
                inicio = self.pos
                try:
                    locais.append(self.declaracao())
                    self.esperar_no_fim_da_linha(";")
                except ErroSintatico as e:
                    self.erro(e.linha, e.texto)
                    self.sincronizar(inicio, e.linha)

        corpo = self.bloco(f"da função {nome}")
        return No("funcao", linha, nome=nome, params=params, retorno=retorno, locais=locais, corpo=corpo)

    def parametro(self):
        t = self.esperar_nome("o nome do parâmetro")
        self.esperar(":")
        return (t.valor, self.tipo(), t.linha)

    # ---------------------------------------------------------- comandos ----

    def bloco(self, dono):
        """início comandos fim"""
        abre = self.aceitar("inicio")
        if not abre:
            self.erro(self.atual.linha, f"esperado 'início' {dono}, mas encontrou {self.encontrado()}.")
            if self.acabou():
                return []
        comandos = self.comandos("fim")
        if not self.aceitar("fim"):
            linha = abre.linha if abre else self.atual.linha
            self.erro(linha, f"o bloco {dono} não foi fechado com 'fim'.")
        return comandos

    def comandos(self, *fechamentos):
        """Lê comandos até encontrar um dos fechamentos (ex.: 'fim-se')."""
        lista = []
        self.abertos.append(set(fechamentos))
        while not self.acabou() and not self.eh(*fechamentos):
            if self.eh(*FECHA_BLOCO):
                if self.eh("funcao") or any(self.atual.valor in f for f in self.abertos):
                    break                                 # fecha um bloco de fora: quem abriu reclama
                self.erro(self.atual.linha, f"'{self.atual.texto}' sem bloco correspondente aberto.")
                self.avancar()
                continue
            inicio = self.pos
            try:
                lista.append(self.comando())
            except ErroSintatico as e:
                self.erro(e.linha, e.texto)
                self.sincronizar(inicio, e.linha)
        self.abertos.pop()
        return lista

    def fechar(self, fechamento, comando, linha):
        if not self.aceitar(fechamento):
            self.erro(linha, f"o '{comando}' aberto aqui não foi fechado com '{bonito(fechamento)}'.")

    def cabecalho(self, ler, palavra_final):
        """Lê a condição de 'se'/'enquanto' (ou o cabeçalho do 'para').
        Se der erro, anota e pula só a linha, para o corpo do bloco ainda ser analisado."""
        linha = self.atual.linha
        try:
            resultado = ler()
            self.esperar_no_fim_da_linha(palavra_final)
            return resultado
        except ErroSintatico as e:
            self.erro(e.linha, e.texto)
            while not self.acabou() and self.atual.linha == linha and not self.eh(palavra_final):
                self.avancar()
            self.aceitar(palavra_final)
            return None

    def comando(self):
        tok = self.atual

        if self.eh("se"):
            self.avancar()
            condicao = self.cabecalho(self.expressao, "entao")
            entao = self.comandos("senao", "fim-se")
            senao = self.comandos("fim-se") if self.aceitar("senao") else []
            self.fechar("fim-se", "se", tok.linha)
            return No("se", tok.linha, condicao=condicao, entao=entao, senao=senao)

        if self.eh("enquanto"):
            self.avancar()
            condicao = self.cabecalho(self.expressao, "faca")
            corpo = self.comandos("fim-enquanto")
            self.fechar("fim-enquanto", "enquanto", tok.linha)
            return No("enquanto", tok.linha, condicao=condicao, corpo=corpo)

        if self.eh("para"):
            self.avancar()
            partes = self.cabecalho(self.cabecalho_para, "faca") or (None, None, None, None)
            corpo = self.comandos("fim-para")
            self.fechar("fim-para", "para", tok.linha)
            var, inicio, fim, passo = partes
            return No("para", tok.linha, var=var, inicio=inicio, fim=fim, passo=passo, corpo=corpo)

        if self.eh("retorne"):
            self.avancar()
            valor = None
            if not self.eh(";") and self.atual.linha == tok.linha and not self.acabou():
                valor = self.expressao()
            self.esperar_no_fim_da_linha(";")
            return No("retorne", tok.linha, valor=valor)

        if tok.tipo == "id":
            if self.proximo().valor == "(":               # chamada: imprima("oi");
                chamada = self.chamada()
                self.esperar_no_fim_da_linha(";")
                return No("chamada_cmd", tok.linha, chamada=chamada)

            alvo = self.variavel()                       # atribuição: x := ...;
            if self.eh("="):
                self.erro(self.atual.linha, "use ':=' para atribuir valor (o '=' é comparação).")
                self.avancar()
            else:
                self.esperar(":=")
            valor = self.expressao()
            self.esperar_no_fim_da_linha(";")
            return No("atribuicao", tok.linha, alvo=alvo, valor=valor)

        raise ErroSintatico(tok.linha, f"instrução não reconhecida começando com {self.encontrado()}.")

    def cabecalho_para(self):
        """para i de 1 até 10 [passo 2]"""
        var = self.variavel()
        self.esperar("de")
        inicio = self.expressao()
        self.esperar("ate")
        fim = self.expressao()
        passo = self.expressao() if self.aceitar("passo") else None
        return var, inicio, fim, passo

    # ------------------------------------------------------- expressões ----

    def expressao(self, nivel=0):
        if nivel == len(NIVEIS):
            return self.unaria()
        esquerda = self.expressao(nivel + 1)
        while self.eh(*NIVEIS[nivel]):
            op = self.avancar()
            direita = self.expressao(nivel + 1)
            esquerda = No("binaria", op.linha, op=op.valor, esq=esquerda, dir=direita)
        return esquerda

    def unaria(self):
        if self.eh("-", "+", "nao", "~"):
            op = self.avancar()
            return No("unaria", op.linha, op=op.valor, expr=self.unaria())
        return self.primaria()

    def primaria(self):
        tok = self.atual
        if tok.tipo == "inteiro":
            self.avancar()
            return No("valor", tok.linha, tipo_valor=Tipo("inteiro"), numero=valor_inteiro(tok.texto))
        if tok.tipo in ("real", "literal", "caractere"):
            self.avancar()
            return No("valor", tok.linha, tipo_valor=Tipo(tok.tipo), numero=None)
        if self.eh("verdadeiro", "falso"):
            self.avancar()
            return No("valor", tok.linha, tipo_valor=Tipo("lógico"), numero=None)
        if tok.tipo == "id":
            return self.chamada() if self.proximo().valor == "(" else self.variavel()
        if self.aceitar("("):
            dentro = self.expressao()
            self.esperar(")")
            return dentro
        raise ErroSintatico(tok.linha, f"esperado um valor ou variável, mas encontrou {self.encontrado()}.")

    def variavel(self):
        tok = self.esperar_nome("o nome de uma variável")
        indices = []
        while self.aceitar("["):
            indices.append(self.expressao())
            self.esperar("]")
        return No("variavel", tok.linha, nome=tok.valor, indices=indices)

    def chamada(self):
        tok = self.esperar_nome("o nome de uma função")
        self.esperar("(")
        argumentos = []
        if not self.eh(")"):
            argumentos.append(self.expressao())
            while self.aceitar(","):
                argumentos.append(self.expressao())
        self.esperar(")")
        return No("chamada", tok.linha, nome=tok.valor, args=argumentos)
