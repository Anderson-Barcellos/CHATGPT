"""
================================================================================
OPENAI/tools.py — Function Calling, Tool Schemas e Structured Output Pydantic
================================================================================
Cobre a infraestrutura de "Tools" da OpenAI — o mecanismo pelo qual o modelo
decide chamar funções externas em vez de (ou além de) gerar texto livre.

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  COMO FUNCIONA O FUNCTION CALLING?                                       │
  │                                                                          │
  │  1. Tu registra uma "tool" com nome, descrição e parâmetros esperados   │
  │  2. O modelo decide se usa a ferramenta ou responde com texto puro       │
  │  3. Se usar, devolve um JSON com os argumentos que ele "quer" passar     │
  │  4. Tu executa a função real com esses argumentos                        │
  │  5. (Opcional) Devolve o resultado para o modelo continuar a conversa    │
  └──────────────────────────────────────────────────────────────────────────┘

Funções deste módulo:
  - schema_de_pydantic()    →  Converte classe Pydantic → dict de tool schema
  - chamar_com_tools()      →  Executa chat passando tools, retorna resultado
                               da função chamada diretamente
  - chamar_parallel_tools() →  Chat com múltiplas tools em paralelo
  - extrair_chamadas()      →  Extrai as chamadas de ferramentas de uma resposta
  - responder_com_resultado()→  Continua conversa devolvendo resultado da tool

Todas as funções usam APENAS tipos primitivos como parâmetros:
  str, int, float, bool, bytes, list, dict, Path, Type[BaseModel], Callable
================================================================================
"""

from __future__ import annotations

import json
from typing import Any, Callable, Type

from openai import OpenAI
from openai.lib._tools import pydantic_function_tool
from pydantic import BaseModel


# ─────────────────────────────────────────────────────────────────────────────
# GERAÇÃO DE SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────

def schema_de_pydantic(
    modelo_pydantic: Type[BaseModel],
    *,
    nome: str | None = None,
    descricao: str | None = None,
) -> dict[str, Any]:
    """
    Converte uma classe Pydantic no dicionário de "tool" aceito pela API.

    O resultado pode ser passado diretamente para o parâmetro `tools=[...]`
    em qualquer chamada de chat.completions.create().

    A classe descreve somente o contrato que o modelo pode solicitar; ela não
    executa código. `Field(description=...)`, `nome` e `descricao` fazem parte
    do contexto que orienta a escolha da tool, então descreva intenção e limites
    de negócio em vez de expor detalhes internos da implementação.

    Args:
        modelo_pydantic : A CLASSE Pydantic (não instância!) que representa
                          os argumentos da função.
                          Os `Field(description=...)` de cada campo viram
                          a documentação dos parâmetros para o modelo.
        nome            : Nome da função (padrão: nome da classe em snake_case)
        descricao       : Descrição do que a função faz (o modelo usa isso
                          para decidir quando chamar essa tool)

    Returns:
        dict: Schema no formato:
              {"type": "function", "function": {"name": ..., "description": ...,
               "parameters": {"type": "object", "properties": {...}, ...}}}

    Example:
        >>> from pydantic import BaseModel, Field
        >>>
        >>> class BuscarPaciente(BaseModel):
        ...     nome: str = Field(description="Nome completo do paciente")
        ...     cpf: str | None = Field(None, description="CPF (opcional)")
        ...
        >>> tool = schema_de_pydantic(
        ...     BuscarPaciente,
        ...     nome="buscar_paciente",
        ...     descricao="Busca um paciente na base de dados pelo nome ou CPF",
        ... )
        >>> # Usar em chat.completions.create(tools=[tool])
    """
    return dict(pydantic_function_tool(modelo_pydantic, name=nome, description=descricao))


def schemas_de_varios(
    *pares: tuple[Type[BaseModel], str, str],
) -> list[dict[str, Any]]:
    """
    Cria schemas de múltiplas tools de uma vez.

    Cada tupla mantém junto o schema, o nome público e a descrição que o modelo
    receberá. Use nomes distintos e descrições que não se sobreponham: a SDK
    não resolve ambiguidade entre duas funções que parecem fazer a mesma coisa.

    Args:
        *pares : Cada par é uma tupla (ClassePydantic, "nome_funcao", "descrição")

    Returns:
        list[dict]: Lista de tool schemas prontos para tools=[...]

    Example:
        >>> tools = schemas_de_varios(
        ...     (BuscarPaciente,  "buscar_paciente",  "Busca paciente por nome"),
        ...     (SalvarLaudo,     "salvar_laudo",     "Salva laudo no banco"),
        ...     (GerarPDF,        "gerar_pdf",        "Gera PDF do relatório"),
        ... )
        >>> # Usar em client.chat.completions.create(tools=tools)
    """
    return [
        schema_de_pydantic(classe, nome=nome, descricao=descricao)
        for classe, nome, descricao in pares
    ]


