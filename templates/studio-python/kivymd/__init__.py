"""
================================================================================
KIVYMD — Pacote de wrappers simplificados da SDK KivyMD para o Vertex V2
================================================================================

Submódulos disponíveis e suas responsabilidades:

  app.py        →  Criação de MDApp, gerencimento de temas Dark/Light e Janela
  buttons.py    →  Botões Material (elevados, planos, ícones, FAB)
  inputs.py     →  Campos de texto Material (MDTextField, busca)
  cards.py      →  Cards (MDCard) e Rótulos tipográficos (MDLabel)
  dialogs.py    →  Diálogos pop-up, Snackbars e Avisos Toast
  layouts.py    →  MDBoxLayout, MDGridLayout, MDScrollView e MDTopAppBar

--------------------------------------------------------------------------------
Importação rápida:
  from KIVYMD.app      import criar_app, configurar_tema, ajustar_janela
  from KIVYMD.buttons  import botao_elevado, botao_plano, botao_icone, botao_fab
  from KIVYMD.inputs   import campo_texto, campo_pesquisa
  from KIVYMD.cards    import cartao, rotulo
  from KIVYMD.dialogs  import exibir_dialogo, exibir_snackbar, aviso_toast
  from KIVYMD.layouts  import layout_box, layout_grade, painel_rolavel, barra_superior

Ou importar tudo de uma vez:
  from KIVYMD import *
================================================================================
"""

from .app import criar_app, configurar_tema, ajustar_janela
from .buttons import botao_elevado, botao_plano, botao_icone, botao_fab
from .inputs import campo_texto, campo_pesquisa
from .cards import cartao, rotulo
from .dialogs import exibir_dialogo, exibir_snackbar, aviso_toast
from .layouts import layout_box, layout_grade, painel_rolavel, barra_superior

__all__ = [
    # app
    "criar_app", "configurar_tema", "ajustar_janela",
    # buttons
    "botao_elevado", "botao_plano", "botao_icone", "botao_fab",
    # inputs
    "campo_texto", "campo_pesquisa",
    # cards
    "cartao", "rotulo",
    # dialogs
    "exibir_dialogo", "exibir_snackbar", "aviso_toast",
    # layouts
    "layout_box", "layout_grade", "painel_rolavel", "barra_superior",
]
