"""
================================================================================
OPENAI/chat.py — Chat Completions + Responses API + Visão + Structured Outputs
================================================================================
Cobre DOIS clients diferentes para geração de texto:

  ┌──────────────────────────────────────────────────────────────────────────┐
  │ QUAL USAR?                                                               │
  │                                                                          │
  │  • client.chat.completions.create(...)  →  API CLÁSSICA                 │
  │    ✅ Compatível com qualquer modelo GPT, árvore de mensagens,          │
  │       multiturno, function calling tradicional.                          │
  │                                                                          │
  │  • client.responses.create(...)         →  NOVA RESPONSES API           │
  │    ✅ Mais simples, stateful (mantém histórico via previous_response_id) │
  │       nativa ao pipeline do Vertex V2 / GPTVision.                      │
  └──────────────────────────────────────────────────────────────────────────┘

Funções deste módulo:
  - chat()           →  Texto simples via Chat Completions (clássica)
  - chat_vision()    →  Texto + Imagens via Chat Completions
  - chat_stream()    →  Streaming de texto via Chat Completions
  - chat_json()      →  Retorno forçado em JSON válido
  - parse_pydantic() →  Structured Output garantido com Pydantic
  - response()       →  Texto via nova Responses API (nossa base no Vertex)
  - response_json()  →  Responses API com schema JSON strict
  - response_stream()→  Responses API com streaming

Todas as funções expõem APENAS tipos primitivos como parâmetros:
  str, int, float, bool, bytes, list, dict, Path, Type[BaseModel]
================================================================================
"""

from __future__ import annotations

import base64
import json
from pathlib import Path
from typing import Any, Generator, Iterator, Literal, Type, Union

from openai import OpenAI
from pydantic import BaseModel


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS INTERNOS
# ─────────────────────────────────────────────────────────────────────────────

def _imagem_para_url(caminho_ou_url: str | Path | bytes) -> str:
    """
    Converte uma imagem em URL remota ou data URI aceita pela API de visão.

    Args:
        caminho_ou_url (`str | Path | bytes`) : URL HTTP(S), data URI, caminho
                         local ou bytes brutos da imagem. Bytes sem extensão são
                         codificados como JPEG.

    Returns:
        str: URL original ou data URI em base64 aceita pela API.

    Raises:
        TypeError: Se o valor não for `str`, `Path` nem `bytes`.
    """
    if isinstance(caminho_ou_url, str):
        if caminho_ou_url.startswith(("http://", "https://", "data:")):
            return caminho_ou_url
        # Trata como caminho de arquivo local em string
        caminho_ou_url = Path(caminho_ou_url)

    if isinstance(caminho_ou_url, Path):
        ext = caminho_ou_url.suffix.lower().lstrip(".")
        mime = {
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "png": "image/png",
            "gif": "image/gif",
            "webp": "image/webp",
        }.get(ext, "image/jpeg")
        dados = base64.b64encode(caminho_ou_url.read_bytes()).decode()
        return f"data:{mime};base64,{dados}"

    if isinstance(caminho_ou_url, bytes):
        dados = base64.b64encode(caminho_ou_url).decode()
        return f"data:image/jpeg;base64,{dados}"

    raise TypeError(f"Tipo inesperado para imagem: {type(caminho_ou_url)}")


def _montar_msgs(
    mensagem: str | list[dict[str, Any]],
    system_prompt: str | None = None,
) -> list[dict[str, Any]]:
    """
    Monta mensagens da Chat Completions a partir de texto ou histórico.

    Args:
        mensagem (`str | list[dict[str, Any]]`) : Texto único ou lista de
                         mensagens já no formato da API.
        system_prompt (`str | None`) : Instrução de sistema inserida antes do
                         histórico.

    Returns:
        list[dict[str, Any]]: Lista de mensagens pronta para a API.
    """
    if isinstance(mensagem, list):
        msgs = list(mensagem)
    else:
        msgs = [{"role": "user", "content": mensagem}]

    if system_prompt:
        msgs.insert(0, {"role": "system", "content": system_prompt})

    return msgs


