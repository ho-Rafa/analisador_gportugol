"""
FASE 1 - ANÁLISE LÉXICA

Transforma o texto do programa G-Portugol em uma lista de tokens.
Cada token guarda o tipo, o texto e a linha onde apareceu.

Exemplo:   idade := 25;
Tokens:    id(idade)  simbolo(:=)  inteiro(25)  simbolo(;)
"""
import re
import unicodedata
from dataclasses import dataclass


@dataclass
class Token:
    tipo: str    # 'palavra', 'id', 'inteiro', 'real', 'literal', 'caractere', 'simbolo' ou 'fim'
    valor: str   # texto normalizado (palavras-chave ficam sem acento: "início" -> "inicio")
    texto: str   # texto como o aluno escreveu (usado nas mensagens)
    linha: int


def sem_acento(texto):
    """'início' -> 'inicio'. O G-Portugol aceita palavras-chave com ou sem acento."""
    return "".join(c for c in unicodedata.normalize("NFD", texto)
                   if unicodedata.category(c) != "Mn")


PALAVRAS_CHAVE = {
    "algoritmo", "variaveis", "fim-variaveis", "inicio", "fim",
    "inteiro", "real", "caractere", "literal", "logico",
    "inteiros", "reais", "caracteres", "literais", "logicos", "matriz", "de",
    "verdadeiro", "falso", "e", "ou", "nao",
    "se", "entao", "senao", "fim-se",
    "enquanto", "faca", "fim-enquanto",
    "para", "ate", "passo", "fim-para",
    "funcao", "retorne",
}

# Cada grupo nomeado é um tipo de token. A ordem importa: o primeiro que casar vence.
REGRAS = re.compile(r"""
    (?P<espaco>            [ \t\r\f]+ )
  | (?P<nova_linha>        \n )
  | (?P<comentario>        //[^\n]* | /\*.*?\*/ )
  | (?P<comentario_aberto> /\* )
  | (?P<real>              \d+\.\d+ )
  | (?P<inteiro>           0[xX][0-9a-fA-F]+ | 0[bB][01]+ | 0[cC][0-7]+ | \d+ )
  | (?P<literal>           "(?:\\.|[^"\\\n])*" )
  | (?P<literal_aberto>    "[^\n;]* )
  | (?P<caractere>         '(?:\\.|[^'\\\n])' )
  | (?P<fim_de_bloco>      fim-(?:vari[áa]veis|se|enquanto|para)(?!\w) )
  | (?P<palavra>           [^\W\d]\w* )
  | (?P<simbolo>           :=|<>|<=|>=|[-+*/%=<>(),;:\[\]&|^~] )
  | (?P<invalido>          . )
""", re.VERBOSE | re.DOTALL)


def valor_inteiro(texto):
    """Converte '42', '0x2A', '0b101' ou '0c17' (octal do G-Portugol) em número."""
    prefixo = texto[:2].lower()
    if prefixo == "0x":
        return int(texto[2:], 16)
    if prefixo == "0b":
        return int(texto[2:], 2)
    if prefixo == "0c":
        return int(texto[2:], 8)
    return int(texto)


def tokenizar(codigo):
    """Devolve (tokens, erros). Cada erro é (linha, 'léxico', mensagem)."""
    tokens, erros = [], []
    linha = 1

    for m in REGRAS.finditer(codigo):
        tipo, texto = m.lastgroup, m.group()

        if tipo == "palavra":
            normal = sem_acento(texto)
            if normal in PALAVRAS_CHAVE:
                tokens.append(Token("palavra", normal, texto, linha))
            elif normal != texto:
                erros.append((linha, "léxico",
                              f"nome inválido '{texto}' (nomes de variáveis não podem ter acento)."))
            else:
                tokens.append(Token("id", texto, texto, linha))
        elif tipo == "fim_de_bloco":
            tokens.append(Token("palavra", sem_acento(texto), texto, linha))
        elif tipo in ("inteiro", "real", "literal", "caractere", "simbolo"):
            tokens.append(Token(tipo, texto, texto, linha))
        elif tipo == "literal_aberto":
            erros.append((linha, "léxico", "texto sem aspas de fechamento."))
            tokens.append(Token("literal", texto + '"', texto, linha))   # segue como se estivesse fechado
        elif tipo == "comentario_aberto":
            erros.append((linha, "léxico", "comentário '/*' sem '*/' de fechamento."))
            break                                   # o resto do arquivo virou comentário
        elif tipo == "invalido":
            erros.append((linha, "léxico", f"símbolo inválido '{texto}'."))

        linha += texto.count("\n")                  # espaços, comentários e quebras de linha

    tokens.append(Token("fim", "<fim>", "fim do arquivo", linha))
    return tokens, erros
