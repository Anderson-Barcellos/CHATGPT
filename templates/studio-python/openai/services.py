"""
===============================================================================
VERTEX V2 - MAPA PRIMITIVO DA OPENAI (GUIA DE SERVIÇOS & HELPERS)
===============================================================================
Este módulo descomplica a SDK oficial da OpenAI. Em vez de lidar com
dataclasses e tipos genéricos complexos (como ChatCompletionMessageParam, 
FileTypes, NotGiven, etc.), todas as funções aqui utilizam APENAS TIPOS
FUNDAMENTAIS E PRIMITIVOS DO PYTHON:
  - str, int, float, bool, bytes, list[dict], dict, Path, Type[BaseModel]

Onde achar cada serviço na SDK oficial (`client = OpenAI()`):
-------------------------------------------------------------------------------
1. Texto / Visão / Multimodal  -> client.chat.completions.create(...)
2. Saída Estruturada Pydantic  -> client.beta.chat.completions.parse(...)
3. Função / Tool Calling        -> openai.lib._tools.pydantic_function_tool(...)
4. Transcrição de Áudio         -> client.audio.transcriptions.create(...)
5. Geração de Voz (TTS)        -> client.audio.speech.create(...)
6. Embeddings (Vetores)        -> client.embeddings.create(...)
7. Gerador de Imagens (DALL-E)  -> client.images.generate(...)
8. Gerenciador de Arquivos      -> client.files.create(...)
9. Realtime / WebSockets        -> client.beta.realtime.sessions.create(...)
===============================================================================
"""

from typing import Type, Any, Literal, Union
from pathlib import Path
from pydantic import BaseModel
from openai import OpenAI
from openai.lib._tools import pydantic_function_tool


# =============================================================================
# 1. TEXTO / VISÃO (CHAT COMPLETIONS)
# =============================================================================
def chamar_chat(
    client: OpenAI,
    mensagem_ou_mensagens: Union[str, list[dict[str, Any]]],
    model: str = "gpt-4o-mini",
    system_prompt: str | None = None,
    temperature: float = 0.2,
    max_tokens: int | None = None,
    json_mode: bool = False,
) -> str:
    """
    Executa uma chamada de chat normal ou visão.

    Este é o atalho mais genérico do módulo: aceita texto simples, histórico ou
    conteúdo multimodal já no formato da Chat Completions API. `json_mode`
    garante JSON sintaticamente válido, mas não impõe campos; quando precisar
    de contrato tipado, prefira `chamar_estruturado()`.
    
    Argumentos em tipos primitivos:
      - client: Instância de OpenAI()
      - mensagem_ou_mensagens: String simples ("Olá") OU lista de dicts:
            [{"role": "user", "content": "..."}]
            Para visão:
            [{"role": "user", "content": [
                {"type": "text", "text": "o que é isso?"},
                {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,..."}}
            ]}]
      - model: Nome do modelo (ex: "gpt-4o", "gpt-4o-mini")
      - system_prompt: Instrução inicial do sistema (opcional)
      - temperature: Criatividade (0.0 a 2.0)
      - max_tokens: Limite de tokens na resposta (opcional)
      - json_mode: Se True, força a saída em formato JSON válido
      
    Retorno:
      - str: Texto bruto da resposta

    Example:
        ```python
        resposta = chamar_chat(client, "Explique TIRADS 4 em linguagem simples.")
        dados = chamar_chat(
            client,
            "Extraia nome e idade em JSON.",
            json_mode=True,
        )
        ```
    """
    if isinstance(mensagem_ou_mensagens, str):
        msgs = []
        if system_prompt:
            msgs.append({"role": "system", "content": system_prompt})
        msgs.append({"role": "user", "content": mensagem_ou_mensagens})
    else:
        msgs = list(mensagem_ou_mensagens)
        if system_prompt:
            msgs.insert(0, {"role": "system", "content": system_prompt})

    kwargs: dict[str, Any] = {
        "model": model,
        "messages": msgs,
        "temperature": temperature,
    }

    if max_tokens is not None:
        kwargs["max_tokens"] = max_tokens

    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    res = client.chat.completions.create(**kwargs)
    return res.choices[0].message.content or ""


