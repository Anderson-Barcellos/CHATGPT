# 🗺️ GUIA RÁPIDO & MAPA PRIMITIVO DA OPENAI (VERTEX V2)

Este repositório/módulo foi construído para **eliminar a necessidade de decifrar as dataclasses e tipos genéricos da SDK oficial** (`ChatCompletionMessageParam`, `FileTypes`, `NotGiven`, etc.) e permitir que tu chame qualquer serviço da OpenAI passando **apenas tipos primitivos nativos do Python** (`str`, `int`, `float`, `bool`, `bytes`, `list[dict]`, `dict`, `Path`).

---

## 📍 Onde achar cada serviço na SDK oficial (`client = OpenAI()`)

| Serviço | Caminho exato na SDK oficial | Wrapper simplificado neste módulo (`OPENAI`) |
| :--- | :--- | :--- |
| **Texto / Chat** | `client.chat.completions.create(...)` | `chamar_chat(client, ...)` |
| **Visão (Imagens)** | `client.chat.completions.create(...)` | `chamar_chat(client, ...)` |
| **Saída Estruturada (Pydantic)** | `client.beta.chat.completions.parse(...)` | `chamar_estruturado(client, ...)` |
| **Function Calling (Tools)** | `openai.lib._tools.pydantic_function_tool(...)` | `criar_tool_schema(...)` |
| **Transcrição (Whisper)** | `client.audio.transcriptions.create(...)` | `transcrever_audio(client, ...)` |
| **Síntese de Voz (TTS)** | `client.audio.speech.create(...)` | `gerar_voz(client, ...)` |
| **Embeddings (Vetores)** | `client.embeddings.create(...)` | `gerar_embeddings(client, ...)` |
| **Geração de Imagem (DALL-E)** | `client.images.generate(...)` | `gerar_imagem(client, ...)` |

---

## 🛠️ Assinaturas de Parâmetros Primitivos

### 1. Texto / Visão (`chamar_chat`)
* **`mensagem_ou_mensagens`**: `str` **OU** `list[dict]`
  * Exemplo texto simples: `"Analise este laudo"`
  * Exemplo visão: `[{"role": "user", "content": [{"type": "text", "text": "O que vê nesta imagem?"}, {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,..."}}]}]`
* **`model`**: `str` (`"gpt-4o"`, `"gpt-4o-mini"`)
* **`system_prompt`**: `str` opcional (ex: `"Você é um radiologista experiente."`)
* **`temperature`**: `float` (`0.0` a `2.0`, padrão `0.2`)
* **`max_tokens`**: `int` opcional
* **`json_mode`**: `bool` (se `True`, força resposta em JSON sintaticamente válido)

### 2. Saída Estruturada Pydantic (`chamar_estruturado`)
* **`mensagem_ou_mensagens`**: `str` **OU** `list[dict]`
* **`schema_pydantic`**: `Type[BaseModel]` (a própria classe Pydantic, ex: `MeusDados`)
* **`model`**: `str` (`"gpt-4o-mini"`)
* **`temperature`**: `float` (padrão `0.0`)
* **Retorno**: Instância validada e tipada da tua classe Pydantic!

### 3. Tool Calling Schema (`criar_tool_schema`)
* **`schema_pydantic`**: `Type[BaseModel]` (Classe com a estrutura dos argumentos)
* **`nome_funcao`**: `str` opcional (padrão é o nome da classe Pydantic)
* **`descricao`**: `str` opcional
* **Retorno**: `dict` no formato exato esperado por `tools=[...]`

### 4. Transcrição de Áudio (`transcrever_audio`)
* **`caminho_ou_bytes_audio`**: `str` ("audio.mp3") **OU** `Path` **OU** `bytes`
* **`model`**: `str` (`"whisper-1"`)
* **`idioma`**: `str` (`"pt"`, `"en"`)
* **`prompt_contexto`**: `str` opcional (palavras técnicas como "ecocardiograma", "tirads")
* **`formato_saida`**: `str` (`"text"`, `"json"`, `"srt"`, `"vtt"`)

### 5. Geração de Voz / TTS (`gerar_voz`)
* **`texto`**: `str` (texto a ser narrado)
* **`caminho_salvar_mp3`**: `str` **OU** `Path` opcional (onde salvar o arquivo)
* **`voz`**: `str` (`"alloy"`, `"echo"`, `"fable"`, `"onyx"`, `"nova"`, `"shimmer"`)
* **`model`**: `str` (`"tts-1"`, `"tts-1-hd"`)
* **`formato`**: `str` (`"mp3"`, `"opus"`, `"aac"`, `"flac"`, `"pcm"`)

### 6. Embeddings (`gerar_embeddings`)
* **`texto_ou_textos`**: `str` **OU** `list[str]`
* **`model`**: `str` (`"text-embedding-3-small"`, `"text-embedding-3-large"`)
* **`dimensoes`**: `int` opcional (ex: `512`)
* **Retorno**: `list[list[float]]` (matriz de vetores)

---

## 🚀 Exemplo de Uso Prático no Teu Código

```python
from openai import OpenAI
from OPENAI import chamar_chat, chamar_estruturado, gerar_voz
from pydantic import BaseModel, Field

client = OpenAI()

# 1. Chamada simples de chat:
resposta_texto = chamar_chat(client, "Resuma a anatomia da tireoide em 2 frases.")

# 2. Chamada estruturada com Pydantic:
class DiagnosticSummary(BaseModel):
    orgao: str
    diagnostico: str
    gravidade: int = Field(description="1 a 5")

res_pydantic = chamar_estruturado(
    client,
    mensagem_ou_mensagens="Paciente com nódulo sólido hipoecoico de 2cm na tireoide.",
    schema_pydantic=DiagnosticSummary
)

print(res_pydantic.orgao)        # "Tireoide"
print(res_pydantic.diagnostico)  # "Nódulo sólido hipoecoico"

# 3. Gerar áudio MP3 da resposta:
gerar_voz(client, resposta_texto, caminho_salvar_mp3="resposta.mp3")
```
