"""
================================================================================
OPENAI/audio.py — Transcrição de Áudio (Whisper / STT) + Síntese de Voz (TTS)
================================================================================
Cobre dois serviços de áudio completamente distintos:

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  STT (Speech-To-Text) — TRANSCRIÇÃO                                      │
  │  Serviço: client.audio.transcriptions.create(...)                        │
  │  Modelo: whisper-1, gpt-4o-transcribe, gpt-4o-mini-transcribe            │
  │                                                                          │
  │  TTS (Text-To-Speech) — SÍNTESE DE VOZ                                   │
  │  Serviço: client.audio.speech.create(...)                                │
  │  Modelos: tts-1, tts-1-hd, gpt-4o-mini-tts                              │
  └──────────────────────────────────────────────────────────────────────────┘

Formatos de áudio aceitos (STT):  mp3, mp4, mpeg, mpga, m4a, wav, webm, ogg
Formatos de áudio gerados (TTS):  mp3, opus, aac, flac, wav, pcm

Funções deste módulo:
  STT:
    - transcrever()          →  Transcrição simples de arquivo
    - transcrever_bytes()    →  Transcrição a partir de bytes de áudio (microfone/stream)
    - transcrever_detalhado()→  Transcrição com timestamps por palavra/segmento
  TTS:
    - falar()                →  Gera áudio a partir de texto (retorna bytes)
    - falar_para_arquivo()   →  Gera áudio e salva direto num arquivo
    - vozes_disponiveis()    →  Lista constante das vozes disponíveis

Todas as funções usam APENAS tipos primitivos como parâmetros:
  str, int, float, bool, bytes, list, dict, Path, Literal
================================================================================
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Literal

from openai import OpenAI


# ─────────────────────────────────────────────────────────────────────────────
# CONSTANTES DE REFERÊNCIA RÁPIDA
# ─────────────────────────────────────────────────────────────────────────────

# Modelos de transcrição disponíveis (STT)
MODELOS_STT = [
    "whisper-1",              # Clássico, rápido, multilíngue
    "gpt-4o-transcribe",      # Mais preciso, entende contexto
    "gpt-4o-mini-transcribe", # Mais rápido e barato, boa precisão
]

# Modelos de voz disponíveis (TTS)
MODELOS_TTS = [
    "tts-1",         # Rápido, baixa latência (bom para streaming)
    "tts-1-hd",      # Alta fidelidade (melhor para gravações finais)
    "gpt-4o-mini-tts", # Mais natural, segue instruções de estilo
]

# Vozes disponíveis
VOZES_TTS = ["alloy", "ash", "ballad", "coral", "echo", "fable", "onyx", "nova", "sage", "shimmer", "verse"]
# Recomendadas para PT-BR: "nova" (feminina, clara), "onyx" (masculina, grave), "shimmer" (feminina, suave)

# Formatos de saída TTS
FORMATOS_TTS = ["mp3", "opus", "aac", "flac", "wav", "pcm"]


# ─────────────────────────────────────────────────────────────────────────────
# STT — TRANSCRIÇÃO (Speech-To-Text)
# ─────────────────────────────────────────────────────────────────────────────

def transcrever(
    client: OpenAI,
    arquivo: str | Path,
    *,
    model: str = "whisper-1",
    idioma: str = "pt",
    prompt_contexto: str | None = None,
    temperature: float = 0.0,
) -> str:
    """
    Transcreve um arquivo de áudio para texto.

    `idioma` evita a etapa de detecção e tende a estabilizar a transcrição em
    gravações predominantemente monolíngues. `prompt_contexto` não é uma ordem
    para o modelo: é vocabulário de apoio, especialmente útil para siglas,
    nomes próprios e termos clínicos. Para timestamps, use
    `transcrever_detalhado()`; esta função escolhe `response_format="text"`
    justamente para retornar somente o texto.

    Args:
        client          : Instância de OpenAI()
        arquivo         : Caminho do arquivo de áudio local.
                          Formatos: mp3, mp4, mpeg, mpga, m4a, wav, webm, ogg
                          Tamanho máximo: 25 MB
        model           : Modelo de transcrição:
                            "whisper-1"              → clássico, rápido
                            "gpt-4o-transcribe"      → mais preciso
                            "gpt-4o-mini-transcribe" → mais barato
        idioma          : Código ISO 639-1 do idioma gravado:
                            "pt" = Português (melhora precisão significativamente)
                            "en" = Inglês, "es" = Espanhol, "de" = Alemão...
                            None = detecção automática (menos preciso)
        prompt_contexto : Texto com vocabulário técnico ou contexto do áudio.
                          Melhora MUITO a precisão de termos médicos!
                          Ex: "TIRADS, hipoecoico, vascularização, Doppler, TRUS"
        temperature     : 0.0 = mais determinístico/preciso (recomendado)

    Returns:
        str: Texto transcrito

    Example:
        >>> # Transcrição simples
        >>> texto = transcrever(client, "consulta.mp3")
        >>>
        >>> # Com contexto médico (muito mais preciso!)
        >>> texto = transcrever(
        ...     client,
        ...     "ultrassom.m4a",
        ...     idioma="pt",
        ...     prompt_contexto="TIRADS, hipoecoico, nódulo tireoide, vascularização periférica",
        ... )
    """
    kwargs: dict[str, Any] = {
        "model": model,
        "response_format": "text",
        "temperature": temperature,
    }
    if idioma:
        kwargs["language"] = idioma
    if prompt_contexto:
        kwargs["prompt"] = prompt_contexto

    with open(arquivo, "rb") as f:
        kwargs["file"] = f
        res = client.audio.transcriptions.create(**kwargs)

    return str(res) if isinstance(res, str) else getattr(res, "text", str(res))


def transcrever_bytes(
    client: OpenAI,
    audio_bytes: bytes,
    nome_arquivo: str = "audio.wav",
    *,
    model: str = "whisper-1",
    idioma: str = "pt",
    prompt_contexto: str | None = None,
) -> str:
    """
    Transcreve áudio diretamente de bytes — útil para microfone, streams ou
    quando o áudio já está carregado em memória.

    `nome_arquivo` não cria nada no disco: ele fornece à API a extensão que
    identifica o container do áudio. Use bytes quando a captura já está em
    memória; para arquivos existentes, `transcrever()` evita que o programa
    precise carregar tudo de uma vez. Os demais parâmetros têm a mesma
    semântica de `transcrever()`.

    Args:
        client          : Instância de OpenAI()
        audio_bytes     : Bytes brutos do áudio
        nome_arquivo    : Nome fictício para a API identificar o formato.
                          Use a extensão correta: "audio.wav", "audio.mp3", etc.
        model           : Modelo de transcrição (ver transcrever())
        idioma          : Código ISO 639-1 do idioma
        prompt_contexto : Vocabulário técnico para melhorar precisão

    Returns:
        str: Texto transcrito

    Example:
        >>> # Lendo de um arquivo (mas poderia vir de microfone)
        >>> with open("audio.wav", "rb") as f:
        ...     audio_bytes = f.read()
        >>> texto = transcrever_bytes(client, audio_bytes, "audio.wav", idioma="pt")
        >>>
        >>> # Com microfone (usando sounddevice):
        >>> import sounddevice as sd, numpy as np, scipy.io.wavfile as wav, io
        >>> gravacao = sd.rec(int(5 * 44100), samplerate=44100, channels=1, dtype='int16')
        >>> sd.wait()
        >>> buf = io.BytesIO()
        >>> wav.write(buf, 44100, gravacao)
        >>> texto = transcrever_bytes(client, buf.getvalue(), "audio.wav")
    """
    kwargs: dict[str, Any] = {
        "model": model,
        "file": (nome_arquivo, audio_bytes),
        "response_format": "text",
    }
    if idioma:
        kwargs["language"] = idioma
    if prompt_contexto:
        kwargs["prompt"] = prompt_contexto

    res = client.audio.transcriptions.create(**kwargs)
    return str(res) if isinstance(res, str) else getattr(res, "text", str(res))


def transcrever_detalhado(
    client: OpenAI,
    arquivo: str | Path,
    *,
    model: str = "whisper-1",
    idioma: str = "pt",
    granularidade: list[Literal["word", "segment"]] | None = None,
    prompt_contexto: str | None = None,
) -> dict[str, Any]:
    """
    Transcrição com metadados: timestamps de início/fim por palavra ou segmento.

    Útil para sincronizar texto com áudio, legendagem ou análise de fala.
    `granularidade` define o custo e o volume de detalhe: segmentos bastam para
    legendas usuais; palavras são necessárias para karaokê, destaque sincronizado
    ou métricas temporais. O formato detalhado retornado aqui é normalizado em
    dicionário para não expor objetos internos da SDK.

    Args:
        client          : Instância de OpenAI()
        arquivo         : Caminho do arquivo de áudio
        model           : Modelo de transcrição
        idioma          : Código ISO do idioma
        granularidade   : Nível de detalhe dos timestamps:
                            ["word"]    → timestamp por PALAVRA
                            ["segment"] → timestamp por FRASE/SEGMENTO
                            ["word", "segment"] → ambos
                            None → sem timestamps (usa padrão segment)
        prompt_contexto : Vocabulário técnico para melhorar precisão

    Returns:
        dict com campos:
          - "text"    : str — texto completo transcrito
          - "segments": list[dict] — segmentos com "start", "end", "text"
          - "words"   : list[dict] — palavras com "start", "end", "word"
                        (só presente se "word" estava em granularidade)
          - "language": str — idioma detectado
          - "duration": float — duração total em segundos

    Example:
        >>> resultado = transcrever_detalhado(
        ...     client, "consulta.mp3",
        ...     granularidade=["segment"],
        ... )
        >>> print(resultado["text"])
        >>> for seg in resultado["segments"]:
        ...     print(f"[{seg['start']:.1f}s] {seg['text']}")
    """
    kwargs: dict[str, Any] = {
        "model": model,
        "response_format": "verbose_json",
    }
    if idioma:
        kwargs["language"] = idioma
    if prompt_contexto:
        kwargs["prompt"] = prompt_contexto
    if granularidade:
        kwargs["timestamp_granularities"] = granularidade

    with open(arquivo, "rb") as f:
        kwargs["file"] = f
        res = client.audio.transcriptions.create(**kwargs)

    return {
        "text":     getattr(res, "text", ""),
        "segments": getattr(res, "segments", []),
        "words":    getattr(res, "words", []),
        "language": getattr(res, "language", ""),
        "duration": getattr(res, "duration", 0.0),
    }


# ─────────────────────────────────────────────────────────────────────────────
# TTS — SÍNTESE DE VOZ (Text-To-Speech)
# ─────────────────────────────────────────────────────────────────────────────

def falar(
    client: OpenAI,
    texto: str,
    *,
    model: str = "tts-1",
    voz: Literal["alloy", "ash", "ballad", "coral", "echo", "fable", "onyx", "nova", "sage", "shimmer", "verse"] = "nova",
    formato: Literal["mp3", "opus", "aac", "flac", "wav", "pcm"] = "mp3",
    velocidade: float = 1.0,
    instrucoes_estilo: str | None = None,
) -> bytes:
    """
    Converte texto em áudio falado e retorna os bytes do arquivo de áudio.

    Escolha `model` pelo objetivo: `tts-1` favorece latência, `tts-1-hd`
    favorece fidelidade e `gpt-4o-mini-tts` aceita `instrucoes_estilo`.
    `formato` decide o container dos bytes retornados; ele não altera o texto.
    `velocidade` muda a cadência dentro do intervalo aceito pela API. Este
    helper retorna memória bruta; para persistir diretamente, use
    `falar_para_arquivo()`.

    Args:
        client            : Instância de OpenAI()
        texto             : Texto a ser narrado (até ~4096 caracteres)
        model             : Modelo TTS:
                              "tts-1"           → rápido, baixa latência
                              "tts-1-hd"        → alta fidelidade
                              "gpt-4o-mini-tts" → mais natural, segue instruções
        voz               : Nome da voz:
                              "nova"    → feminina, clara, profissional ✅ PT-BR
                              "onyx"    → masculina, grave, autoritativa ✅ PT-BR
                              "shimmer" → feminina, suave, acolhedora
                              "alloy"   → neutra, versátil
                              "echo"    → masculina, leve ressonância
                              "fable"   → dramática, expressiva
                              "ash", "ballad", "coral", "sage", "verse" → novas
        formato           : Formato do áudio de saída:
                              "mp3"  → universal, comprimido (recomendado)
                              "wav"  → sem perda, maior arquivo
                              "opus" → ótimo para streaming VoIP
                              "aac"  → bom para iOS/Safari
                              "flac" → sem perda, melhor compressão que WAV
                              "pcm"  → áudio bruto (para processamento direto)
        velocidade        : Velocidade da fala (0.25 a 4.0, padrão 1.0)
        instrucoes_estilo : Instrução de estilo (só funciona com gpt-4o-mini-tts):
                              Ex: "Fale de forma calma e pausada como um médico"

    Returns:
        bytes: Conteúdo binário do áudio no formato especificado

    Example:
        >>> # Narrar e reproduzir (usando pygame ou sounddevice)
        >>> audio = falar(client, "Nódulo hipoecoico classificado como TIRADS 4.")
        >>> with open("saida.mp3", "wb") as f:
        ...     f.write(audio)
        >>>
        >>> # Voz com instrução de estilo (requer gpt-4o-mini-tts)
        >>> audio = falar(
        ...     client,
        ...     "Os achados indicam esteatose hepática grau II.",
        ...     model="gpt-4o-mini-tts",
        ...     voz="onyx",
        ...     instrucoes_estilo="Tom calmo de radiologista explicando resultado para paciente.",
        ... )
    """
    kwargs: dict[str, Any] = {
        "model": model,
        "input": texto,
        "voice": voz,
        "response_format": formato,
        "speed": velocidade,
    }
    if instrucoes_estilo is not None:
        kwargs["instructions"] = instrucoes_estilo

    res = client.audio.speech.create(**kwargs)
    return res.content


def falar_para_arquivo(
    client: OpenAI,
    texto: str,
    destino: str | Path,
    *,
    model: str = "tts-1",
    voz: Literal["alloy", "ash", "ballad", "coral", "echo", "fable", "onyx", "nova", "sage", "shimmer", "verse"] = "nova",
    formato: Literal["mp3", "opus", "aac", "flac", "wav", "pcm"] = "mp3",
    velocidade: float = 1.0,
    instrucoes_estilo: str | None = None,
) -> Path:
    """
    Converte texto em áudio e salva DIRETAMENTE no arquivo especificado.
    Cria os diretórios pai se necessário.

    A função delega a geração a `falar()` e só então grava os bytes. Portanto,
    a extensão em `destino` deve corresponder a `formato` para que players e
    sistemas operacionais reconheçam corretamente o arquivo resultante.

    Args:
        client            : Instância de OpenAI()
        texto             : Texto a ser narrado
        destino           : Caminho do arquivo de saída ("saida.mp3" ou Path)
        model             : Modelo TTS (ver falar())
        voz               : Nome da voz (ver falar())
        formato           : Formato de saída (ver falar())
        velocidade        : 0.25 a 4.0 (padrão 1.0)
        instrucoes_estilo : Instrução de estilo (só gpt-4o-mini-tts)

    Returns:
        Path: O caminho do arquivo salvo

    Example:
        >>> caminho = falar_para_arquivo(
        ...     client,
        ...     "Relatório de ultrassom gerado com sucesso.",
        ...     "Users/anders/Patients/Joao/audio_laudo.mp3",
        ...     voz="nova",
        ... )
        >>> print(f"Áudio salvo em: {caminho}")
    """
    audio_bytes = falar(
        client,
        texto,
        model=model,
        voz=voz,
        formato=formato,
        velocidade=velocidade,
        instrucoes_estilo=instrucoes_estilo,
    )

    destino = Path(destino)
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_bytes(audio_bytes)
    return destino


def vozes_disponiveis() -> dict[str, str]:
    """
    Devolve um dict com todas as vozes disponíveis e suas descrições.
    Útil para exibir em interfaces de seleção.

    É um catálogo local para a UI, sem chamada de rede e sem garantia de que
    toda voz esteja disponível em todo modelo. Valide a combinação escolhida
    com o modelo TTS antes de oferecê-la como preferência fixa ao usuário.

    Returns:
        dict[str, str]: {"nome_da_voz": "descrição"}

    Example:
        >>> for nome, descricao in vozes_disponiveis().items():
        ...     print(f"{nome}: {descricao}")
    """
    return {
        "alloy":   "Neutra, versátil, boa para conteúdo geral",
        "ash":     "Suave, moderna, jovem",
        "ballad":  "Melódica, expressiva, narrativa",
        "coral":   "Calorosa, feminina, acolhedora",
        "echo":    "Masculina, com leve ressonância",
        "fable":   "Dramática, expressiva, storytelling",
        "nova":    "Feminina, clara e profissional ✅ Recomendada PT-BR",
        "onyx":    "Masculina, grave e autoritativa ✅ Recomendada PT-BR",
        "sage":    "Inteligente, articulada, confiante",
        "shimmer": "Feminina, suave e acolhedora",
        "verse":   "Dinâmica, adaptável ao contexto",
    }
