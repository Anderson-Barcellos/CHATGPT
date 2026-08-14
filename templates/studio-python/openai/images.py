"""
================================================================================
OPENAI/images.py — Geração e Edição de Imagens (DALL-E 3 / gpt-image-1)
================================================================================
Serviço: client.images.generate(...)  |  client.images.edit(...)

Modelos disponíveis:
  - "dall-e-3"    → Alta qualidade, entende prompts complexos, 1 imagem por vez
  - "gpt-image-1" → Mais recente, segue instruções com maior fidelidade,
                     suporta fundo transparente e compressão configurável

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  TAMANHOS DISPONÍVEIS POR MODELO                                         │
  │                                                                          │
  │  dall-e-3:    1024x1024, 1792x1024 (wide), 1024x1792 (tall)            │
  │  gpt-image-1: 1024x1024, 1536x1024 (wide), 1024x1536 (tall), auto      │
  └──────────────────────────────────────────────────────────────────────────┘

Funções deste módulo:
  - gerar_url()         →  Gera imagem e retorna URL temporária (válida por 1h)
  - gerar_bytes()       →  Gera imagem e retorna os bytes PNG/JPEG diretamente
  - gerar_para_arquivo()→  Gera imagem e salva em arquivo local
  - editar_imagem()     →  Edita uma imagem existente via prompt (inpainting)

Todas as funções usam APENAS tipos primitivos como parâmetros:
  str, int, float, bool, bytes, list, dict, Path, Literal
================================================================================
"""

from __future__ import annotations

import base64
from pathlib import Path
from typing import Any, Literal

from openai import OpenAI


# ─────────────────────────────────────────────────────────────────────────────
# GERAÇÃO DE IMAGENS
# ─────────────────────────────────────────────────────────────────────────────

def gerar_url(
    client: OpenAI,
    prompt: str,
    *,
    model: Literal["dall-e-3", "gpt-image-1"] = "dall-e-3",
    tamanho: Literal["auto", "1024x1024", "1536x1024", "1024x1536", "1792x1024", "1024x1792"] = "1024x1024",
    qualidade: Literal["auto", "standard", "hd", "low", "medium", "high"] = "standard",
    estilo: Literal["vivid", "natural"] | None = "vivid",
) -> str:
    """
    Gera uma imagem a partir de um prompt e retorna a URL temporária.

    ATENÇÃO: A URL é válida por apenas ~1 hora. Para guardar a imagem,
    use gerar_bytes() ou gerar_para_arquivo().

    `model` determina quais combinações de tamanho, qualidade e estilo a API
    aceita. `estilo` só é enviado para `dall-e-3`; `auto` é útil quando o
    modelo suporta decidir a proporção ou qualidade. Esta é a rota mais prática
    para exibição imediata, mas não é apropriada como armazenamento durável.

    Args:
        client    : Instância de OpenAI()
        prompt    : Descrição detalhada da imagem desejada.
                    Quanto mais específico, melhor o resultado.
                    Limite: 4000 chars (dall-e-3) / 32000 chars (gpt-image-1)
        model     : Modelo de geração:
                      "dall-e-3"    → qualidade artística, 1 imagem por chamada
                      "gpt-image-1" → mais novo, melhor fidelidade ao prompt
        tamanho   : Dimensões da imagem:
                      "1024x1024"           → quadrado (versátil)
                      "1792x1024"/"1536x1024" → landscape (wide)
                      "1024x1792"/"1024x1536" → portrait (tall)
                      "auto"                → modelo decide (gpt-image-1)
        qualidade : Nível de qualidade (custo maior = mais detalhe):
                      "standard" / "low"    → mais rápido e barato
                      "hd" / "high"         → mais detalhe e resolução
                      "medium"              → intermediário (gpt-image-1)
                      "auto"                → o modelo decide
        estilo    : Estilo visual (apenas dall-e-3):
                      "vivid"   → cores vibrantes, estilo cinematográfico
                      "natural" → mais fotorrealista e menos saturado

    Returns:
        str: URL temporária da imagem gerada (válida por ~1 hora)

    Example:
        >>> url = gerar_url(
        ...     client,
        ...     "Diagrama médico anatômico do pescoço mostrando a tireoide, "
        ...     "estilo ilustração científica limpa, fundo branco.",
        ...     qualidade="hd",
        ... )
        >>> print(url)  # "https://oaidalleapiprodscus.blob.core..."
    """
    kwargs: dict[str, Any] = {
        "model": model,
        "prompt": prompt,
        "size": tamanho,
        "quality": qualidade,
        "response_format": "url",
        "n": 1,
    }
    if estilo is not None and model == "dall-e-3":
        kwargs["style"] = estilo

    res = client.images.generate(**kwargs)
    url = res.data[0].url
    if not url:
        raise ValueError("A API não retornou URL para a imagem gerada.")
    return url


