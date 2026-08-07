"""Funções de apoio do template inicial."""

from datetime import datetime, timezone
from pathlib import Path


def saudacao(nome: str) -> str:
    return f"Buenas, {nome}! O workspace Python tá vivo."


def registrar_log(mensagem: str, arquivo: str = "log.txt") -> None:
    momento = datetime.now(timezone.utc).isoformat()
    with Path(arquivo).open("a", encoding="utf-8") as saida:
        saida.write(f"[{momento}] {mensagem}\n")