# ─────────────────────────────────────────────────────────────────────────────
# 1. CHAT COMPLETIONS CLÁSSICA
# ─────────────────────────────────────────────────────────────────────────────

def chat(
    client: OpenAI,
    mensagem: str | list[dict[str, Any]],
    *,
    model: str = "gpt-4o-mini",
    system_prompt: str | None = None,
    temperature: float = 0.2,
    max_tokens: int | None = None,
    top_p: float | None = None,
    stop: str | list[str] | None = None,
) -> str:
    """
    Chamada de chat de texto simples — a mais comum de todas.

    Args:
        client (`OpenAI`) : Instância de `OpenAI()`.
        mensagem (`str | list[dict[str, Any]]`) : Texto ("Analise este laudo")
                         OU lista de mensagens:
                         [{"role": "user", "content": "..."},
                          {"role": "assistant", "content": "..."},
                          {"role": "user", "content": "..."}]
        model (`str`) : "gpt-4o-mini", "gpt-4o", "gpt-4.1" ou "gpt-4.1-mini".
        system_prompt (`str | None`) : Instrução de sistema inserida antes das
                         mensagens.
        temperature (`float`) : 0.0 = determinístico; 2.0 = muito criativo.
        max_tokens (`int | None`) : Limite de tokens na resposta (`None` = sem
                         limite explícito).
        top_p (`float | None`) : Alternativa a `temperature` (nucleus sampling).
        stop (`str | list[str] | None`) : Sequência(s) que fazem o modelo parar.

    Returns:
        str: Texto bruto da resposta

    Example:
    ```python
        resposta = chat(client, "O que é TIRADS?")
        resposta = chat(
            client,
            [
                {"role": "user", "content": "Olá"}, 
                {"role": "assistant", "content": "Oi!"}, 
                {"role": "user", "content": "Tudo bem?"}
            ],
            system_prompt="Responda como médico.",
        )
    ```
    """
    kwargs: dict[str, Any] = {
        "model": model,
        "messages": _montar_msgs(mensagem, system_prompt),
        "temperature": temperature,
    }
    if max_tokens is not None:
        kwargs["max_tokens"] = max_tokens
    if top_p is not None:
        kwargs["top_p"] = top_p
    if stop is not None:
        kwargs["stop"] = stop

    res = client.chat.completions.create(**kwargs)
    return res.choices[0].message.content or ""


def chat_vision(
    client: OpenAI,
    texto: str,
    imagens: list[str | Path | bytes],
    *,
    model: str = "gpt-4o",
    system_prompt: str | None = None,
    temperature: float = 0.2,
    max_tokens: int | None = None,
    detalhe: Literal["low", "high", "auto"] = "auto",
) -> str:
    """
    Chat de texto com análise de uma ou mais imagens.

    Args:
        client (`OpenAI`) : Instância de `OpenAI()`.
        texto (`str`) : Pergunta ou instrução sobre as imagens.
        imagens (`list[str | Path | bytes]`) : URLs, data URIs, caminhos locais,
                         `Path` ou bytes brutos das imagens.
        model (`str`) : Modelo com capacidade de visão, como `gpt-4o`.
        system_prompt (`str | None`) : Instrução de sistema inserida antes da
                         mensagem.
        temperature (`float`) : 0.0 = mais determinístico; 2.0 = mais criativo.
        max_tokens (`int | None`) : Limite de tokens na resposta (`None` = sem
                         limite explícito).
        detalhe (`Literal["low", "high", "auto"]`) : `low` prioriza rapidez,
                         `high` prioriza precisão e `auto`
                         deixa a escolha para o modelo.

    Returns:
        str: Análise textual do modelo.

    Example:
    ```python
        resultado = chat_vision(
            client,
            "Descreva os achados neste ultrassom da tireoide.",
            ["/caminho/ultrassom.jpg"],
            system_prompt="Você é um radiologista especialista.",
        )
    ```
    """
    content: list[dict[str, Any]] = [{"type": "text", "text": texto}]
    for img in imagens:
        url = _imagem_para_url(img)
        content.append({
            "type": "image_url",
            "image_url": {"url": url, "detail": detalhe},
        })

    msgs = [{"role": "user", "content": content}]
    if system_prompt:
        msgs.insert(0, {"role": "system", "content": system_prompt})

    kwargs: dict[str, Any] = {
        "model": model,
        "messages": msgs,
        "temperature": temperature,
    }
    if max_tokens is not None:
        kwargs["max_tokens"] = max_tokens

    res = client.chat.completions.create(**kwargs)
    return res.choices[0].message.content or ""