def gerar_bytes(
    client: OpenAI,
    prompt: str,
    *,
    model: Literal["dall-e-3", "gpt-image-1"] = "dall-e-3",
    tamanho: Literal["auto", "1024x1024", "1536x1024", "1024x1536", "1792x1024", "1024x1792"] = "1024x1024",
    qualidade: Literal["auto", "standard", "hd", "low", "medium", "high"] = "standard",
    formato_saida: Literal["png", "jpeg", "webp"] = "png",
    compressao: int | None = None,
    fundo_transparente: bool = False,
) -> bytes:
    """
    Gera uma imagem e retorna os bytes diretamente (sem URL intermediária).
    Mais seguro que gerar_url() pois os bytes não expiram.

    Use `formato_saida` para equilibrar compatibilidade, transparência e tamanho
    do arquivo. `compressao` e `fundo_transparente` são capacidades específicas
    de `gpt-image-1`; solicitar transparência com JPEG não produz alfa. Para
    guardar o resultado sem decidir manualmente o formato, prefira
    `gerar_para_arquivo()`.

    Args:
        client             : Instância de OpenAI()
        prompt             : Descrição da imagem (ver gerar_url())
        model              : Modelo de geração (ver gerar_url())
        tamanho            : Dimensões (ver gerar_url())
        qualidade          : Nível de qualidade (ver gerar_url())
        formato_saida      : Formato do arquivo de saída:
                               "png"  → sem perda, suporta transparência
                               "jpeg" → menor arquivo, sem transparência
                               "webp" → ótimo custo/qualidade (gpt-image-1)
        compressao         : Nível de compressão 0-100 (apenas gpt-image-1):
                               0 = sem compressão, 100 = máxima compressão
        fundo_transparente : True = fundo transparente (apenas PNG + gpt-image-1)

    Returns:
        bytes: Bytes da imagem no formato especificado

    Example:
        >>> # Gerar logo para o sistema Vertex V2
        >>> bytes_img = gerar_bytes(
        ...     client,
        ...     "Logo minimalista para software médico de ultrassom, "
        ...     "fundo transparente, estilo flat design, azul e branco.",
        ...     model="gpt-image-1",
        ...     formato_saida="png",
        ...     fundo_transparente=True,
        ... )
        >>> with open("logo.png", "wb") as f:
        ...     f.write(bytes_img)
    """
    kwargs: dict[str, Any] = {
        "model": model,
        "prompt": prompt,
        "size": tamanho,
        "quality": qualidade,
        "response_format": "b64_json",
        "output_format": formato_saida,
        "n": 1,
    }
    if compressao is not None:
        kwargs["output_compression"] = compressao
    if fundo_transparente:
        kwargs["background"] = "transparent"

    res = client.images.generate(**kwargs)
    b64 = res.data[0].b64_json
    if not b64:
        raise ValueError("A API não retornou dados base64 para a imagem.")
    return base64.b64decode(b64)


def gerar_para_arquivo(
    client: OpenAI,
    prompt: str,
    destino: str | Path,
    *,
    model: Literal["dall-e-3", "gpt-image-1"] = "dall-e-3",
    tamanho: Literal["auto", "1024x1024", "1536x1024", "1024x1536", "1792x1024", "1024x1792"] = "1024x1024",
    qualidade: Literal["auto", "standard", "hd", "low", "medium", "high"] = "standard",
    fundo_transparente: bool = False,
) -> Path:
    """
    Gera uma imagem e salva diretamente no arquivo especificado.
    O formato é inferido pela extensão do arquivo destino (.png, .jpg, .webp).

    A extensão de `destino` escolhe o formato enviado a `gerar_bytes()`.
    Arquivos sem extensão, ou com extensão desconhecida, viram PNG. O helper
    cria diretórios pai, mas não valida se uma combinação de modelo, tamanho,
    qualidade ou transparência é suportada pela API escolhida.

    Args:
        client             : Instância de OpenAI()
        prompt             : Descrição da imagem
        destino            : Caminho do arquivo de saída (cria diretórios se necessário)
        model              : Modelo de geração
        tamanho            : Dimensões da imagem
        qualidade          : Nível de qualidade
        fundo_transparente : True = fundo transparente (PNG + gpt-image-1)

    Returns:
        Path: Caminho do arquivo salvo

    Example:
        >>> caminho = gerar_para_arquivo(
        ...     client,
        ...     "Ilustração anatômica do fígado com marcação da vesícula biliar.",
        ...     "Docs/imagens/anatomia_figado.png",
        ...     qualidade="hd",
        ... )
        >>> print(f"Imagem salva em: {caminho}")
    """
    destino = Path(destino)
    ext = destino.suffix.lower().lstrip(".")
    fmt_map = {"jpg": "jpeg", "jpeg": "jpeg", "png": "png", "webp": "webp"}
    formato = fmt_map.get(ext, "png")

    img_bytes = gerar_bytes(
        client,
        prompt,
        model=model,
        tamanho=tamanho,
        qualidade=qualidade,
        formato_saida=formato,
        fundo_transparente=fundo_transparente,
    )

    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_bytes(img_bytes)
    return destino