# =============================================================================
# 2. SAÍDA ESTRUTURADA PYDANTIC (STRUCTURED OUTPUTS)
# =============================================================================
def chamar_estruturado(
    client: OpenAI,
    mensagem_ou_mensagens: Union[str, list[dict[str, Any]]],
    schema_pydantic: Type[BaseModel],
    model: str = "gpt-4o-mini",
    system_prompt: str | None = None,
    temperature: float = 0.0,
) -> BaseModel:
    """
    Garante que o modelo retorne exatamente uma instância da classe Pydantic enviada.

    `schema_pydantic` é a classe, não uma instância. Os campos e descrições dela
    definem o contrato da saída, que a SDK valida antes de retornar. Este fluxo
    é diferente de `json_mode`: use-o quando código posterior depender de tipos
    e atributos específicos.
    
    Argumentos em tipos primitivos:
      - client: Instância de OpenAI()
      - mensagem_ou_mensagens: str simples ou list[dict]
      - schema_pydantic: A classe Pydantic (ex: MinhaEstrutura)
      - model: Nome do modelo ("gpt-4o-mini", "gpt-4o")
      - system_prompt: Instrução do sistema (opcional)
      - temperature: Padrão 0.0 para maior precisão estrutural
      
    Retorno:
      - Instância validada da classe Pydantic fornecida em schema_pydantic

    Example:
        ```python
        class Achado(BaseModel):
            tamanho_cm: float
            classificacao: str

        achado = chamar_estruturado(
            client, "Nódulo de 1,2 cm, TIRADS 4.", Achado
        )
        ```
    """
    if isinstance(mensagem_ou_mensagens, str):
        msgs = []
        if system_prompt:
            msgs.append({"role": "system", "content": system_prompt})
        msgs.append({"role": "user", "content": mensagem_ou_mensagens})
    else:
        msgs = list(mensagem_ou_mensagens)
        if system_prompt:
            msgs.insert(0, {"role": "system", "content": system_prompt})

    completion = client.beta.chat.completions.parse(
        model=model,
        messages=msgs,
        response_format=schema_pydantic,
        temperature=temperature,
    )
    
    parsed = completion.choices[0].message.parsed
    if parsed is None:
        raise ValueError("O modelo não retornou um objeto Pydantic válido.")
    return parsed


# =============================================================================
# 3. GERADOR DE DEFINIÇÃO DE TOOL (FUNCTION CALLING)
# =============================================================================
def criar_tool_schema(
    schema_pydantic: Type[BaseModel],
    nome_funcao: str | None = None,
    descricao: str | None = None,
) -> dict[str, Any]:
    """
    Converte uma classe Pydantic no dicionário de Tool aceito pelo client.chat.completions.create(tools=[...]).

    O schema descreve argumentos que o modelo pode pedir, mas não registra nem
    executa uma função Python. O chamador continua responsável por associar o
    nome a uma implementação, validar os argumentos e decidir se a ação pode
    realmente ocorrer.
    
    Argumentos em tipos primitivos:
      - schema_pydantic: Classe Pydantic que representa os argumentos da função
      - nome_funcao: Nome opcional da função (padrão é o nome da classe)
      - descricao: Descrição opcional da função
      
    Retorno:
      - dict: E.g. {"type": "function", "function": {"name": ..., "parameters": ...}}

    Example:
        ```python
        tool = criar_tool_schema(BuscarPaciente, "buscar_paciente")
        resposta = client.chat.completions.create(
            model="gpt-4o-mini", messages=mensagens, tools=[tool]
        )
        ```
    """
    tool_param = pydantic_function_tool(
        schema_pydantic,
        name=nome_funcao,
        description=descricao,
    )
    return dict(tool_param)


# =============================================================================
# 4. TRANSCRIÇÃO DE ÁUDIO (SPEECH-TO-TEXT / WHISPER)
# =============================================================================
def transcrever_audio(
    client: OpenAI,
    caminho_ou_bytes_audio: Union[str, Path, bytes],
    model: str = "whisper-1",
    idioma: str = "pt",
    prompt_contexto: str | None = None,
    formato_saida: Literal["text", "json", "srt", "vtt"] = "text",
) -> str:
    """
    Transcreve um arquivo de áudio (MP3, WAV, M4A, OGG) para texto.

    Caminhos são abertos somente durante a chamada; bytes são enviados como um
    arquivo em memória nomeado `audio.wav`. `idioma` reduz ambiguidade de
    detecção e `prompt_contexto` oferece vocabulário de apoio, sem substituir o
    áudio. O formato de saída define se o retorno contém texto, JSON ou legenda.
    
    Argumentos em tipos primitivos:
      - client: Instância de OpenAI()
      - caminho_ou_bytes_audio: Caminho do arquivo ("audio.mp3"), Path ou bytes puros do áudio
      - model: Modelo ("whisper-1")
      - idioma: Código ISO do idioma ("pt", "en", "es")
      - prompt_contexto: Palavras técnicas ou contexto pra guiar o Whisper
      - formato_saida: "text" (string pura), "json", "srt", "vtt"
      
    Retorno:
      - str: Texto transcrito (ou JSON/SRT codificado em string)

    Example:
        ```python
        texto = transcrever_audio(
            client, "consulta.m4a", prompt_contexto="TIRADS, Doppler, tireoide"
        )
        ```
    """
    if isinstance(caminho_ou_bytes_audio, (str, Path)):
        file_obj = open(caminho_ou_bytes_audio, "rb")
        close_file = True
    else:
        file_obj = ("audio.wav", caminho_ou_bytes_audio)  # tuple (filename, bytes)
        close_file = False

    try:
        kwargs: dict[str, Any] = {
            "model": model,
            "file": file_obj,
            "language": idioma,
            "response_format": formato_saida,
        }
        if prompt_contexto:
            kwargs["prompt"] = prompt_contexto

        res = client.audio.transcriptions.create(**kwargs)
        if isinstance(res, str):
            return res
        return getattr(res, "text", str(res))
    finally:
        if close_file and hasattr(file_obj, "close"):
            file_obj.close()


