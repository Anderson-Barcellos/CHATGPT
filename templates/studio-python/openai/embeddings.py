"""
================================================================================
OPENAI/embeddings.py — Embeddings (Vetores de Texto para Busca Semântica / RAG)
================================================================================
Serviço: client.embeddings.create(...)

O que são Embeddings?
  Um embedding converte texto em um vetor numérico de alta dimensão.
  Textos semanticamente similares ficam PRÓXIMOS no espaço vetorial, mesmo
  usando palavras diferentes.

  Exemplo:
    "nódulo hipoecoico tireoide" e "lesão sólida de baixa ecogenicidade"
    ficam próximos → busca semântica os encontra juntos.

Principais usos:
  🔍 Busca semântica     → "encontre laudos similares a este"
  📚 RAG (Retrieval)     → recuperar contexto relevante antes de chamar o LLM
  🏷️  Classificação      → agrupar achados sem treino supervisionado
  📊 Deduplicação        → detectar laudos repetidos/similares

Modelos disponíveis:
  - "text-embedding-3-small"  → 1536 dims, rápido e barato (recomendado)
  - "text-embedding-3-large"  → 3072 dims, mais preciso para nuances técnicas
  - "text-embedding-ada-002"  → legado, evitar para novos projetos

Funções deste módulo:
  - embedar()               → Gera vetor para um único texto
  - embedar_varios()        → Gera vetores para lista de textos (batch)
  - similaridade_cosseno()  → Calcula similaridade entre dois vetores (0 a 1)
  - buscar_mais_similar()   → Acha o texto mais parecido numa lista de candidatos
  - similaridades_todas()   → Matriz de similaridade entre todos os pares de textos

Todas as funções usam APENAS tipos primitivos como parâmetros:
  str, int, float, bool, list, dict
================================================================================
"""

from __future__ import annotations

import math
from typing import Any

from openai import OpenAI


# ─────────────────────────────────────────────────────────────────────────────
# CONSTANTES DE REFERÊNCIA
# ─────────────────────────────────────────────────────────────────────────────

MODELOS_EMBEDDING = {
    "text-embedding-3-small": {
        "dims_padrao": 1536, "dims_max": 1536,
        "descricao": "Rápido, barato, excelente custo-benefício ✅ Recomendado",
    },
    "text-embedding-3-large": {
        "dims_padrao": 3072, "dims_max": 3072,
        "descricao": "Mais preciso para nuances técnicas e multilíngue",
    },
    "text-embedding-ada-002": {
        "dims_padrao": 1536, "dims_max": 1536,
        "descricao": "Legado — use text-embedding-3-small para novos projetos",
    },
}


# ─────────────────────────────────────────────────────────────────────────────
# GERAÇÃO DE EMBEDDINGS
# ─────────────────────────────────────────────────────────────────────────────

def embedar(
    client: OpenAI,
    texto: str,
    *,
    model: str = "text-embedding-3-small",
    dimensoes: int | None = None,
) -> list[float]:
    """
    Gera o vetor (embedding) de um único texto.

    Um embedding serve para comparação matemática, não para ser lido por uma
    pessoa. `dimensoes` reduz armazenamento e custo de busca apenas nos modelos
    que suportam redução; todos os vetores de uma mesma coleção precisam usar
    o mesmo modelo e a mesma dimensão para que a similaridade seja válida.

    Args:
        client    : Instância de OpenAI()
        texto     : Texto a ser vetorizado. Pode ser curto ("TIRADS 4") ou
                    um parágrafo longo. Limite: ~8191 tokens (~6000 palavras)
        model     : Modelo de embedding:
                      "text-embedding-3-small" → 1536 dims, barato ✅
                      "text-embedding-3-large" → 3072 dims, mais preciso
        dimensoes : Opcional — reduz a dimensão do vetor para economizar espaço.
                    Ex: dimensoes=512 devolve vetor de 512 floats em vez de 1536.
                    Reduz custo de armazenamento/busca sem perda crítica de qualidade.

    Returns:
        list[float]: Vetor numérico representando o texto no espaço semântico

    Example:
        >>> # Gerar embedding de um laudo
        >>> vetor = embedar(client, "Nódulo hipoecoico de 1.2cm na tireoide, TIRADS 4.")
        >>> print(len(vetor))  # 1536
        >>>
        >>> # Com dimensão reduzida para economizar espaço em banco vetorial
        >>> vetor_compacto = embedar(client, "esteatose hepática grau II", dimensoes=512)
        >>> print(len(vetor_compacto))  # 512
    """
    kwargs: dict[str, Any] = {
        "model": model,
        "input": [texto],
    }
    if dimensoes is not None:
        kwargs["dimensions"] = dimensoes

    res = client.embeddings.create(**kwargs)
    return res.data[0].embedding