def chat_stream(
    client: OpenAI,
    mensagem: str | list[dict[str, Any]],
    *,
    model: str = "gpt-4o-mini",
    system_prompt: str | None = None,
    temperature: float = 0.2,
    max_tokens: int | None = None,
) -> Generator[str, None, None]:
    """
    Chat de texto com streaming: devolve cada fragmento conforme o modelo gera.

    Args:
        client (`OpenAI`) : Instância de `OpenAI()`.
        mensagem (`str | list[dict[str, Any]]`) : Texto único ou histórico de
                         mensagens.
        model (`str`) : Modelo de texto a usar.
        system_prompt (`str | None`) : Instrução de sistema inserida antes das
                         mensagens.
        temperature (`float`) : 0.0 = mais determinístico; 2.0 = mais criativo.
        max_tokens (`int | None`) : Limite de tokens na resposta (`None` = sem
                         limite explícito).

    Yields:
        str: Cada fragmento de texto recebido da API.

    Example:
    ```python
        for fragmento in chat_stream(client, "Explique o Doppler colorido"):
            print(fragmento, end="", flush=True)

        texto_completo = "".join(chat_stream(client, "..."))
    ```
    """
    kwargs: dict[str, Any] = {
        "model": model,
        "messages": _montar_msgs(mensagem, system_prompt),
        "temperature": temperature,
        "stream": True,
    }
    if max_tokens is not None:
        kwargs["max_tokens"] = max_tokens

    with client.chat.completions.stream(**kwargs) as stream:
        for text in stream.text_stream:
            yield text


def chat_json(
    client: OpenAI,
    mensagem: str | list[dict[str, Any]],
    *,
    model: str = "gpt-4o-mini",
    system_prompt: str | None = None,
    temperature: float = 0.0,
) -> dict[str, Any]:
    """
    Retorna JSON válido já convertido para dicionário Python.

    A mensagem ou a instrução de sistema precisa pedir explicitamente JSON.

    Args:
        client (`OpenAI`) : Instância de `OpenAI()`.
        mensagem (`str | list[dict[str, Any]]`) : Texto ou histórico que solicite
                         uma resposta em JSON.
        model (`str`) : Modelo de texto a usar.
        system_prompt (`str | None`) : Instrução de sistema; é um bom lugar para
                         exigir JSON.
        temperature (`float`) : Padrão 0.0 para uma saída mais estável.

    Returns:
        dict[str, Any]: JSON parseado como dicionário Python.

    Example:
    ```python
        resultado = chat_json(
            client,
            "Extraia os dados em JSON: Paciente João, 45 anos, nódulo 1.2 cm.",
            system_prompt='Retorne um JSON com "nome", "idade" e "nodulo_cm".',
        )
        print(resultado["nome"])
    ```
    """
    res = client.chat.completions.create(
        model=model,
        messages=_montar_msgs(mensagem, system_prompt),
        temperature=temperature,
        response_format={"type": "json_object"},
    )
    texto = res.choices[0].message.content or "{}"
    return json.loads(texto)


