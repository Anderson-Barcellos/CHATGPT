"""
================================================================================
KIVYMD/inputs.py — Campos de Texto e Entradas de Dados (KivyMD)
================================================================================
Cobre a criação de campos de entrada de texto e formulários no KivyMD:

  - MDTextField            → Campo de texto padrão Material (com floating label)
  - MDTextFieldRect        → Campo de texto retangular simples

Todas as funções usam APENAS tipos primitivos como parâmetros:
  str, bool, tuple[float, float], dict, Callable
================================================================================
"""

from typing import Callable, Any
from kivymd.uix.textfield import MDTextField, MDTextFieldRect


def campo_texto(
    hint_text: str = "",
    text: str = "",
    helper_text: str = "",
    helper_text_mode: str = "on_focus",  # "on_focus", "persistent", "on_error"
    icon_right: str | None = None,
    icon_left: str | None = None,
    password: bool = False,
    multiline: bool = False,
    required: bool = False,
    mode: str = "line",  # "line", "rectangle", "fill", "round"
    size_hint_x: float | None = 1.0,
    size_hint_y: float | None = None,
    pos_hint: dict[str, float] | None = None,
    on_text_validate: Callable[[Any], None] | None = None,
) -> MDTextField:
    """
    Cria um campo de texto Material Design com floating label (MDTextField).

    Args:
        hint_text        : Rótulo flutuante / Dica (ex: "Nome do Paciente")
        text             : Texto inicial do campo
        helper_text      : Texto de ajuda abaixo do campo (ex: "Digite o nome completo")
        helper_text_mode : Modo do texto de ajuda ("on_focus", "persistent", "on_error")
        icon_right       : Ícone no canto direito (ex: "magnify", "account", "eye")
        icon_left        : Ícone no canto esquerdo
        password         : True se for campo de senha (oculta caracteres)
        multiline        : True para permitir múltiplas linhas (ex: laudos longos)
        required         : True se o preenchimento for obrigatório
        mode             : Modo visual ("line", "rectangle", "fill", "round")
        size_hint_x      : Largura relativa
        size_hint_y      : Altura relativa
        pos_hint         : Posição relativa
        on_text_validate : Callback chamado ao pressionar Enter

    Returns:
        MDTextField

    Example:
        >>> field = campo_texto(
        ...     hint_text="ID do Exame / Paciente",
        ...     icon_right="account-search",
        ...     on_text_validate=lambda widget: print("Buscando:", widget.text)
        ... )
    """
    kwargs: dict[str, Any] = {
        "hint_text": hint_text,
        "text": text,
        "helper_text": helper_text,
        "helper_text_mode": helper_text_mode,
        "password": password,
        "multiline": multiline,
        "required": required,
        "size_hint_x": size_hint_x,
    }
    if hasattr(MDTextField, "mode"):
        kwargs["mode"] = mode

    tf = MDTextField(**kwargs)
    if size_hint_y is not None:
        tf.size_hint_y = size_hint_y
    if icon_right:
        tf.icon_right = icon_right
    if icon_left:
        tf.icon_left = icon_left
    if pos_hint:
        tf.pos_hint = pos_hint
    if on_text_validate:
        tf.bind(on_text_validate=on_text_validate)
    return tf


def campo_pesquisa(
    hint_text: str = "Pesquisar...",
    icon_right: str = "magnify",
    on_text_validate: Callable[[Any], None] | None = None,
    size_hint_x: float | None = 0.9,
    pos_hint: dict[str, float] | None = None,
) -> MDTextField:
    """
    Cria um campo de busca com ícone de lupa.

    Args:
        hint_text        : Texto da dica
        icon_right       : Ícone à direita (padrão: "magnify")
        on_text_validate : Callback ao dar Enter na busca
        size_hint_x      : Largura relativa
        pos_hint         : Posição relativa

    Returns:
        MDTextField
    """
    return campo_texto(
        hint_text=hint_text,
        icon_right=icon_right,
        size_hint_x=size_hint_x,
        pos_hint=pos_hint,
        on_text_validate=on_text_validate,
        mode="rectangle",
    )