def embedar_varios(
    client: OpenAI,
    textos: list[str],
    *,
    model: str = "text-embedding-3-small",
    dimensoes: int | None = None,
) -> list[list[float]]:
    """
    Gera vetores para múltiplos textos em UMA ÚNICA chamada de API (batch).
    Muito mais eficiente que chamar embedar() em loop — mesma latência, mesmo custo.

    A função preserva a ordem de `textos` ao ordenar a resposta pelo índice da
    API. Use batch para indexação; para uma consulta isolada, `embedar()` deixa
    explícita a intenção. Uma lista vazia retorna `[]` sem consumir uma chamada.

    Args:
        client    : Instância de OpenAI()
        textos    : Lista de strings a serem vetorizadas.
                    Limite: 2048 textos por chamada.
        model     : Modelo de embedding (ver embedar())
        dimensoes : Opcional — reduz a dimensão de todos os vetores

    Returns:
        list[list[float]]: Lista de vetores, na mesma ordem da lista de textos.
                           textos[i] → vetores[i]

    Example:
        >>> laudos = [
        ...     "Fígado com ecotextura grosseira, esteatose grau II.",
        ...     "Vesícula biliar com cálculo de 8mm.",
        ...     "Pâncreas de aspecto normal.",
        ... ]
        >>> vetores = embedar_varios(client, laudos)
        >>> print(len(vetores))      # 3
        >>> print(len(vetores[0]))   # 1536
    """
    if not textos:
        return []

    kwargs: dict[str, Any] = {
        "model": model,
        "input": textos,
    }
    if dimensoes is not None:
        kwargs["dimensions"] = dimensoes

    res = client.embeddings.create(**kwargs)
    # A API garante ordem por index
    dados_ordenados = sorted(res.data, key=lambda x: x.index)
    return [item.embedding for item in dados_ordenados]


# ─────────────────────────────────────────────────────────────────────────────
# OPERAÇÕES SOBRE VETORES
# ─────────────────────────────────────────────────────────────────────────────

