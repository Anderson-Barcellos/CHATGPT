"""
================================================================================
OPENAI/files.py — Gerenciamento de Arquivos no Servidor da OpenAI
================================================================================
Serviço: client.files.create() | .list() | .retrieve() | .delete() | .content()

Para que serve o File Storage da OpenAI?
  O objetivo é enviar arquivos UMA VEZ e reutilizar o file_id em múltiplas
  chamadas, em vez de reenviar o conteúdo a cada requisição.

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  PURPOSE (propósito) — OBRIGATÓRIO ao fazer upload                      │
  │                                                                          │
  │  "assistants"      → Arquivos para a Assistants API (knowledge base)    │
  │  "fine-tune"       → Datasets para fine-tuning (JSONL)                  │
  │  "batch"           → Inputs para Batch API (JSONL)                      │
  │  "vision"          → Imagens para chamadas Vision (apenas gpt-image-1)  │
  │  "user_data"       → Dados gerais enviados pelo usuário                  │
  │  "evals"           → Dados para avaliação de modelos                    │
  └──────────────────────────────────────────────────────────────────────────┘

Funções deste módulo:
  - upload()            →  Faz upload de arquivo e retorna o file_id
  - upload_bytes()      →  Upload de bytes em memória (sem arquivo físico)
  - listar()            →  Lista todos os arquivos em conta (com filtros)
  - info()              →  Retorna metadados de um arquivo específico
  - baixar()            →  Baixa o conteúdo de um arquivo do servidor
  - deletar()           →  Exclui um arquivo do servidor
  - deletar_varios()    →  Exclui múltiplos arquivos em sequência

Todas as funções usam APENAS tipos primitivos como parâmetros:
  str, int, bool, bytes, Path, Literal
================================================================================
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Literal

from openai import OpenAI


# ─────────────────────────────────────────────────────────────────────────────
# UPLOAD
# ─────────────────────────────────────────────────────────────────────────────

def upload(
    client: OpenAI,
    arquivo: str | Path,
    purpose: Literal["assistants", "fine-tune", "batch", "vision", "user_data", "evals"],
) -> dict[str, Any]:
    """
    Faz upload de um arquivo do disco para o servidor da OpenAI.

    `purpose` é semântico e obrigatório: ele define em que produtos a API pode
    reutilizar o arquivo. O retorno reduz o objeto da SDK a metadados estáveis;
    guarde apenas o `id` quando precisar referenciá-lo depois. Upload não anexa
    automaticamente o arquivo a uma conversa, vector store ou fine-tuning.

    Args:
        client   : Instância de OpenAI()
        arquivo  : Caminho do arquivo a enviar.
                   Formatos aceitos dependem do purpose:
                     "fine-tune"  → apenas .jsonl
                     "assistants" → pdf, txt, md, docx, json, csv, etc.
                     "batch"      → apenas .jsonl
                     "vision"     → png, jpg, webp, gif
                     "evals"      → .jsonl
                     "user_data"  → qualquer formato
                   Limite: 512 MB por arquivo
        purpose  : Propósito do arquivo (define como a API vai usá-lo)

    Returns:
        dict com campos:
          - "id"         : str  — O file_id ("file-abc123...") para uso futuro
          - "filename"   : str  — Nome original do arquivo
          - "bytes"      : int  — Tamanho em bytes
          - "purpose"    : str  — Propósito enviado
          - "status"     : str  — "uploaded", "processed", "error"
          - "created_at" : int  — Timestamp Unix da criação

    Example:
        ```python
        # Upload de dataset para fine-tuning
        info = upload(client, "DataSet/evals/eval_dataset.jsonl", "fine-tune")
        print(info["id"])  # "file-a1b2c3..."
        # Upload de PDF para Assistants API
        info = upload(client, "Docs/manual_ultrassom.pdf", "assistants")
        file_id = info["id"]  # Usar em vector_store ou assistant
        ```
    """
    arquivo = Path(arquivo)
    with open(arquivo, "rb") as f:
        res = client.files.create(file=f, purpose=purpose)

    return {
        "id":         res.id,
        "filename":   res.filename,
        "bytes":      res.bytes,
        "purpose":    res.purpose,
        "status":     getattr(res, "status", "uploaded"),
        "created_at": res.created_at,
    }


def upload_bytes(
    client: OpenAI,
    conteudo: bytes,
    nome_arquivo: str,
    purpose: Literal["assistants", "fine-tune", "batch", "vision", "user_data", "evals"],
) -> dict[str, Any]:
    """
    Faz upload de conteúdo em memória (bytes) sem precisar de arquivo físico no disco.
    Útil para conteúdo gerado dinamicamente (PDFs, JSONLs, imagens processadas).

    `nome_arquivo` é material: a extensão comunica o formato do conteúdo à API,
    embora nenhum arquivo local seja criado. Use este helper para artefatos que
    já estão em memória; `upload()` é preferível para preservar streaming de
    disco e evitar uma cópia adicional de arquivos grandes.

    Args:
        client       : Instância de OpenAI()
        conteudo     : Bytes do arquivo a enviar
        nome_arquivo : Nome fictício do arquivo (ex: "laudo.pdf", "dataset.jsonl").
                       A extensão informa a API sobre o formato.
        purpose      : Propósito do arquivo (ver upload())

    Returns:
        dict: Mesmos campos que upload() — inclui "id" (file_id)

    Example:
        >>> import json
        >>>
        >>> # Gerar JSONL dinamicamente e enviar
        >>> linhas = [
        ...     json.dumps({"input": "laudo 1", "output": "achado 1"}),
        ...     json.dumps({"input": "laudo 2", "output": "achado 2"}),
        ... ]
        >>> conteudo = "\n".join(linhas).encode("utf-8")
        >>> info = upload_bytes(client, conteudo, "eval_batch.jsonl", "evals")
        >>> print(info["id"])
    """
    res = client.files.create(
        file=(nome_arquivo, conteudo),
        purpose=purpose,
    )
    return {
        "id":         res.id,
        "filename":   res.filename,
        "bytes":      res.bytes,
        "purpose":    res.purpose,
        "status":     getattr(res, "status", "uploaded"),
        "created_at": res.created_at,
    }


# ─────────────────────────────────────────────────────────────────────────────
# LISTAGEM E BUSCA
# ─────────────────────────────────────────────────────────────────────────────

def listar(
    client: OpenAI,
    *,
    purpose: Literal["assistants", "fine-tune", "batch", "vision", "user_data", "evals"] | None = None,
    limite: int = 20,
    ordem: Literal["asc", "desc"] = "desc",
) -> list[dict[str, Any]]:
    """
    Lista os arquivos armazenados na conta OpenAI.

    `limite` controla somente esta página retornada pela API; o helper não
    pagina automaticamente o acervo inteiro. `ordem` se aplica à criação do
    arquivo, e `purpose` é o filtro mais seguro quando uma conta contém
    artefatos de produtos diferentes.

    Args:
        client  : Instância de OpenAI()
        purpose : Filtrar por propósito específico. None = todos.
        limite  : Número máximo de arquivos a retornar (1 a 10000)
        ordem   : "desc" = mais recentes primeiro, "asc" = mais antigos primeiro

    Returns:
        list[dict]: Lista de arquivos, cada um com:
          - "id"         : str  — file_id
          - "filename"   : str  — nome do arquivo
          - "bytes"      : int  — tamanho em bytes
          - "purpose"    : str  — propósito
          - "status"     : str  — "processed", "uploaded", "error"
          - "created_at" : int  — timestamp Unix

    Example:
        >>> # Listar todos os arquivos de fine-tuning
        >>> arquivos = listar(client, purpose="fine-tune")
        >>> for arq in arquivos:
        ...     print(f"{arq['id']}: {arq['filename']} ({arq['bytes']} bytes)")
        >>>
        >>> # Ver os 5 mais recentes
        >>> recentes = listar(client, limite=5)
    """
    kwargs: dict[str, Any] = {"limit": limite, "order": ordem}
    if purpose is not None:
        kwargs["purpose"] = purpose

    res = client.files.list(**kwargs)
    return [
        {
            "id":         arq.id,
            "filename":   arq.filename,
            "bytes":      arq.bytes,
            "purpose":    arq.purpose,
            "status":     getattr(arq, "status", "processed"),
            "created_at": arq.created_at,
        }
        for arq in res.data
    ]


def info(
    client: OpenAI,
    file_id: str,
) -> dict[str, Any]:
    """
    Retorna os metadados de um arquivo específico pelo seu ID.

    Esta operação não baixa conteúdo e é uma boa checagem antes de associar o
    `file_id` a outro recurso. `status` informa o estado processado pela API,
    mas o significado prático varia conforme o `purpose` do arquivo.

    Args:
        client  : Instância de OpenAI()
        file_id : ID do arquivo (ex: "file-a1b2c3...")

    Returns:
        dict: Metadados do arquivo (id, filename, bytes, purpose, status, created_at)

    Example:
        >>> metadados = info(client, "file-a1b2c3...")
        >>> print(f"{metadados['filename']}: {metadados['status']}")
    """
    res = client.files.retrieve(file_id)
    return {
        "id":         res.id,
        "filename":   res.filename,
        "bytes":      res.bytes,
        "purpose":    res.purpose,
        "status":     getattr(res, "status", "processed"),
        "created_at": res.created_at,
    }


# ─────────────────────────────────────────────────────────────────────────────
# DOWNLOAD E DELEÇÃO
# ─────────────────────────────────────────────────────────────────────────────

def baixar(
    client: OpenAI,
    file_id: str,
    destino: str | Path | None = None,
) -> bytes:
    """
    Baixa o conteúdo de um arquivo do servidor OpenAI.

    Sem `destino`, os bytes ficam apenas em memória e o chamador decide como
    processá-los. Com `destino`, o helper grava uma cópia local e cria os
    diretórios pai; ele não deduz extensão nem transforma o conteúdo retornado.

    Args:
        client  : Instância de OpenAI()
        file_id : ID do arquivo a baixar
        destino : Caminho opcional para salvar o arquivo no disco.
                  Se None, retorna apenas os bytes sem salvar.

    Returns:
        bytes: Conteúdo binário do arquivo

    Example:
        >>> # Baixar e salvar no disco
        >>> conteudo = baixar(client, "file-abc123", "DataSet/backup_eval.jsonl")
        >>>
        >>> # Baixar em memória e processar
        >>> conteudo = baixar(client, "file-abc123")
        >>> texto = conteudo.decode("utf-8")
    """
    res = client.files.content(file_id)
    conteudo = res.content

    if destino is not None:
        destino = Path(destino)
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_bytes(conteudo)

    return conteudo


def deletar(
    client: OpenAI,
    file_id: str,
) -> bool:
    """
    Exclui um arquivo do servidor OpenAI.
    ATENÇÃO: Esta operação é irreversível!

    Confirme o `file_id` com `info()` antes de chamar esta função. A exclusão
    afeta o objeto armazenado na OpenAI e pode invalidar fluxos que ainda o
    referenciem; o booleano retornado apenas reflete a confirmação da API.

    Args:
        client  : Instância de OpenAI()
        file_id : ID do arquivo a excluir

    Returns:
        bool: True se excluído com sucesso, False se não encontrado

    Example:
        >>> sucesso = deletar(client, "file-abc123")
        >>> print("Excluído!" if sucesso else "Arquivo não encontrado.")
    """
    res = client.files.delete(file_id)
    return getattr(res, "deleted", False)


def deletar_varios(
    client: OpenAI,
    file_ids: list[str],
) -> dict[str, bool]:
    """
    Exclui múltiplos arquivos em sequência.

    Não há transação: cada ID é removido independentemente e o dicionário de
    retorno permite auditar sucessos e falhas. Para uma limpeza segura, liste,
    filtre e revise os IDs antes de passar a coleção a esta função.

    Args:
        client   : Instância de OpenAI()
        file_ids : Lista de IDs de arquivos a excluir

    Returns:
        dict[str, bool]: {file_id: True/False} para cada arquivo

    Example:
        >>> # Limpar arquivos de fine-tuning antigos
        >>> antigos = [arq["id"] for arq in listar(client, purpose="fine-tune")]
        >>> resultados = deletar_varios(client, antigos)
        >>> for file_id, ok in resultados.items():
        ...     print(f"{file_id}: {'✅ deletado' if ok else '❌ falhou'}")
    """
    return {fid: deletar(client, fid) for fid in file_ids}
