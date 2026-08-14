"""
================================================================================
OPENAI — Pacote de wrappers simplificados da SDK OpenAI para o Vertex V2
================================================================================

Submódulos disponíveis e suas responsabilidades:

  chat.py        →  Chat Completions (texto, visão, streaming, JSON, Pydantic)
                    + nova Responses API (stateful, multi-turno)

  audio.py       →  STT: Transcrição de áudio via Whisper
                    TTS: Síntese de voz (Text-To-Speech)

  embeddings.py  →  Vetores de texto para busca semântica e RAG

  tools.py       →  Function Calling: schemas Pydantic → tool dicts,
                    execução automática de funções, multi-turno de tools

  images.py      →  Geração e edição de imagens (DALL-E 3 / gpt-image-1)

  files.py       →  Gerenciamento de arquivos no servidor OpenAI

--------------------------------------------------------------------------------
Importação rápida:
  from OPENAI.chat       import chat, chat_vision, parse_pydantic, response
  from OPENAI.audio      import transcrever, falar, falar_para_arquivo
  from OPENAI.embeddings import embedar, buscar_mais_similar
  from OPENAI.tools      import schema_de_pydantic, chamar_com_tools
  from OPENAI.images     import gerar_para_arquivo
  from OPENAI.files      import upload, listar, deletar

Ou importar tudo de uma vez (não recomendado para projetos grandes):
  from OPENAI import *

Filosofia dos wrappers:
  Cada função expõe o caminho comum com tipos Python simples e preserva a
  operação principal da SDK. Quando o caso exigir controles avançados — tools,
  reasoning, eventos de streaming, paginação, metadados ou opções específicas
  de modelo — a docstring indica o ponto da SDK oficial a usar diretamente.
  Os wrappers não são uma camada de segurança: validação de autorização,
  persistência local, moderação e efeitos irreversíveis continuam pertencendo
  à aplicação chamadora.
================================================================================
"""

# ── chat ──────────────────────────────────────────────────────────────────────
from .chat import (
    chat,
    chat_vision,
    chat_stream,
    chat_json,
    parse_pydantic,
    response,
    response_pydantic,
    response_stream,
)

# ── audio ─────────────────────────────────────────────────────────────────────
from .audio import (
    transcrever,
    transcrever_bytes,
    transcrever_detalhado,
    falar,
    falar_para_arquivo,
    vozes_disponiveis,
)

# ── embeddings ────────────────────────────────────────────────────────────────
from .embeddings import (
    embedar,
    embedar_varios,
    similaridade_cosseno,
    buscar_mais_similar,
    similaridades_todas,
)

# ── tools (function calling) ──────────────────────────────────────────────────
from .tools import (
    schema_de_pydantic,
    schemas_de_varios,
    extrair_chamadas,
    chamar_com_tools,
    responder_com_resultado,
)

# ── images ────────────────────────────────────────────────────────────────────
from .images import (
    gerar_url,
    gerar_bytes,
    gerar_para_arquivo,
    editar_imagem,
)

# ── files ─────────────────────────────────────────────────────────────────────
from .files import (
    upload,
    upload_bytes,
    listar,
    info,
    baixar,
    deletar,
    deletar_varios,
)

__all__ = [
    # chat
    "chat", "chat_vision", "chat_stream", "chat_json", "parse_pydantic",
    "response", "response_pydantic", "response_stream",
    # audio
    "transcrever", "transcrever_bytes", "transcrever_detalhado",
    "falar", "falar_para_arquivo", "vozes_disponiveis",
    # embeddings
    "embedar", "embedar_varios", "similaridade_cosseno",
    "buscar_mais_similar", "similaridades_todas",
    # tools
    "schema_de_pydantic", "schemas_de_varios", "extrair_chamadas",
    "chamar_com_tools", "responder_com_resultado",
    # images
    "gerar_url", "gerar_bytes", "gerar_para_arquivo", "editar_imagem",
    # files
    "upload", "upload_bytes", "listar", "info", "baixar", "deletar", "deletar_varios",
]