# ─────────────────────────────────────────────────────────────────────────────
# USO DAS TOOLS
# ─────────────────────────────────────────────────────────────────────────────

def extrair_chamadas(response_message: Any) -> list[dict[str, Any]]:
    """
    Extrai as chamadas de ferramentas de uma mensagem de resposta da API.

    Esta função apenas interpreta o pedido do modelo; não valida autorização e
    não executa a ferramenta. `args` contém o JSON decodificado para o caminho
    comum, enquanto `args_raw` preserva a carga original para auditoria ou para
    tratar erro de parsing sem perder o que foi solicitado.

    Args:
        response_message : O objeto `choices[0].message` de uma resposta de
                           chat.completions.create()

    Returns:
        list[dict]: Lista de chamadas. Cada dict contém:
          - "id"        : str  — ID único desta chamada (necessário para responder)
          - "nome"      : str  — Nome da função que o modelo quer chamar
          - "args"      : dict — Argumentos que o modelo quer passar (já parseados de JSON)
          - "args_raw"  : str  — JSON bruto dos argumentos (para debug)

    Example:
        >>> res = client.chat.completions.create(
        ...     model="gpt-4o-mini",
        ...     messages=[{"role": "user", "content": "Busque o paciente João"}],
        ...     tools=[schema_de_pydantic(BuscarPaciente, nome="buscar_paciente")],
        ... )
        >>> msg = res.choices[0].message
        >>> chamadas = extrair_chamadas(msg)
        >>> for c in chamadas:
        ...     print(c["nome"], c["args"])
        # buscar_paciente {'nome': 'João', 'cpf': None}
    """
    tool_calls = getattr(response_message, "tool_calls", None)
    if not tool_calls:
        return []

    resultado = []
    for tc in tool_calls:
        try:
            args = json.loads(tc.function.arguments)
        except json.JSONDecodeError:
            args = {}
        resultado.append({
            "id":       tc.id,
            "nome":     tc.function.name,
            "args":     args,
            "args_raw": tc.function.arguments,
        })
    return resultado


def chamar_com_tools(
    client: OpenAI,
    mensagem: str | list[dict[str, Any]],
    tools: list[dict[str, Any]],
    funcoes: dict[str, Callable[..., Any]],
    *,
    model: str = "gpt-4o-mini",
    system_prompt: str | None = None,
    temperature: float = 0.0,
    tool_choice: str = "auto",
) -> dict[str, Any]:
    """
    Executa chat com tools e chama automaticamente as funções quando o modelo
    solicita, retornando os resultados de todas as chamadas realizadas.

    Este helper cobre somente a primeira metade do loop: envia schemas, recebe
    `tool_calls` e executa as funções locais registradas em `funcoes`. A saída
    de uma função é dado não confiável até ser validada pela aplicação; não use
    este wrapper para ações irreversíveis sem uma camada explícita de autorização.
    Para que o modelo transforme os resultados em resposta final, continue com
    `responder_com_resultado()`.

    Args:
        client      : Instância de OpenAI()
        mensagem    : str ou list[dict] com a mensagem do usuário
        tools       : Lista de schemas de tools (output de schema_de_pydantic())
        funcoes     : Dict mapeando nome_da_tool → função Python real a executar.
                      A função receberá os argumentos como **kwargs.
        model       : Nome do modelo
        system_prompt: Instrução de sistema
        temperature : Padrão 0.0 para chamadas de ferramentas
        tool_choice : "auto"     → modelo decide se usa tool ou texto livre
                      "required" → força o uso de alguma tool
                      "none"     → proíbe uso de tools (texto puro)

    Returns:
        dict com campos:
          - "texto"         : str  — texto de resposta livre (se gerou texto)
          - "tool_calls"    : list[dict] — chamadas feitas com nome e args
          - "resultados"    : dict[str, Any] — {nome_funcao: resultado_retornado}
          - "finish_reason" : str  — "tool_calls", "stop", etc.

    Example:
        >>> from pydantic import BaseModel, Field
        >>>
        >>> class BuscarPaciente(BaseModel):
        ...     nome: str = Field(description="Nome do paciente")
        ...
        >>> def buscar_paciente_real(nome: str) -> dict:
        ...     return {"id": 42, "nome": nome, "cpf": "123.456.789-00"}
        ...
        >>> resultado = chamar_com_tools(
        ...     client,
        ...     "Busque o paciente João Silva",
        ...     tools=[schema_de_pydantic(BuscarPaciente, nome="buscar_paciente")],
        ...     funcoes={"buscar_paciente": buscar_paciente_real},
        ... )
        >>> print(resultado["resultados"]["buscar_paciente"])
        # {'id': 42, 'nome': 'João Silva', 'cpf': '123.456.789-00'}
    """
    msgs: list[dict[str, Any]] = []
    if system_prompt:
        msgs.append({"role": "system", "content": system_prompt})

    if isinstance(mensagem, str):
        msgs.append({"role": "user", "content": mensagem})
    else:
        msgs.extend(mensagem)

    res = client.chat.completions.create(
        model=model,
        messages=msgs,
        tools=tools,
        tool_choice=tool_choice,
        temperature=temperature,
    )

    choice = res.choices[0]
    msg = choice.message
    finish_reason = choice.finish_reason

    chamadas = extrair_chamadas(msg)
    resultados: dict[str, Any] = {}

    for chamada in chamadas:
        nome_fn = chamada["nome"]
        args = chamada["args"]
        if nome_fn in funcoes:
            try:
                resultados[nome_fn] = funcoes[nome_fn](**args)
            except Exception as e:
                resultados[nome_fn] = {"erro": str(e)}
        else:
            resultados[nome_fn] = {"erro": f"Função '{nome_fn}' não registrada em `funcoes`"}

    return {
        "texto":         msg.content or "",
        "tool_calls":    chamadas,
        "resultados":    resultados,
        "finish_reason": finish_reason,
    }


