# 🎨 GUIA RÁPIDO & COMPILADO KIVYMD (VERTEX V2)

Este módulo descomplica a construção de interfaces gráficas em Python usando **KivyMD (Material Design)**. Em vez de lidar com a linguagem KvLang ou instanciar dezenas de propriedades internas de UI (`StringProperty`, `NumericProperty`, `ObjectProperty`), todas as funções aceitam **apenas tipos primitivos Python** (`str`, `int`, `float`, `bool`, `list`, `dict`, `Callable`, `tuple`).

---

## 📍 Onde achar cada componente KivyMD

| Componente UI | Módulo | Função no Módulo `KIVYMD` | Parâmetros Principais (Tipos Primitivos) |
| :--- | :--- | :--- | :--- |
| **App & Tema** | `KIVYMD.app` | `criar_app(...)` | `build_func`: `Callable`, `tema`: `"Dark"`/`"Light"`, `cor_primaria`: `"Teal"` |
| **Botão Elevado** | `KIVYMD.buttons` | `botao_elevado(...)` | `texto`: `str`, `on_release`: `Callable`, `icon`: `"check"` |
| **Botão de Ícone** | `KIVYMD.buttons` | `botao_icone(...)` | `icon`: `"microphone"`, `user_font_size`: `"24sp"` |
| **Campo de Texto** | `KIVYMD.inputs` | `campo_texto(...)` | `hint_text`: `"Nome"`, `icon_right`: `"account"`, `on_text_validate`: `Callable` |
| **Cartão (Card)** | `KIVYMD.cards` | `cartao(...)` | `elevation`: `2`, `radius`: `[12, 12, 12, 12]`, `on_release`: `Callable` |
| **Rótulo (Texto)** | `KIVYMD.cards` | `rotulo(...)` | `texto`: `str`, `font_style`: `"H5"`/`"Body1"`, `bold`: `bool` |
| **Diálogo Popup** | `KIVYMD.dialogs` | `exibir_dialogo(...)` | `titulo`: `"Aviso"`, `texto`: `"Mensagem"`, `on_ok`: `Callable` |
| **Notificação** | `KIVYMD.dialogs` | `exibir_snackbar(...)` | `texto`: `"Salvo!"`, `duracao`: `3.0` |
| **Layout Vertical/Horiz.**| `KIVYMD.layouts` | `layout_box(...)` | `orientacao`: `"vertical"`, `spacing`: `10`, `padding`: `15` |
| **Barra de Topo** | `KIVYMD.layouts` | `barra_superior(...)` | `titulo`: `"Vertex V2"`, `icon_esquerdo`: `"menu"` |

---

## 🚀 Exemplo de Aplicação Completa em Poucas Linhas

```python
from KIVYMD import (
    criar_app,
    layout_box,
    barra_superior,
    rotulo,
    campo_texto,
    botao_elevado,
    exibir_snackbar,
)

def montar_interface():
    # 1. Layout principal
    main_box = layout_box(orientacao="vertical", spacing=15, padding=20)

    # 2. Barra de Topo
    top_bar = barra_superior(titulo="Vertex V2 - Sonografia")

    # 3. Conteúdo
    titulo = rotulo("Busca de Paciente", font_style="H5", bold=True)
    campo_busca = campo_texto(hint_text="Nome ou Prontuário", icon_right="magnify")
    btn_buscar = botao_elevado(
        "Buscar Exame",
        icon="folder-search",
        on_release=lambda x: exibir_snackbar(f"Buscando: {campo_busca.text}")
    )

    # 4. Adiciona ao layout
    main_box.add_widget(top_bar)
    main_box.add_widget(titulo)
    main_box.add_widget(campo_busca)
    main_box.add_widget(btn_buscar)

    return main_box

# Rodar o app com tema Dark e cor Teal
if __name__ == "__main__":
    app = criar_app(build_func=montar_interface, tema="Dark", cor_primaria="Teal")
    # app.run()
```
