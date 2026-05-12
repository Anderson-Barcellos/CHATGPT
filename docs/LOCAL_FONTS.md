# Fontes locais (opcional)

Este projeto **não versiona binários de fonte** no repositório para evitar problemas de push/PR com bytes em alguns ambientes.

## Comportamento atual

- O app usa stacks CSS com fallback (`--font-geist-sans` e `--font-geist-mono`) em `app/globals.css`.
- Se as fontes não estiverem instaladas no sistema, o navegador usa as alternativas da stack.

## Como habilitar fontes locais no teu ambiente

1. Baixe as fontes variáveis:
   - Space Grotesk
   - JetBrains Mono
2. Salve em:
   - `public/fonts/SpaceGrotesk-Variable.ttf`
   - `public/fonts/JetBrainsMono-Variable.ttf`
3. Opcionalmente, reative `next/font/local` em `app/layout.tsx` se quiser build 100% determinístico com os arquivos locais.

## Observação

Nunca commitar chaves/sigilos em arquivos `.env`; usar `.env.example` como template.