def responder_com_resultado(
    client: OpenAI,
    historico_msgs: list[dict[str, Any]],
    msg_assistente_com_tool_calls: Any,
    resultados_tools: list[dict[str, str | Any]],
    *,
    model: str = "gpt-4o-mini",
    temperature: float = 0.2,
) -> str:
    """
    Devolve ao modelo o resultado de chamadas de tools para que ele continue
    a conversa e gere uma resposta final em texto natural.

    Isso fecha o loop do Function Calling multi-turno:
      1. Usuário pergunta
      2. Modelo chama tool → extrair_chamadas()
      3. Tu executa as funções
      4. AQUI: devolves os resultados → modelo responde em linguagem natural

    `msg_assistente_com_tool_calls` precisa ser exatamente a mensagem que criou
    os IDs das chamadas, e cada item em `resultados_tools` precisa devolver o
    `tool_call_id` correspondente. A API usa essa associação para manter a
    conversa íntegra; trocar IDs, resumir a mensagem ou omitir um resultado
    pode invalidar o turno.

    Args:
        client                        : Instância de OpenAI()
        historico_msgs                : Histórico de mensagens até agora (role user/system/assistant)
        msg_assistente_com_tool_calls : O objeto `choices[0].message` da resposta
                                        anterior que continha tool_calls
        resultados_tools              : Lista de dicts com:
                                          - "tool_call_id" : str — ID da chamada (do extrair_chamadas())
                                          - "nome"         : str — nome da função
                                          - "resultado"    : Any — o que a função retornou
        model       : Nome do modelo
        temperature : 0.0 a 2.0

    Returns:
        str: Resposta final do modelo em linguagem natural incorporando os resultados

    Example:
        >>> # Após chamar buscar_paciente_real() e obter o resultado:
        >>> historico = [{"role": "user", "content": "Busque o paciente João Silva"}]
        >>> chamadas = extrair_chamadas(msg_anterior)
        >>>
        >>> resposta_final = responder_com_resultado(
        ...     client,
        ...     historico,
        ...     msg_anterior,
        ...     [{"tool_call_id": chamadas[0]["id"],
        ...       "nome": "buscar_paciente",
        ...       "resultado": {"id": 42, "nome": "João Silva"}}],
        ... )
        >>> print(resposta_final)
        # "Encontrei o paciente João Silva com ID 42 no sistema."
    """
    msgs = list(historico_msgs)
    msgs.append(msg_assistente_com_tool_calls)  # A mensagem do assistente com tool_calls

    for item in resultados_tools:
        msgs.append({
            "role":         "tool",
            "tool_call_id": item["tool_call_id"],
            "name":         item["nome"],
            "content":      json.dumps(item["resultado"], ensure_ascii=False, default=str),
        })

    res = client.chat.completions.create(
        model=model,
        messages=msgs,
        temperature=temperature,
    )
    return res.choices[0].message.content or ""