def parse_pydantic(
    client: OpenAI,
    mensagem: str | list[dict[str, Any]],
    schema: Type[BaseModel],
    *,
    model: str = "gpt-4o-mini",
    system_prompt: str | None = None,
    temperature: float = 0.0,
) -> BaseModel:
    """
    Retorna uma instância Pydantic validada contra o schema informado.

    Ao contrário de `chat_json()`, esta função exige a estrutura do schema e
    retorna um objeto tipado, não um dicionário flexível.

    Args:
        client (`OpenAI`) : Instância de `OpenAI()`.
        mensagem (`str | list[dict[str, Any]]`) : Texto único ou histórico de
                         mensagens.
        schema (`Type[BaseModel]`) : Classe Pydantic, não uma instância.
        model (`str`) : Modelo de texto a usar.
        system_prompt (`str | None`) : Instrução de sistema inserida antes das
                         mensagens.
        temperature (`float`) : Padrão 0.0 para uma saída mais precisa.

    Returns:
        BaseModel: Instância validada da classe fornecida em `schema`.

    Example:
    ```python
        from pydantic import BaseModel

        class Nodulo(BaseModel):
            tamanho_cm: float
            classificacao: str
            hipoecoico: bool

        resultado = parse_pydantic(
            client,
            "Nódulo hipoecoico de 1,5 cm, TIRADS 4.",
            Nodulo,
        )
        print(resultado.tamanho_cm)
    ```
    """
    msgs = _montar_msgs(mensagem, system_prompt)
    completion = client.beta.chat.completions.parse(
        model=model,
        messages=msgs,
        response_format=schema,
        temperature=temperature,
    )
    parsed = completion.choices[0].message.parsed
    if parsed is None:
        raw = completion.choices[0].message.content
        raise ValueError(
            f"O modelo não retornou um objeto Pydantic válido. Resposta bruta: {raw!r}"
        )
    return parsed


# ─────────────────────────────────────────────────────────────────────────────
# 2. NOVA RESPONSES API (base do nosso pipeline Vertex V2 / GPTVision)
# ─────────────────────────────────────────────────────────────────────────────

def response(
    client: OpenAI,
    entrada: str | list[dict[str, Any]],
    *,
    model: str = "gpt-4o-mini",
    instructions: str | None = None,
    previous_response_id: str | None = None,
    temperature: float = 0.2,
    max_output_tokens: int | None = None,
    store: bool = True,
) -> tuple[str, str]:
    """
    Gera texto pela Responses API, com suporte a continuidade de conversa.

    Passe o `response_id` retornado como `previous_response_id` no próximo
    turno para reutilizar o contexto armazenado pela API. `instructions` não
    é herdado da resposta anterior: reenvie-o em cada turno que precise da
    mesma instrução de sistema.

    Este wrapper cobre o caminho didático mais comum: texto, continuidade,
    limite de saída e persistência. `max_output_tokens` limita tanto tokens
    visíveis quanto tokens de reasoning. `store=True` permite recuperar ou
    encadear a resposta no servidor; escolha `False` quando o fluxo não deve
    ficar persistido pela API. Em modelos GPT-5, `temperature` é omitido pelo
    wrapper, pois esse controle não é aceito por essa família.

    A Responses API tem controles avançados que não aparecem nesta assinatura
    para manter o snippet enxuto: `tools`/`tool_choice` (web search, file
    search, Code Interpreter ou funções próprias), `reasoning` (esforço e
    resumo), `text` (formato JSON), `include` (dados extras de tools ou
    logprobs), `metadata`, `truncation`, `parallel_tool_calls`, `max_tool_calls`,
    `safety_identifier`, `prompt_cache_key` e `service_tier`. Quando precisar
    deles, chame `client.responses.create(...)` diretamente; eles não são
    descartados por esta função — simplesmente não foram expostos por ela.

    Args:
        client (`OpenAI`) : Instância de `OpenAI()`.
        entrada (`str | list[dict[str, Any]]`) : Texto ou lista de itens aceitos
                         pela Responses API.
        model (`str`) : Modelo a usar.
        instructions (`str | None`) : Instrução de sistema, equivalente a
                         `system_prompt`.
        previous_response_id (`str | None`) : ID da resposta anterior; `None`
                         inicia uma conversa nova.
        temperature (`float`) : 0.0 = mais determinístico; 2.0 = mais criativo.
        max_output_tokens (`int | None`) : Limite de tokens de saída (`None` =
                         sem limite explícito).
        store (`bool`) : Se `True`, armazena a resposta para continuidade.

    Returns:
        tuple[str, str]: (texto_da_resposta, response_id)

    Example:
    ```python
        texto, response_id = response(client, "O que é TIRADS 4?")

        continuacao, novo_response_id = response(
            client,
            "E como ele difere do TIRADS 3?",
            previous_response_id=response_id,
        )
    ```
    """
    kwargs: dict[str, Any] = {
        "model": model,
        "input": entrada,
        "store": store,
    }
    if instructions is not None:
        kwargs["instructions"] = instructions
    if previous_response_id is not None:
        kwargs["previous_response_id"] = previous_response_id
    if max_output_tokens is not None:
        kwargs["max_output_tokens"] = max_output_tokens
    if "gpt-5" not in model:
        kwargs["temperature"] = temperature

    res = client.responses.create(**kwargs)

    # Extrai o texto do output (pode ser lista de blocos)
    texto = ""
    for bloco in res.output:
        if hasattr(bloco, "content"):
            for part in bloco.content:
                if hasattr(part, "text"):
                    texto += part.text
        elif hasattr(bloco, "text"):
            texto += bloco.text

    return texto, res.id