def similaridade_cosseno(vetor_a: list[float], vetor_b: list[float]) -> float:
    """
    Calcula a similaridade cosseno entre dois vetores de embedding.

    O resultado indica o quão semanticamente próximos dois textos são:
      1.0  → textos idênticos (ou quase)
      0.8+ → muito similares
      0.6+ → relacionados
      0.0  → sem relação semântica
     -1.0  → semanticamente opostos (raro em textos reais)

    Similaridade só é comparável quando ambos os vetores foram produzidos com a
    mesma configuração de embedding. O helper rejeita dimensões diferentes e
    retorna `0.0` se algum vetor tiver norma zero, evitando divisão inválida.

    Args:
        vetor_a : Primeiro vetor (output de embedar())
        vetor_b : Segundo vetor (output de embedar())

    Returns:
        float: Similaridade de -1.0 a 1.0 (na prática, 0.0 a 1.0 para textos)

    Example:
        >>> v1 = embedar(client, "nódulo hipoecoico tireoide")
        >>> v2 = embedar(client, "lesão sólida de baixa ecogenicidade na glândula")
        >>> v3 = embedar(client, "resultado de futebol")
        >>> print(f"v1 vs v2: {similaridade_cosseno(v1, v2):.3f}")  # ~0.85
        >>> print(f"v1 vs v3: {similaridade_cosseno(v1, v3):.3f}")  # ~0.20
    """
    if len(vetor_a) != len(vetor_b):
        raise ValueError(
            f"Vetores com dimensões diferentes: {len(vetor_a)} vs {len(vetor_b)}"
        )
    dot_product = sum(a * b for a, b in zip(vetor_a, vetor_b))
    norm_a = math.sqrt(sum(a * a for a in vetor_a))
    norm_b = math.sqrt(sum(b * b for b in vetor_b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot_product / (norm_a * norm_b)


def buscar_mais_similar(
    client: OpenAI,
    consulta: str,
    candidatos: list[str],
    *,
    model: str = "text-embedding-3-small",
    n_resultados: int = 1,
) -> list[dict[str, Any]]:
    """
    Encontra os textos mais semanticamente similares à consulta dentro
    de uma lista de candidatos.

    Utilidade: busca semântica em laudos anteriores, base de conhecimento médico,
    achados padrão, etc.

    Este é um exemplo didático de busca em memória: gera embeddings da consulta
    e dos candidatos na mesma chamada, calcula cosseno e devolve o ranking.
    Para coleções grandes, indexe vetores uma vez em banco vetorial e use a
    mesma configuração de `model` na indexação e na consulta.

    Args:
        client       : Instância de OpenAI()
        consulta     : Texto de busca (ex: o laudo atual ou uma pergunta)
        candidatos   : Lista de textos onde buscar (base de laudos, etc.)
        model        : Modelo de embedding
        n_resultados : Quantos resultados mais similares retornar (padrão 1)

    Returns:
        list[dict]: Lista ordenada por similaridade decrescente. Cada dict:
          - "indice"     : int   — posição na lista de candidatos
          - "texto"      : str   — o texto candidato
          - "score"      : float — similaridade de 0.0 a 1.0

    Example:
        >>> laudos_anteriores = [
        ...     "Fígado esteatótico grau I, pâncreas normal.",
        ...     "Nódulo tireoide hipoecoico 1.2cm TIRADS 4.",
        ...     "Vesícula com cálculo 6mm, sem espessamento.",
        ... ]
        >>> resultados = buscar_mais_similar(
        ...     client,
        ...     "Nódulo sólido de baixa ecogenicidade na glândula tireoide",
        ...     laudos_anteriores,
        ...     n_resultados=2,
        ... )
        >>> for r in resultados:
        ...     print(f"Score {r['score']:.3f}: {r['texto']}")
        # Score 0.891: Nódulo tireoide hipoecoico 1.2cm TIRADS 4.
        # Score 0.312: Fígado esteatótico grau I, pâncreas normal.
    """
    if not candidatos:
        return []

    # Gera todos os embeddings em uma chamada só (batch)
    todos_textos = [consulta] + candidatos
    todos_vetores = embedar_varios(client, todos_textos, model=model)

    vetor_consulta = todos_vetores[0]
    vetores_candidatos = todos_vetores[1:]

    # Calcula similaridades
    scores = [
        {
            "indice": i,
            "texto": candidatos[i],
            "score": similaridade_cosseno(vetor_consulta, vetores_candidatos[i]),
        }
        for i in range(len(candidatos))
    ]

    # Ordena por score decrescente
    scores.sort(key=lambda x: x["score"], reverse=True)
    return scores[:n_resultados]


def similaridades_todas(
    client: OpenAI,
    textos: list[str],
    *,
    model: str = "text-embedding-3-small",
) -> list[list[float]]:
    """
    Calcula a matriz de similaridade entre TODOS os pares de textos.
    Útil para clustering, visualização e detecção de duplicatas.

    O custo cresce quadraticamente com a quantidade de textos: a função cria
    uma matriz `N x N` depois de uma única chamada de embeddings. É adequada
    para análises pequenas; para muitos documentos, prefira busca por vizinhos
    ou clustering que não materialize todos os pares.

    Args:
        client : Instância de OpenAI()
        textos : Lista de textos para comparar entre si
        model  : Modelo de embedding

    Returns:
        list[list[float]]: Matriz NxN onde resultado[i][j] = similaridade entre
                           textos[i] e textos[j]. A diagonal é sempre 1.0.

    Example:
        >>> textos = ["laudo A", "laudo B", "laudo C"]
        >>> matriz = similaridades_todas(client, textos)
        >>> print(matriz[0][1])  # similaridade entre "laudo A" e "laudo B"
        >>> print(matriz[0][0])  # 1.0 (texto com ele mesmo)
    """
    vetores = embedar_varios(client, textos, model=model)
    n = len(textos)
    return [
        [similaridade_cosseno(vetores[i], vetores[j]) for j in range(n)]
        for i in range(n)
    ]
