"""
================================================================================
KIVYMD/app.py — Gerenciamento de Aplicação, Temas e Janela (KivyMD)
================================================================================
Cobre a inicialização de aplicativos KivyMD e configuração do tema Material Design:

  - MDApp                 → Classe base da aplicação KivyMD
  - theme_cls             → Gerenciador de temas (paleta de cores, estilo Dark/Light)
  - Window                → Controle de tamanho da janela, título e comportamento

Paletas principais do KivyMD:
  "Red", "Pink", "Purple", "DeepPurple", "Indigo", "Blue", "LightBlue", "Cyan",
  "Teal", "Green", "LightGreen", "Lime", "Yellow", "Amber", "Orange",
  "DeepOrange", "Brown", "Gray", "BlueGray"

Estilos de tema:
  "Light"  → Tema claro
  "Dark"   → Tema escuro (padrão em muitos apps médicos/sonografia)

Funções deste módulo:
  - criar_app()      → Cria uma instância base configurada de MDApp
  - configurar_tema()→ Configura cores e modo dark/light do tema
  - ajustar_janela() → Define dimensões, título e cor de fundo da janela

Todas as funções aceitam APENAS tipos primitivos como parâmetros:
  str, int, float, bool, tuple[float, float], Callable
================================================================================
"""

from typing import Callable, Literal, Any
from kivymd.app import MDApp
from kivy.core.window import Window
from kivy.uix.widget import Widget


def criar_app(
    build_func: Callable[[], Widget],
    titulo: str = "Vertex V2",
    tema: Literal["Dark", "Light"] = "Dark",
    cor_primaria: str = "Teal",
    cor_acento: str = "Amber",
) -> MDApp:
    """
    Cria e configura uma classe de aplicativo KivyMD pronta para rodar.

    Args:
        build_func    : Função que retorna o widget principal (raiz) da interface
        titulo        : Título da janela da aplicação
        tema          : "Dark" (escuro) ou "Light" (claro)
        cor_primaria  : Nome da cor primaria KivyMD (ex: "Teal", "Blue", "Indigo")
        cor_acento    : Nome da cor de destaque/acento (ex: "Amber", "Orange")

    Returns:
        MDApp: Instância configurada pronta para chamar `.run()`

    Example:
        >>> from KIVYMD.app import criar_app
        >>> from KIVYMD.buttons import botao_elevado
        >>>
        >>> app = criar_app(
        ...     build_func=lambda: botao_elevado("Clique Aqui", on_release=lambda x: print("OK")),
        ...     titulo="Meu App Sonris",
        ...     tema="Dark",
        ...     cor_primaria="Teal",
        ... )
        >>> # app.run()
    """

    class CustomApp(MDApp):
        def build(self):
            self.title = titulo
            self.theme_cls.theme_style = tema
            self.theme_cls.primary_palette = cor_primaria
            self.theme_cls.accent_palette = cor_acento
            return build_func()

    return CustomApp()


def configurar_tema(
    app: MDApp,
    tema: Literal["Dark", "Light"] | None = None,
    cor_primaria: str | None = None,
    cor_acento: str | None = None,
):
    """
    Atualiza o tema de um app KivyMD em tempo de execução.

    Args:
        app          : Instância do MDApp
        tema         : "Dark" ou "Light"
        cor_primaria : Ex: "Teal", "Blue", "DeepPurple"
        cor_acento   : Ex: "Amber", "Orange"

    Example:
        >>> # Alternar para tema claro
        >>> configurar_tema(app, tema="Light", cor_primaria="Blue")
    """
    if tema:
        app.theme_cls.theme_style = tema
    if cor_primaria:
        app.theme_cls.primary_palette = cor_primaria
    if cor_acento:
        app.theme_cls.accent_palette = cor_acento


def ajustar_janela(
    largura: int = 800,
    altura: int = 600,
    titulo: str | None = None,
    cor_fundo_rgba: tuple[float, float, float, float] | None = None,
):
    """
    Define tamanho, título e cor de fundo inicial da janela principal Kivy.

    Args:
        largura        : Largura da janela em pixels (ex: 800)
        altura         : Altura da janela em pixels (ex: 600)
        titulo         : Título da janela
        cor_fundo_rgba : Tupla (r, g, b, a) com valores de 0.0 a 1.0

    Example:
        >>> ajustar_janela(1024, 768, titulo="Vertex V2 - Laudos")
    """
    Window.size = (largura, altura)
    if titulo:
        Window.title = titulo
    if cor_fundo_rgba:
        Window.clearcolor = cor_fundo_rgba
