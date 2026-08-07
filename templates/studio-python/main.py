"""Projeto inicial do Gaucho Studio Python.

Demonstra o fluxo típico do workspace: import local, escrita de log
e leitura de variável de ambiente. Rode este arquivo pelo botão Run.
"""

import os

from utils.helpers import registrar_log, saudacao


def main() -> None:
    print(saudacao("Anders"))
    registrar_log("Execução iniciada.")

    if os.environ.get("OPENAI_API_KEY"):
        print("OPENAI_API_KEY disponível no ambiente do run.")
    else:
        print("OPENAI_API_KEY ausente — confira o env do serviço.")

    registrar_log("Execução concluída.")
    print("Log gravado em log.txt — confira na árvore de arquivos.")


if __name__ == "__main__":
    main()
