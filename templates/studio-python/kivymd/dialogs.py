"""
================================================================================
KIVYMD/dialogs.py — Diálogos, Notificações e Popups (KivyMD)
================================================================================
Cobre a exibição de popups, avisos e notificações no KivyMD:

  - MDDialog              → Diálogo modal pop-up com título, texto e botões
  - MDSnackbar            → Notificação discreta na parte inferior da tela
  - toast                 → Notificação rápida estilo Android Toast

Todas as funções usam APENAS tipos primitivos como parâmetros:
  str, float, list, Callable
================================================================================
"""

from typing import Callable, Any
from kivymd.uix.dialog import MDDialog
from kivymd.uix.button import MDFlatButton
from kivymd.uix.snackbar import MDSnackbar
from kivymd.toast import toast as _kivy_toast


def exibir_dialogo(
    titulo: str,
    texto: str,
    texto_botao_ok: str = "OK",
    on_ok: Callable[[Any], None] | None = None,
    texto_botao_cancelar: str | None = None,
    on_cancelar: Callable[[Any], None] | None = None,
    auto_dismiss: bool = True,
) -> MDDialog:
    """
    Exibe um diálogo modal estilo Material Design (MDDialog).

    Args:
        titulo               : Título principal do diálogo (ex: "Confirmar Exclusão")
        texto                : Mensagem explicativa no corpo do diálogo
        texto_botao_ok       : Rótulo do botão de confirmação ("OK", "Confirmar")
        on_ok                : Callback ao clicar no botão OK
        texto_botao_cancelar : Rótulo opcional do botão cancelar ("Cancelar")
        on_cancelar          : Callback ao clicar no botão Cancelar
        auto_dismiss         : True se puder fechar clicando fora do diálogo

    Returns:
        MDDialog (já aberto com `.open()`)

    Example:
        >>> dlg = exibir_dialogo(
        ...     titulo="Salvar Laudo",
        ...     texto="Deseja salvar o laudo do paciente no banco?",
        ...     texto_botao_ok="Salvar",
        ...     on_ok=lambda x: print("Salvo!"),
        ...     texto_botao_cancelar="Cancelar"
        ... )
    """
    botoes = []

    if texto_botao_cancelar:
        def _cancelei(instance):
            dialog.dismiss()
            if on_cancelar:
                on_cancelar(instance)

        botoes.append(MDFlatButton(text=texto_botao_cancelar, on_release=_cancelei))

    def _confirmei(instance):
        dialog.dismiss()
        if on_ok:
            on_ok(instance)

    botoes.append(MDFlatButton(text=texto_botao_ok, on_release=_confirmei))

    dialog = MDDialog(
        title=titulo,
        text=texto,
        buttons=botoes,
        auto_dismiss=auto_dismiss,
    )
    dialog.open()
    return dialog


def exibir_snackbar(
    texto: str,
    duracao: float = 3.0,
    bg_color: tuple[float, float, float, float] | None = None,
):
    """
    Exibe uma barra de notificação temporária (Snackbar) na base da tela.

    Args:
        texto   : Mensagem a ser exibida
        duracao : Duração em segundos na tela (padrão: 3.0s)
        bg_color: Cor de fundo RGBA personalizada

    Example:
        >>> exibir_snackbar("Laudo enviado com sucesso!", duracao=2.5)
    """
    sb = MDSnackbar(text=texto, duration=duracao)
    if bg_color:
        sb.md_bg_color = bg_color
    sb.open()


def aviso_toast(texto: str, gravidade: str = "info"):
    """
    Exibe um aviso rápido em balão estilo Android Toast.

    Args:
        texto     : Texto curto da mensagem
        gravidade : "info", "success", "warning", "error" (formata emoji prefixo)

    Example:
        >>> aviso_toast("Paciente selecionado", gravidade="success")
    """
    prefixos = {
        "info": "ℹ️ ",
        "success": "✅ ",
        "warning": "⚠️ ",
        "error": "❌ ",
    }
    msg = f"{prefixos.get(gravidade, '')}{texto}"
    _kivy_toast(msg)
