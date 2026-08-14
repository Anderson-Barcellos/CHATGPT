"""
================================================================================
KIVYMD/cards.py — Cards, Cartões de Informação e Rótulos (KivyMD)
================================================================================
Cobre a criação de containers visuais e rótulos de texto:

  - MDCard                → Cartão elevado com cantos arredondados, ripples e elevação
  - MDLabel               → Rótulo de texto com tipografia Material Design

Estilos de tipografia MDLabel:
  "H1", "H2", "H3", "H4", "H5", "H6",
  "Subtitle1", "Subtitle2", "Body1", "Body2", "Button", "Caption", "Overline"

Todas as funções usam APENAS tipos primitivos como parâmetros:
  str, int, float, bool, tuple[float, float], list[float], dict, Callable
================================================================================
"""

from typing import Callable, Any
from kivymd.uix.card import MDCard
from kivymd.uix.label import MDLabel


def cartao(
    elevation: int = 2,
    radius: list[int] | tuple[int, int, int, int] = (12, 12, 12, 12),
    padding: int | tuple[int, int] = 16,
    spacing: int = 8,
    orientation: str = "vertical",
    size_hint: tuple[float | None, float | None] = (None, None),
    size: tuple[float, float] = (300, 200),
    pos_hint: dict[str, float] | None = None,
    md_bg_color: tuple[float, float, float, float] | None = None,
    on_release: Callable[[Any], None] | None = None,
    ripple_behavior: bool = True,
) -> MDCard:
    """
    Cria um cartão estilizado Material Design (MDCard).

    Args:
        elevation       : Sombra / elevação (0 a 24)
        radius          : Raio das bordas [top_left, top_right, bottom_right, bottom_left]
        padding         : Espaçamento interno dos elementos do cartão
        spacing         : Espaçamento entre filhos dentro do cartão
        orientation     : "vertical" ou "horizontal"
        size_hint       : Tamanho relativo (largura, altura) ex: (0.9, None)
        size            : Tamanho absoluto em pixels se size_hint for (None, None)
        pos_hint        : Posição relativa ex: {"center_x": 0.5}
        md_bg_color     : Cor de fundo RGBA ex: (0.15, 0.15, 0.15, 1.0)
        on_release      : Callback ao clicar no cartão
        ripple_behavior : True para efeito onda de clique (ripple)

    Returns:
        MDCard

    Example:
        >>> card = cartao(
        ...     elevation=4,
        ...     size_hint=(0.9, None),
        ...     size=(0, 150),
        ...     on_release=lambda c: print("Cartão clicado!")
        ... )
    """
    card = MDCard(
        elevation=elevation,
        radius=radius,
        padding=padding,
        spacing=spacing,
        orientation=orientation,
        size_hint=size_hint,
        size=size,
        ripple_behavior=ripple_behavior,
    )
    if pos_hint:
        card.pos_hint = pos_hint
    if md_bg_color:
        card.md_bg_color = md_bg_color
    if on_release:
        card.bind(on_release=on_release)
    return card


def rotulo(
    texto: str,
    font_style: str = "Body1",  # "H4", "H5", "H6", "Subtitle1", "Body1", "Caption"
    halign: str = "left",        # "left", "center", "right", "justify"
    valign: str = "middle",      # "top", "middle", "bottom"
    theme_text_color: str = "Primary",  # "Primary", "Secondary", "Hint", "Error", "Custom"
    text_color: tuple[float, float, float, float] | None = None,
    bold: bool = False,
    size_hint_y: float | None = None,
    height: float | None = None,
) -> MDLabel:
    """
    Cria um rótulo de texto tipográfico (MDLabel).

    Args:
        texto            : Texto a ser exibido
        font_style       : Estilo da fonte ("H1"..."H6", "Subtitle1", "Body1", "Body2", "Caption")
        halign           : Alinhamento horizontal ("left", "center", "right")
        valign           : Alinhamento vertical ("top", "middle", "bottom")
        theme_text_color : Cor do texto do tema ("Primary", "Secondary", "Hint", "Error", "Custom")
        text_color       : Cor RGBA personalizada se theme_text_color="Custom"
        bold             : True para texto em negrito
        size_hint_y      : Altura relativa
        height           : Altura fixa em pixels

    Returns:
        MDLabel

    Example:
        >>> titulo = rotulo("Exame de Ultrassom", font_style="H5", halign="center", bold=True)
    """
    lbl = MDLabel(
        text=texto,
        font_style=font_style,
        halign=halign,
        valign=valign,
        theme_text_color=theme_text_color,
        bold=bold,
    )
    if text_color:
        lbl.text_color = text_color
    if size_hint_y is not None:
        lbl.size_hint_y = size_hint_y
    if height is not None:
        lbl.height = height
    return lbl