# =============================================================================
# 5. SÍNTESE DE VOZ (TEXT-TO-SPEECH / TTS)
# =============================================================================
def gerar_voz(
    client: OpenAI,
    texto: str,
    caminho_salvar_mp3: Union[str, Path] | None = None,
    voz: Literal["alloy", "echo", "fable", "onyx", "nova", "shimmer"] = "nova",
    model: str = "tts-1",
    formato: Literal["mp3", "opus", "aac", "flac", "pcm"] = "mp3",
) -> bytes:
    """
    Converte texto em áudio falado.

    A função sempre retorna bytes e opcionalmente persiste a mesma carga em
    `caminho_salvar_mp3`. O nome do parâmetro é histórico: quando usar outro
    `formato`, escolha uma extensão de destino compatível. `model` decide o
    equilíbrio entre latência e fidelidade; `voz` decide a locução.
    
    Argumentos em tipos primitivos:
      - client: Instância de OpenAI()
      - texto: Texto a ser falado
      - caminho_salvar_mp3: Caminho opcional pra salvar o arquivo direto (ex: "saida.mp3")
      - voz: Opções de voz ("alloy", "echo", "fable", "onyx", "nova", "shimmer")
      - model: "tts-1" (rápido/baixa latência) ou "tts-1-hd" (alta fidelidade)
      - formato: "mp3", "opus", "aac", "flac", "pcm"
      
    Retorno:
      - bytes: Conteúdo binário do áudio

    Example:
        ```python
        audio = gerar_voz(client, "Seu laudo está disponível.", "saida.mp3")
        ```
    """
    response = client.audio.speech.create(
        model=model,
        voice=voz,
        input=texto,
        response_format=formato,
    )
    audio_bytes = response.content

    if caminho_salvar_mp3:
        Path(caminho_salvar_mp3).write_bytes(audio_bytes)

    return audio_bytes


# =============================================================================
# 6. EMBEDDINGS (VETORES DE TEXTO)
# =============================================================================
def gerar_embeddings(
    client: OpenAI,
    texto_ou_textos: Union[str, list[str]],
    model: str = "text-embedding-3-small",
    dimensoes: int | None = None,
) -> list[list[float]]:
    """
    Gera vetores numéricos de embeddings para busca semântica ou RAG.

    Uma string é normalizada para uma lista de um elemento, portanto o retorno
    sempre é `list[list[float]]`. Ao reduzir `dimensoes`, mantenha o mesmo modelo
    e a mesma dimensão em todos os vetores que serão comparados ou indexados.
    
    Argumentos em tipos primitivos:
      - client: Instância de OpenAI()
      - texto_ou_textos: Uma string ("exame ultrassom") ou lista de strings ["t1", "t2"]
      - model: "text-embedding-3-small" (1536 dims) ou "text-embedding-3-large" (3072 dims)
      - dimensoes: Opcional, reduz o tamanho do vetor (ex: 512)
      
    Retorno:
      - list[list[float]]: Lista de vetores (cada vetor é uma list de floats)

    Example:
        ```python
        vetores = gerar_embeddings(client, ["laudo A", "laudo B"], dimensoes=512)
        ```
    """
    inputs = [texto_ou_textos] if isinstance(texto_ou_textos, str) else texto_ou_textos
    
    kwargs: dict[str, Any] = {
        "model": model,
        "input": inputs,
    }
    if dimensoes is not None:
        kwargs["dimensions"] = dimensoes

    res = client.embeddings.create(**kwargs)
    return [item.embedding for item in res.data]


# =============================================================================
# 7. GERAÇÃO DE IMAGENS (DALL-E 3)
# =============================================================================
def gerar_imagem(
    client: OpenAI,
    prompt: str,
    tamanho: Literal["1024x1024", "1792x1024", "1024x1792"] = "1024x1024",
    qualidade: Literal["standard", "hd"] = "standard",
    model: str = "dall-e-3",
) -> str:
    """
    Gera uma imagem a partir de uma descrição textual.

    O retorno é uma URL temporária, adequada para visualização imediata e não
    para armazenamento permanente. `tamanho` define a proporção e `qualidade`
    troca custo e detalhe; o wrapper fixa uma imagem por chamada e não expõe
    edição, máscara, bytes ou opções específicas de modelos mais novos.
    
    Argumentos em tipos primitivos:
      - client: Instância de OpenAI()
      - prompt: Descrição detalhada da imagem
      - tamanho: "1024x1024", "1792x1024", "1024x1792"
      - qualidade: "standard" ou "hd"
      - model: "dall-e-3"
      
    Retorno:
      - str: URL temporária da imagem gerada

    Example:
        ```python
        url = gerar_imagem(
            client, "Ilustração anatômica da tireoide, fundo branco."
        )
        ```
    """
    res = client.images.generate(
        model=model,
        prompt=prompt,
        size=tamanho,
        quality=qualidade,
        n=1,
    )
    return res.data[0].url or ""
