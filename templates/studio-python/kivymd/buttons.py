"""
================================================================================
KIVYMD/buttons.py — Botões Material Design (KivyMD)
================================================================================
Cobre a criação de botões no KivyMD utilizando parâmetros primitivos:

  - MDRaisedButton            → Botão elevado preenchido (destaque principal)
  - MDRectangleFlatButton     → Botão plano retangular com borda
  - MDRoundFlatButton         → Botão plano arredondado
  - MDFillRoundFlatButton     → Botão preenchido arredondado
  - MDIconButton              → Botão de ícone simples (sem texto)
  - MDFloatingActionButton    → Botão flutuante FAB (ação principal)

Todas as funções usam APENAS tipos primitivos como parâmetros:
  str, float, tuple[float, float], list[float], Callable, dict
================================================================================
"""

from typing import Callable, Any
from kivymd.uix.button import (
    MDRaisedButton,
    MDRectangleFlatButton,
    MDRoundFlatButton,
    MDFillRoundFlatButton,
    MDIconButton,
    MDFloatingActionButton,
)


def botao_elevado(
    texto: str,
    on_release: Callable[[Any], None] | None = None,
    icon: str | None = None,
    size_hint: tuple[float | None, float | None] = (None, None),
    pos_hint: dict[str, float] | None = None,
    md_bg_color: tuple[float, float, float, float] | None = None,
) -> MDRaisedButton:
    """
    Cria um botão elevado preenchido (MDRaisedButton).

    Args:
        texto        : Texto impresso no botão
        on_release   : Função de callback ao clicar/soltar o botão (recebe o widget)
        icon         : Nome opcional do ícone Material Design (ex: "check", "folder", "play")
        size_hint    : (largura_relativa, altura_relativa) ex: (0.5, None) ou (None, None)
        pos_hint     : Dicionário de posicionamento ex: {"center_x": 0.5, "center_y": 0.5}
        md_bg_color  : Cor de fundo RGBA ex: (0.1, 0.5, 0.8, 1.0)

    Returns:
        MDRaisedButton

    Example:
        >>> btn = botao_elevado("Gerar Laudo", on_release=lambda x: print("Gerando..."))
    """
    btn = MDRaisedButton(text=texto, size_hint=size_hint)
    if icon:
        btn.icon = icon
    if pos_hint:
        btn.pos_hint = pos_hint
    if md_bg_color:
        btn.md_bg_color = md_bg_color
    if on_release:
        btn.bind(on_release=on_release)
    return btn


def botao_plano(
    texto: str,
    on_release: Callable[[Any], None] | None = None,
    arredondado: bool = True,
    preenchido: bool = False,
    size_hint: tuple[float | None, float | None] = (None, None),
    pos_hint: dict[str, float] | None = None,
) -> Any:
    """
    Cria um botão plano (retangular ou arredondado, preenchido ou transparente).

    Args:
        texto       : Texto do botão
        on_release  : Callback de clique
        arredondado : True = bordas arredondadas, False = retangular
        preenchido  : True = fundo preenchido, False = transparente com borda
        size_hint   : Tamanho relativo
        pos_hint    : Posição relativa

    Returns:
        Widget de botão KivyMD apropriado
    """
    if arredondado:
        cls = MDFillRoundFlatButton if preenchido else MDRoundFlatButton
    else:
        cls = MDRectangleFlatButton

    btn = cls(text=texto, size_hint=size_hint)
    if pos_hint:
        btn.pos_hint = pos_hint
    if on_release:
        btn.bind(on_release=on_release)
    return btn


def botao_icone(
    icon: str,
    on_release: Callable[[Any], None] | None = None,
    user_font_size: str | float = "24sp",
    pos_hint: dict[str, float] | None = None,
    theme_text_color: str = "Primary",
) -> MDIconButton:
    """
    Cria um botão de ícone isolado (MDIconButton).

    Args:
        icon             : Nome do ícone Material (ex: "microphone", "magnify", "cog", "delete")
        on_release       : Callback de clique
        user_font_size   : Tamanho do ícone ex: "32sp" ou 32
        pos_hint         : Posição relativa ex: {"center_x": 0.5, "center_y": 0.5}
        theme_text_color : Cor do tema ("Primary", "Accent", "Custom")

    Returns:
        MDIconButton

    Example:
        >>> btn_mic = botao_icone("microphone", on_release=iniciar_gravacao)
    """
    btn = MDIconButton(icon=icon, user_font_size=user_font_size, theme_text_color=theme_text_color)
    if pos_hint:
        btn.pos_hint = pos_hint
    if on_release:
        btn.bind(on_release=on_release)
    return btn


def botao_fab(
    icon: str,
    on_release: Callable[[Any], None] | None = None,
    pos_hint: dict[str, float] | None = None,
    md_bg_color: tuple[float, float, float, float] | None = None,
) -> MDFloatingActionButton:
    """
    Cria um botão flutuante FAB (MDFloatingActionButton).

    Args:
        icon        : Nome do ícone (ex: "plus", "camera", "microphone")
        on_release  : Callback ao clicar
        pos_hint    : Posição relativa ex: {"right": 0.9, "bottom": 0.1}
        md_bg_color : Cor de fundo RGBA

    Returns:
        MDFloatingActionButton
    """
    btn = MDFloatingActionButton(icon=icon)
    if pos_hint:
        btn.pos_hint = pos_hint
    if md_bg_color:
        btn.md_bg_color = md_bg_color
    if on_release:
        btn.bind(on_release=on_release)
    return btn
