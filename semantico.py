"""
FASE 3 - ANÁLISE SEMÂNTICA (o foco do trabalho)

Percorre a árvore montada pelo sintático e verifica o SIGNIFICADO do programa:

  REQUISITO 1 - tabela de símbolos: guarda nome -> tipo de cada variável/função, por escopo
  REQUISITO 2 - uso de variável (ou função) não declarada
  REQUISITO 3 - declaração duplicada
  REQUISITO 4 - compatibilidade de tipos: atribuições, expressões, condições,
                índices de matriz, argumentos de função e retornos
  (o REQUISITO 5 - exibir os resultados - fica no analisador.py)
"""
from sintatico import Tipo

INTEIRO = Tipo("inteiro")
REAL = Tipo("real")
CARACTERE = Tipo("caractere")
LITERAL = Tipo("literal")
LOGICO = Tipo("lógico")
QUALQUER = Tipo("qualquer")      # o que vem do leia(): serve para qualquer variável simples
NUMERICOS = {INTEIRO, REAL}


class Simbolo:
    """Uma linha da tabela de símbolos."""

    def __init__(self, nome, categoria, tipo, linha, escopo):
        self.nome = nome
        self.categoria = categoria   # 'variável', 'parâmetro' ou 'função'
        self.tipo = tipo
        self.linha = linha
        self.escopo = escopo         # 'global' ou o nome da função
        self.usado = False


def compativel(destino, origem):
    """Pode guardar um valor do tipo 'origem' numa variável do tipo 'destino'?"""
    if destino is None or origem is None:
        return True                  # o erro já foi apontado antes; não repete
    if origem == QUALQUER:
        return not destino.dims
    if destino == origem:
        return True
    # Escolha nossa: um inteiro pode ser guardado num real (ex.: salario := 3000;)
    return destino == REAL and origem == INTEIRO


def valor_constante(expr):
    """Se a expressão for um número inteiro escrito direto no código, devolve o número."""
    if expr is None:
        return None
    if expr.tipo == "valor":
        return expr.numero
    if expr.tipo == "unaria" and expr.op == "-":
        n = valor_constante(expr.expr)
        return -n if n is not None else None
    return None


def assinatura(funcao):
    params = ", ".join(f"{nome}: {tipo}" for nome, tipo, _ in funcao.params)
    retorno = f" : {funcao.retorno}" if funcao.retorno else ""
    return f"({params}){retorno}"