def response_pydantic(
    client: OpenAI,
    entrada: str | list[dict[str, Any]],
    schema: Type[BaseModel],
    *,
    model: str = "gpt-4o-mini",
    instructions: str | None = None,
    previous_response_id: str | None = None,
    temperature: float = 0.0,
) -> tuple[BaseModel, str]:
    """
    Retorna saída estruturada Pydantic pela Responses API.

    Combina o schema validado com `previous_response_id` para fluxos
    estruturados de múltiplos turnos. Use quando o consumidor precisa de
    atributos tipados e validados, não apenas de um JSON que "parece válido".
    `schema` é uma classe Pydantic, e `text_format=schema` informa à SDK o
    formato esperado; a função falha explicitamente se a API não produzir um
    objeto compatível.

    Para uma saída estruturada com controles além desta assinatura, use
    `client.responses.parse(...)` diretamente. Os controles mais frequentes
    são `reasoning`, `tools`, `tool_choice`, `max_output_tokens`, `store`,
    `metadata`, `truncation`, `include` e `service_tier`. `instructions` segue
    a mesma regra de continuidade: ao usar `previous_response_id`, reenvie a
    instrução em cada turno em que ela deva continuar valendo.

    Args:
        client (`OpenAI`) : Instância de `OpenAI()`.
        entrada (`str | list[dict[str, Any]]`) : Texto ou lista de itens aceitos
                         pela Responses API.
        schema (`Type[BaseModel]`) : Classe Pydantic que define a saída esperada.
        model (`str`) : Modelo a usar.
        instructions (`str | None`) : Instrução de sistema.
        previous_response_id (`str | None`) : ID da resposta anterior para
                         continuar a conversa.
        temperature (`float`) : Padrão 0.0 para saída estruturada mais estável.

    Returns:
        tuple[BaseModel, str]: Instância validada e ID da resposta gerada.

    Example:
    ```python
        from pydantic import BaseModel

        class Laudo(BaseModel):
            conclusao: str
            achados: list[str]

        resultado, response_id = response_pydantic(
            client,
            "Ultrassom mostrando fígado esteatótico grau II.",
            Laudo,
            instructions="Extraia os achados do laudo.",
        )
        print(resultado.conclusao)
    ```
    """
    res = client.responses.parse(
        model=model,
        input=entrada,
        text_format=schema,
        temperature=temperature,
        **({"instructions": instructions} if instructions else {}),
        **({"previous_response_id": previous_response_id} if previous_response_id else {}),
    )

    parsed = res.output_parsed
    if parsed is None:
        raise ValueError("O modelo não retornou um objeto Pydantic válido.")
    return parsed, res.id


