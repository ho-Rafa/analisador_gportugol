"""
Interface "Castelo Semântico" - editor de G-Portugol com cara de jogo de plataforma.

    python interface.py

Sobe um servidor local (só no seu computador) e abre o editor no navegador.
Os programas ficam na pasta 'programas/'. Para encerrar, aperte Ctrl+C no terminal.
"""
import json
import re
import sys
import threading
import traceback
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from analisador import analisar, ler_arquivo

PASTA = Path(__file__).resolve().parent
WEB = PASTA / "web"
PROGRAMAS = PASTA / "programas"
NOME_VALIDO = re.compile(r"^[\w\- ]{1,60}\.gpt$")
TIPOS = {".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
         ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".ico": "image/x-icon"}


def arquivo_programa(nome):
    """Só aceita nomes simples terminando em .gpt (nada de '../')."""
    return PROGRAMAS / nome if NOME_VALIDO.match(nome or "") else None


class Servidor(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass                                            # não polui o terminal

    def responder(self, status, corpo, tipo="application/json; charset=utf-8"):
        if isinstance(corpo, (dict, list)):
            corpo = json.dumps(corpo, ensure_ascii=False)
        if isinstance(corpo, str):
            corpo = corpo.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(corpo)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(corpo)

    def do_GET(self):
        url = urlparse(self.path)

        if url.path == "/api/programas":
            return self.responder(200, sorted(p.name for p in PROGRAMAS.glob("*.gpt")))

        if url.path == "/api/programa":
            nome = parse_qs(url.query).get("nome", [""])[0]
            arquivo = arquivo_programa(nome)
            if not arquivo or not arquivo.is_file():
                return self.responder(404, {"erro": f"programa '{nome}' não encontrado"})
            return self.responder(200, {"nome": nome, "codigo": ler_arquivo(arquivo)})

        caminho = "index.html" if url.path == "/" else url.path.lstrip("/")
        arquivo = (WEB / caminho).resolve()
        if WEB not in arquivo.parents or not arquivo.is_file():
            return self.responder(404, "não encontrado", "text/plain; charset=utf-8")
        self.responder(200, arquivo.read_bytes(), TIPOS.get(arquivo.suffix, "application/octet-stream"))

    def do_POST(self):
        try:
            tamanho = int(self.headers.get("Content-Length", 0))
            dados = json.loads(self.rfile.read(tamanho) or b"{}")
        except (ValueError, json.JSONDecodeError):
            return self.responder(400, {"erro": "pedido inválido"})

        if self.path == "/api/analisar":
            try:
                return self.responder(200, analisar(dados.get("codigo", "")))
            except Exception:                           # mostra o erro do Python na tela, sem derrubar o servidor
                return self.responder(500, {"erro": traceback.format_exc()})

        if self.path == "/api/salvar":
            arquivo = arquivo_programa(dados.get("nome", ""))
            if not arquivo:
                return self.responder(400, {"erro": "nome inválido: use letras, números, _ ou - e termine com .gpt"})
            PROGRAMAS.mkdir(exist_ok=True)
            arquivo.write_text(dados.get("codigo", ""), encoding="utf-8", newline="\n")
            return self.responder(200, {"ok": True, "nome": arquivo.name})

        self.responder(404, {"erro": "rota desconhecida"})


def main():
    PROGRAMAS.mkdir(exist_ok=True)
    servidor = None
    for porta in range(8765, 8785):                     # se a porta estiver ocupada, tenta a próxima
        try:
            servidor = ThreadingHTTPServer(("127.0.0.1", porta), Servidor)
            break
        except OSError:
            continue
    if servidor is None:
        sys.exit("Não encontrei nenhuma porta livre entre 8765 e 8784.")

    endereco = f"http://127.0.0.1:{servidor.server_port}/"
    print(f"Castelo Semântico aberto em {endereco}")
    print("Aperte Ctrl+C para fechar.")
    if "--sem-navegador" not in sys.argv:
        threading.Timer(0.6, webbrowser.open, args=[endereco]).start()
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\nCastelo fechado. Até a próxima!")
    finally:
        servidor.server_close()


if __name__ == "__main__":
    main()
