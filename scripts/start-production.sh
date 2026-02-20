#!/bin/bash

# Script para iniciar o ChatGPT Clone em produção na porta 3040

echo "🚀 Iniciando ChatGPT Clone em produção..."

# Diretório da aplicação
APP_DIR="/root/CHATGPT"
cd $APP_DIR

# Carregar variáveis de ambiente
export $(cat .env.production | grep -v '^#' | xargs)

# Build de produção
echo "📦 Criando build de produção..."
npm run build

# Iniciar servidor em produção
echo "✅ Iniciando servidor na porta 3040..."
PORT=3040 npm start