def response_stream(
    client: OpenAI,
    entrada: str | list[dict[str, Any]],
    *,
    model: str = "gpt-4o-mini",
    instructions: str | None = None,
    previous_response_id: str | None = None,
    temperature: float = 0.2,
) -> Iterator[str]:
    """
    Gera texto pela Responses API em streaming.

    Esta versão é propositalmente simples: devolve apenas deltas textuais para
    `for fragmento in response_stream(...)`. Ela é ideal para imprimir texto
    incrementalmente, mas não expõe o ciclo de vida completo, o `response_id`,
    reasoning, recusas ou chamadas de tools. Como em `response()`,
    `instructions` não é herdado de `previous_response_id`; e `temperature` é
    omitido automaticamente para modelos GPT-5.

    Streaming da Responses API é uma sequência de eventos SSE tipados, não um
    único tipo de chunk. Em uma UI ou orquestrador, capture ao menos
    `response.created`, `response.output_text.delta`, `response.completed` e
    `error`. Dependendo da solicitação, também podem surgir
    `response.refusal.delta`, `response.function_call_arguments.delta`,
    `response.function_call_arguments.done`, eventos de `file_search` e de
    `code_interpreter`. Para controlar esses casos, use o stream bruto abaixo:

    Args:
        client (`OpenAI`) : Instância de `OpenAI()`.
        entrada (`str | list[dict[str, Any]]`) : Texto ou lista de itens aceitos
                         pela Responses API.
        model (`str`) : Modelo a usar.
        instructions (`str | None`) : Instrução de sistema.
        previous_response_id (`str | None`) : ID da resposta anterior para
                         continuar a conversa.
        temperature (`float`) : 0.0 = mais determinístico; 2.0 = mais criativo.

    Yields:
        str: Cada fragmento de texto recebido da API.

    Example:
    ```python
        for fragmento in response_stream(client, "Descreva a anatomia hepática"):
            print(fragmento, end="", flush=True)

        texto_completo = "".join(response_stream(client, "..."))

        # Eventos tipados: use quando a aplicação precisar de estado e tools.
        with client.responses.stream(
            model="gpt-5.6",
            input="Analise este laudo.",
            reasoning={"effort": "low", "summary": "concise"},
        ) as stream:
            for event in stream:
                if event.type == "response.created":
                    response_id = event.response.id
                elif event.type == "response.output_text.delta":
                    print(event.delta, end="", flush=True)
                elif event.type == "response.reasoning_summary_text.delta":
                    atualizar_painel_reasoning(event.delta)
                elif event.type == "response.function_call_arguments.done":
                    executar_funcao(event.name, event.arguments)
                elif event.type == "response.completed":
                    uso = event.response.usage
                elif event.type in {"response.failed", "error"}:
                    raise RuntimeError(getattr(event, "error", event))
    ```

    Não exponha imediatamente deltas ao usuário final sem considerar a
    moderação do produto: partes da resposta chegam antes da conclusão e são
    mais difíceis de avaliar isoladamente.
    """
    kwargs: dict[str, Any] = {
        "model": model,
        "input": entrada,
    }
    if instructions is not None:
        kwargs["instructions"] = instructions
    if previous_response_id is not None:
        kwargs["previous_response_id"] = previous_response_id
    if "gpt-5" not in model:
        kwargs["temperature"] = temperature

    with client.responses.stream(**kwargs) as stream:
        for event in stream:
            if event.type == "response.output_text.delta":
                delta = getattr(event, "delta", None)
                if delta and isinstance(delta, str):
                    yield delta