def editar_imagem(
    client: OpenAI,
    imagem_original: str | Path | bytes,
    prompt_edicao: str,
    mascara: str | Path | bytes | None = None,
    *,
    model: Literal["dall-e-2", "gpt-image-1"] = "gpt-image-1",
    tamanho: Literal["256x256", "512x512", "1024x1024", "auto"] = "1024x1024",
    qualidade: Literal["auto", "standard", "hd", "low", "medium", "high"] = "standard",
) -> bytes:
    """
    Edita partes de uma imagem existente com base em um prompt (inpainting).

    Como funciona:
      - Sem máscara: o modelo interpreta o prompt e modifica a imagem inteira
      - Com máscara: apenas a região TRANSPARENTE (alfa=0) da máscara é editada.
        O restante da imagem original é preservado.

    `imagem_original` e `mascara` aceitam caminho ou bytes para servir tanto
    arquivos persistidos quanto uploads em memória. A máscara não descreve a
    edição: ela só delimita onde o `prompt_edicao` pode atuar. Use
    `gpt-image-1` para o fluxo atual; `dall-e-2` permanece como alternativa
    legada com restrições geométricas mais rígidas.

    Args:
        client           : Instância de OpenAI()
        imagem_original  : Imagem base a ser editada:
                             - str/Path de arquivo local (PNG ou JPEG)
                             - bytes da imagem
                           DEVE ser quadrada para dall-e-2.
        prompt_edicao    : Descrição da edição desejada.
                           Ex: "Adicione uma seta apontando para o nódulo"
        mascara          : Imagem PNG com canal alfa definindo a área a editar:
                             - Pixels TRANSPARENTES (alfa=0) = área a editar
                             - Pixels OPACOS = área preservada
                           None = edição livre em toda a imagem
        model            : Modelo de edição:
                             "gpt-image-1" → mais recente, melhor fidelidade
                             "dall-e-2"    → legado, exige imagem quadrada
        tamanho          : Dimensões da saída
        qualidade        : Nível de qualidade

    Returns:
        bytes: Bytes da imagem editada (PNG)

    Example:
        >>> # Adicionar anotação em imagem de ultrassom
        >>> imagem_editada = editar_imagem(
        ...     client,
        ...     "imagem_us_original.png",
        ...     "Adicione uma seta vermelha apontando para o nódulo na tireoide.",
        ... )
        >>> with open("us_anotado.png", "wb") as f:
        ...     f.write(imagem_editada)
    """
    def _abrir(src: str | Path | bytes, nome: str) -> tuple[str, bytes]:
        if isinstance(src, (str, Path)):
            path = Path(src)
            return (path.name, path.read_bytes())
        return (nome, src)

    nome_img, bytes_img = _abrir(imagem_original, "imagem.png")

    kwargs: dict[str, Any] = {
        "model": model,
        "image": (nome_img, bytes_img),
        "prompt": prompt_edicao,
        "size": tamanho,
        "quality": qualidade,
        "response_format": "b64_json",
        "n": 1,
    }

    if mascara is not None:
        nome_msk, bytes_msk = _abrir(mascara, "mascara.png")
        kwargs["mask"] = (nome_msk, bytes_msk)

    res = client.images.edit(**kwargs)
    b64 = res.data[0].b64_json
    if not b64:
        raise ValueError("A API não retornou dados base64 para a imagem editada.")
    return base64.b64decode(b64)
