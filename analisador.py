"""
Mini Analisador Semântico para G-Portugol

    python analisador.py programas/cadastro.gpt   -> analisa um arquivo
    python analisador.py                          -> analisa o exemplo do enunciado
    python interface.py                           -> abre o editor "Castelo Semântico"

Fases:  lexico.py (tokens)  ->  sintatico.py (árvore)  ->  semantico.py (verificações)
"""
import sys

from lexico import tokenizar
from semantico import AnalisadorSemantico
from sintatico import Parser

PREFIXO = {"léxico": "ERRO LÉXICO", "sintático": "ERRO SINTÁTICO",
           "semântico": "ERRO", "aviso": "AVISO"}


def plural(n, singular, plural_):
    return f"{n} {singular if n == 1 else plural_}"


def frase_final(por_fase, total_avisos):
    """REQUISITO 5 - resumo no mesmo formato da versão anterior."""
    total = sum(por_fase.values())
    avisos = f" e {plural(total_avisos, 'aviso', 'avisos')}" if total_avisos else ""
    if total == 0:
        avisos = f", com {plural(total_avisos, 'aviso', 'avisos')}" if total_avisos else ""
        return f"Resultado final: código semanticamente válido{avisos}."
    if total == por_fase["semântico"]:
        return f"Resultado final: {plural(total, 'erro semântico encontrado', 'erros semânticos encontrados')}{avisos}."
    partes = [plural(por_fase[fase], fase, nome) for fase, nome in
              (("semântico", "semânticos"), ("sintático", "sintáticos"), ("léxico", "léxicos"))
              if por_fase[fase]]
    return f"Resultado final: {plural(total, 'erro encontrado', 'erros encontrados')} ({', '.join(partes)}){avisos}."


def analisar(codigo):
    """Roda as três fases e devolve tudo num dicionário (a interface usa este formato)."""
    tokens, erros_lexicos = tokenizar(codigo)
    parser = Parser(tokens)
    programa = parser.programa()
    semantico = AnalisadorSemantico()
    semantico.analisar(programa)

    # Junta os erros das três fases, sem repetir mensagens iguais na mesma linha.
    # Se a linha já tem erro léxico, o erro sintático dela costuma ser só consequência
    # (erro em cascata), então ele não é mostrado.
    linhas_lexicas = {linha for linha, _, _ in erros_lexicos}
    erros_por_linha = {}
    for linha, fase, texto in erros_lexicos + parser.erros + semantico.erros:
        if fase == "sintático" and linha in linhas_lexicas:
            continue
        lista = erros_por_linha.setdefault(linha, [])
        if (fase, texto) not in lista:
            lista.append((fase, texto))

    # Linhas que têm código (linhas em branco e só com comentário são puladas).
    linhas = sorted({t.linha for t in tokens if t.tipo != "fim"} | set(erros_por_linha))

    mensagens = []
    inicio = fim = None                     # trecho atual de linhas válidas

    def fechar_trecho():
        nonlocal inicio, fim
        if inicio is not None:
            texto = (f"Linha {inicio}: instrução semanticamente válida." if inicio == fim else
                     f"Linhas {inicio} a {fim}: instruções semanticamente válidas.")
            mensagens.append({"tipo": "ok", "linha": inicio, "linha_fim": fim, "texto": texto})
        inicio = fim = None

    for n in linhas:
        if n in erros_por_linha:
            fechar_trecho()
            for fase, texto in erros_por_linha[n]:
                mensagens.append({"tipo": "erro", "fase": fase, "linha": n, "linha_fim": n,
                                  "texto": f"Linha {n}: {PREFIXO[fase]} - {texto}"})
        else:
            if inicio is None:
                inicio = n
            fim = n
    fechar_trecho()

    avisos = sorted(set(semantico.avisos))
    for linha, fase, texto in avisos:
        mensagens.append({"tipo": "aviso", "fase": fase, "linha": linha, "linha_fim": linha,
                          "texto": f"Linha {linha}: {PREFIXO[fase]} - {texto}"})

    por_fase = {"semântico": 0, "sintático": 0, "léxico": 0}
    for lista in erros_por_linha.values():
        for fase, _ in lista:
            por_fase[fase] += 1

    return {
        "programa": programa.nome,
        "mensagens": mensagens,
        "resultado": frase_final(por_fase, len(avisos)),
        "erros": sum(por_fase.values()),
        "por_fase": por_fase,
        "avisos": len(avisos),
        "simbolos": [{"nome": s.nome, "categoria": s.categoria, "tipo": str(s.tipo),
                      "base": getattr(s.tipo, "base", "função"),
                      "matriz": bool(getattr(s.tipo, "dims", ())),
                      "escopo": s.escopo, "linha": s.linha, "usado": s.usado}
                     for s in semantico.simbolos],
    }


def ler_arquivo(caminho):
    with open(caminho, "rb") as f:
        bruto = f.read()
    try:
        return bruto.decode("utf-8-sig")
    except UnicodeDecodeError:              # arquivos salvos em ANSI/Latin-1 no Windows
        return bruto.decode("latin-1")


EXEMPLO = """algoritmo cadastro;

variáveis
    idade: inteiro;
    salario: real;
    nome: literal;
    idade: inteiro;
fim-variáveis

início
    idade := 25;
    salario := 3500.50;
    nome := "Carlos";
    idade := "vinte";
    cidade := "Caceres";
fim"""


if __name__ == "__main__":
    codigo = ler_arquivo(sys.argv[1]) if len(sys.argv) > 1 else EXEMPLO
    resultado = analisar(codigo)
    for mensagem in resultado["mensagens"]:
        print(mensagem["texto"])
    print(resultado["resultado"])
