"""
================================================================================
KIVYMD/layouts.py — Layouts, Barras de Navegação e Containers Roláveis
================================================================================
Cobre a estruturação de layouts e navegação no KivyMD:

  - MDBoxLayout           → Layout em caixa (vertical ou horizontal)
  - MDGridLayout          → Layout em grade de N colunas ou N linhas
  - MDScrollView          → Container rolável (para listas longas ou laudos)
  - MDTopAppBar           → Barra superior do aplicativo com título e ações

Todas as funções usam APENAS tipos primitivos como parâmetros:
  str, int, float, bool, tuple[float, float], list[Widget], dict, Callable
================================================================================
"""

from typing import Callable, Any, Sequence
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.gridlayout import MDGridLayout
from kivymd.uix.scrollview import MDScrollView
from kivymd.uix.toolbar import MDTopAppBar
from kivy.uix.widget import Widget


def layout_box(
    orientacao: str = "vertical",
    spacing: int = 10,
    padding: int | tuple[int, int] | tuple[int, int, int, int] = 10,
    widgets: Sequence[Widget] | None = None,
    size_hint: tuple[float | None, float | None] = (1.0, 1.0),
    pos_hint: dict[str, float] | None = None,
    md_bg_color: tuple[float, float, float, float] | None = None,
) -> MDBoxLayout:
    """
    Cria um layout em caixa vertical ou horizontal (MDBoxLayout).

    Args:
        orientacao  : "vertical" (empilha de cima pra baixo) ou "horizontal" (lado a lado)
        spacing     : Espaço entre widgets filhos em pixels
        padding     : Margem interna [esquerda, topo, direita, base] ou valor único
        widgets     : Lista opcional de widgets a adicionar imediatamente
        size_hint   : Tamanho relativo (largura, altura) ex: (1.0, 1.0) ou (1.0, None)
        pos_hint    : Posição relativa
        md_bg_color : Cor de fundo RGBA

    Returns:
        MDBoxLayout

    Example:
        >>> layout = layout_box(orientacao="vertical", spacing=15, padding=20)
        >>> layout.add_widget(btn)
    """
    box = MDBoxLayout(
        orientation=orientacao,
        spacing=spacing,
        padding=padding,
        size_hint=size_hint,
    )
    if pos_hint:
        box.pos_hint = pos_hint
    if md_bg_color:
        box.md_bg_color = md_bg_color
    if widgets:
        for w in widgets:
            box.add_widget(w)
    return box


def layout_grade(
    colunas: int = 2,
    spacing: int = 10,
    padding: int = 10,
    widgets: Sequence[Widget] | None = None,
    size_hint_y: float | None = None,
) -> MDGridLayout:
    """
    Cria um layout em grade (MDGridLayout).

    Args:
        colunas     : Número de colunas na grade (ex: 2, 3)
        spacing     : Espaçamento entre células
        padding     : Margem interna
        widgets     : Lista opcional de widgets para preencher a grade
        size_hint_y : Altura relativa

    Returns:
        MDGridLayout
    """
    grid = MDGridLayout(cols=colunas, spacing=spacing, padding=padding)
    if size_hint_y is not None:
        grid.size_hint_y = size_hint_y
    if widgets:
        for w in widgets:
            grid.add_widget(w)
    return grid


def painel_rolavel(
    conteudo: Widget | None = None,
    do_scroll_x: bool = False,
    do_scroll_y: bool = True,
    size_hint: tuple[float | None, float | None] = (1.0, 1.0),
) -> MDScrollView:
    """
    Cria um painel rolável (MDScrollView) para listas ou textos longos.

    Args:
        conteudo    : Widget interno que será rolado (ex: um layout_box vertical)
        do_scroll_x : True para permitir rolagem horizontal
        do_scroll_y : True para permitir rolagem vertical
        size_hint   : Tamanho relativo

    Returns:
        MDScrollView
    """
    scroll = MDScrollView(do_scroll_x=do_scroll_x, do_scroll_y=do_scroll_y, size_hint=size_hint)
    if conteudo:
        scroll.add_widget(conteudo)
    return scroll


def barra_superior(
    titulo: str = "Vertex V2",
    icon_esquerdo: str = "menu",
    on_click_esquerdo: Callable[[Any], None] | None = None,
    acoes_direita: list[tuple[str, Callable[[Any], None]]] | None = None,
    elevation: int = 4,
) -> MDTopAppBar:
    """
    Cria uma barra de título de topo Material Design (MDTopAppBar).

    Args:
        titulo            : Título impresso na barra (ex: "Vertex V2 - Laudos")
        icon_esquerdo     : Ícone do canto esquerdo (ex: "menu", "arrow-left")
        on_click_esquerdo : Callback ao clicar no ícone esquerdo
        acoes_direita     : Lista de tuplas [("nome_icone", callback_func), ...]
        elevation         : Sombra da barra (0 a 10)

    Returns:
        MDTopAppBar

    Example:
        >>> bar = barra_superior(
        ...     titulo="Laudo Ultrassom",
        ...     icon_esquerdo="arrow-left",
        ...     on_click_esquerdo=voltar,
        ...     acoes_direita=[("printer", imprimir), ("share", compartilhar)]
        ... )
    """
    bar = MDTopAppBar(title=titulo, elevation=elevation)
    if icon_esquerdo:
        bar.left_action_items = [[icon_esquerdo, on_click_esquerdo or (lambda x: None)]]

    if acoes_direita:
        items = []
        for icon_name, func in acoes_direita:
            items.append([icon_name, func])
        bar.right_action_items = items

    return bar