class AnalisadorSemantico:
    def __init__(self):
        self.erros = []          # (linha, 'semântico', mensagem)
        self.avisos = []         # (linha, 'aviso', mensagem)
        self.simbolos = []       # REQUISITO 1 - todos os símbolos (para exibir a tabela)
        self.funcoes = {}        # nome -> nó da função
        self.globais = {}        # escopo global: nome -> Simbolo
        self.escopos = [self.globais]
        self.funcao_atual = None
        self.teve_retorno = False

    def erro(self, linha, texto):
        self.erros.append((linha, "semântico", texto))

    # ----------------------------------------------------------- tabela ----

    def buscar(self, nome):
        """Procura do escopo mais interno (função) para o mais externo (global)."""
        for escopo in reversed(self.escopos):
            if nome in escopo:
                return escopo[nome]
        return None

    def declarar(self, nome, categoria, tipo, linha, escopo):
        tabela = self.escopos[-1]
        if nome in tabela:                                       # REQUISITO 3
            self.erro(linha, f"{categoria} {nome} já declarada." if categoria == "variável"
                      else f"{categoria} {nome} já declarado.")
        elif nome in self.funcoes and categoria == "variável" and escopo == "global":
            self.erro(linha, f"o nome {nome} já é usado por uma função.")
        else:
            simbolo = Simbolo(nome, categoria, tipo, linha, escopo)
            tabela[nome] = simbolo                               # REQUISITO 1
            self.simbolos.append(simbolo)

    # ---------------------------------------------------------- programa ----

    def analisar(self, programa):
        # Em G-Portugol as funções ficam DEPOIS do bloco principal, mas podem ser
        # chamadas nele. Por isso registramos todas as funções antes de tudo.
        for f in programa.funcoes:
            if f.nome in ("imprima", "leia"):
                self.erro(f.linha, f"{f.nome} é uma função do G-Portugol e não pode ser redeclarada.")
            elif f.nome in self.funcoes:
                self.erro(f.linha, f"função {f.nome} já declarada.")     # REQUISITO 3
            else:
                self.funcoes[f.nome] = f
                simbolo = Simbolo(f.nome, "função", assinatura(f), f.linha, "global")
                f.simbolo = simbolo
                self.simbolos.append(simbolo)

        for d in programa.globais:
            for nome, linha in d.nomes:
                self.declarar(nome, "variável", d.tipo_var, linha, "global")

        self.comandos(programa.corpo)

        for f in programa.funcoes:
            self.analisar_funcao(f)

        for s in self.simbolos:
            if not s.usado and s.categoria == "variável":
                self.avisos.append((s.linha, "aviso", f"variável {s.nome} declarada mas nunca utilizada."))
            elif not s.usado and s.categoria == "função":
                self.avisos.append((s.linha, "aviso", f"função {s.nome} declarada mas nunca chamada."))

    def analisar_funcao(self, f):
        self.escopos = [self.globais, {}]                        # escopo novo para a função
        for nome, tipo, linha in f.params:
            self.declarar(nome, "parâmetro", tipo, linha, f.nome)
        for d in f.locais:
            for nome, linha in d.nomes:
                self.declarar(nome, "variável", d.tipo_var, linha, f.nome)

        self.funcao_atual, self.teve_retorno = f, False
        self.comandos(f.corpo)
        if f.retorno and not self.teve_retorno:
            self.erro(f.linha, f"a função {f.nome} deve retornar um valor do tipo {f.retorno}, "
                               "mas não tem 'retorne'.")
        self.funcao_atual = None
        self.escopos = [self.globais]

    # ---------------------------------------------------------- comandos ----

    def comandos(self, lista):
        for comando in lista:
            getattr(self, "cmd_" + comando.tipo)(comando)

    def cmd_atribuicao(self, c):
        tipo_alvo = self.tipo_variavel(c.alvo)                   # REQUISITO 2
        tipo_valor = self.tipo_expr(c.valor)
        nome = c.alvo.nome
        if tipo_alvo is not None and tipo_alvo.dims:
            self.erro(c.linha, f"não é possível atribuir à matriz {nome} inteira; use um índice, ex.: {nome}[0].")
        elif not compativel(tipo_alvo, tipo_valor):              # REQUISITO 4
            if c.alvo.indices:
                self.erro(c.linha, f"atribuição incompatível. Os elementos de {nome} são do tipo "
                                   f"{tipo_alvo}, mas recebeu {tipo_valor}.")
            else:
                self.erro(c.linha, f"atribuição incompatível. A variável {nome} é do tipo "
                                   f"{tipo_alvo}, mas recebeu {tipo_valor}.")

    def condicao(self, expr, comando, linha):
        tipo = self.tipo_expr(expr)
        if tipo is not None and tipo not in (LOGICO, QUALQUER):
            self.erro(linha, f"a condição do '{comando}' deve ser do tipo lógico, mas é {tipo}.")

    def cmd_se(self, c):
        self.condicao(c.condicao, "se", c.linha)
        self.comandos(c.entao)
        self.comandos(c.senao)

    def cmd_enquanto(self, c):
        self.condicao(c.condicao, "enquanto", c.linha)
        self.comandos(c.corpo)

    def cmd_para(self, c):
        if c.var is not None:
            tipo = self.tipo_variavel(c.var)
            if tipo is not None and tipo != INTEIRO:
                self.erro(c.linha, f"a variável de controle do 'para' deve ser inteiro, "
                                   f"mas {c.var.nome} é {tipo}.")
        for parte, expr in (("valor inicial", c.inicio), ("valor final", c.fim), ("passo", c.passo)):
            tipo = self.tipo_expr(expr)
            if tipo is not None and tipo not in (INTEIRO, QUALQUER):
                self.erro(c.linha, f"o {parte} do 'para' deve ser inteiro, mas é {tipo}.")
        if valor_constante(c.passo) == 0:
            self.erro(c.linha, "o passo do 'para' não pode ser 0 (o laço nunca terminaria).")
        self.comandos(c.corpo)

    def cmd_retorne(self, c):
        f = self.funcao_atual
        if f is None:                     # no bloco principal o 'retorne' só encerra o programa
            self.tipo_expr(c.valor)
            return
        self.teve_retorno = True
        if f.retorno is None:
            if c.valor is not None:
                self.tipo_expr(c.valor)
                self.erro(c.linha, f"a função {f.nome} não tem tipo de retorno, então o 'retorne' não pode devolver valor.")
        elif c.valor is None:
            self.erro(c.linha, f"a função {f.nome} deve retornar um valor do tipo {f.retorno}.")
        else:
            tipo = self.tipo_expr(c.valor)
            if not compativel(f.retorno, tipo):                  # REQUISITO 4
                self.erro(c.linha, f"retorno incompatível. A função {f.nome} retorna {f.retorno}, "
                                   f"mas recebeu {tipo}.")

    def cmd_chamada_cmd(self, c):
        self.tipo_chamada(c.chamada, como_comando=True)

    # -------------------------------------------------------- expressões ----

    def tipo_expr(self, e):
        """Descobre o tipo de uma expressão (ou None se não der para saber por causa de outro erro)."""
        if e is None:
            return None
        if e.tipo == "valor":
            return e.tipo_valor
        if e.tipo == "variavel":
            return self.tipo_variavel(e)
        if e.tipo == "chamada":
            return self.tipo_chamada(e, como_comando=False)
        if e.tipo == "unaria":
            return self.tipo_unaria(e)
        return self.tipo_binaria(e)

    def tipo_variavel(self, v):
        simbolo = self.buscar(v.nome)
        if simbolo is None:
            for indice in v.indices:
                self.tipo_expr(indice)
            if v.nome in self.funcoes:
                self.erro(v.linha, f"{v.nome} é uma função; para chamá-la use {v.nome}(...).")
            else:
                self.erro(v.linha, f"variável {v.nome} não declarada.")       # REQUISITO 2
            return None

        simbolo.usado = True
        tipo = simbolo.tipo
        if not v.indices:
            return tipo

        if not tipo.dims:
            for indice in v.indices:
                self.tipo_expr(indice)
            self.erro(v.linha, f"{v.nome} não é uma matriz, então não pode ter índice.")
            return None
        if len(v.indices) != len(tipo.dims):
            self.erro(v.linha, f"a matriz {v.nome} tem {len(tipo.dims)} dimensão(ões), "
                               f"mas foi usada com {len(v.indices)} índice(s).")
        for indice, tamanho in zip(v.indices, tipo.dims):
            tipo_indice = self.tipo_expr(indice)
            if tipo_indice is not None and tipo_indice not in (INTEIRO, QUALQUER):
                self.erro(v.linha, f"o índice de {v.nome} deve ser inteiro, mas é {tipo_indice}.")
            k = valor_constante(indice)
            if k is not None and not 0 <= k < tamanho:
                self.erro(v.linha, f"índice {k} fora dos limites da matriz {v.nome} (de 0 a {tamanho - 1}).")
        return Tipo(tipo.base)                                   # o tipo de um elemento

    def tipo_chamada(self, c, como_comando):
        tipos_args = [self.tipo_expr(a) for a in c.args]

        if c.nome == "imprima":
            for tipo in tipos_args:
                if tipo is not None and tipo.dims:
                    self.erro(c.linha, "imprima não consegue mostrar uma matriz inteira; use um índice.")
            if not como_comando:
                self.erro(c.linha, "imprima não devolve valor e não pode ser usada em expressão.")
            return None
        if c.nome == "leia":
            if c.args:
                self.erro(c.linha, f"leia não recebe argumentos, mas recebeu {len(c.args)}.")
            return QUALQUER

        f = self.funcoes.get(c.nome)
        if f is None:
            if self.buscar(c.nome):
                self.erro(c.linha, f"{c.nome} é uma variável, não uma função.")
            else:
                self.erro(c.linha, f"função {c.nome} não declarada.")         # REQUISITO 2
            return None

        f.simbolo.usado = True
        if len(c.args) != len(f.params):
            self.erro(c.linha, f"a função {f.nome} espera {len(f.params)} argumento(s), "
                               f"mas recebeu {len(c.args)}.")
        else:
            for i, ((nome, tipo_param, _), tipo_arg) in enumerate(zip(f.params, tipos_args), start=1):
                if not compativel(tipo_param, tipo_arg):                     # REQUISITO 4
                    self.erro(c.linha, f"argumento {i} de {f.nome} incompatível. O parâmetro {nome} "
                                       f"é do tipo {tipo_param}, mas recebeu {tipo_arg}.")
        if not como_comando and f.retorno is None:
            self.erro(c.linha, f"a função {f.nome} não devolve valor e não pode ser usada em expressão.")
        return f.retorno

    def tipo_unaria(self, e):
        tipo = self.tipo_expr(e.expr)
        if tipo == QUALQUER or tipo is None:
            return {"nao": LOGICO, "~": INTEIRO}.get(e.op, tipo)
        if e.op in ("-", "+") and tipo in NUMERICOS:
            return tipo
        if e.op == "nao" and tipo == LOGICO:
            return LOGICO
        if e.op == "~" and tipo == INTEIRO:
            return INTEIRO
        simbolo = "não" if e.op == "nao" else e.op
        self.erro(e.linha, f"operador '{simbolo}' não pode ser aplicado a {tipo}.")
        return None

    def tipo_binaria(self, e):
        a, b = self.tipo_expr(e.esq), self.tipo_expr(e.dir)
        op = e.op
        resultado_logico = op in ("ou", "e", "=", "<>", "<", "<=", ">", ">=")

        if a is None or b is None:                 # erro já apontado em uma das partes
            return LOGICO if resultado_logico else None
        if a == QUALQUER:                          # leia() assume o tipo do outro lado
            a = b
        if b == QUALQUER:
            b = a
        if a == QUALQUER:
            return LOGICO if resultado_logico else QUALQUER
        if a.dims or b.dims:
            self.erro(e.linha, f"não é possível usar uma matriz inteira com o operador '{op}'; use um índice.")
            return LOGICO if resultado_logico else None

        if op in ("+", "-", "*", "/", "%"):
            if op == "%":
                ok = a == b == INTEIRO
            else:
                ok = a in NUMERICOS and b in NUMERICOS
            if not ok:
                exige = "inteiros" if op == "%" else "números (inteiro ou real)"
                self.erro(e.linha, f"operador '{op}' só funciona com {exige}, mas recebeu {a} e {b}.")
                return None
            if op in ("/", "%") and valor_constante(e.dir) == 0:
                self.erro(e.linha, "divisão por zero.")
            return REAL if REAL in (a, b) else INTEIRO

        if op in ("&", "|", "^"):
            if a == b == INTEIRO:
                return INTEIRO
            self.erro(e.linha, f"operador '{op}' só funciona com inteiros, mas recebeu {a} e {b}.")
            return None

        if op in ("<", "<=", ">", ">="):
            if not ((a in NUMERICOS and b in NUMERICOS) or (a == b and a in (CARACTERE, LITERAL))):
                self.erro(e.linha, f"não é possível comparar {a} com {b} usando '{op}'.")
            return LOGICO

        if op in ("=", "<>"):
            if not (a == b or (a in NUMERICOS and b in NUMERICOS)):
                self.erro(e.linha, f"não é possível comparar {a} com {b} usando '{op}'.")
            return LOGICO

        # 'e' / 'ou'
        if a != LOGICO or b != LOGICO:
            self.erro(e.linha, f"operador '{op}' precisa de valores lógicos, mas recebeu {a} e {b}.")
        return LOGICO
