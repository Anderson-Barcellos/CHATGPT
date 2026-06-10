#!/bin/bash

# Script para testar o Gaucho Chat localmente na porta 3040

echo "🧪 Testando Gaucho Chat na porta 3040 com basePath /chat..."
echo "=============================================="

# Diretório da aplicação
APP_DIR="/root/CHATGPT"
cd $APP_DIR

# Configurar variáveis de ambiente para teste
export NEXT_PUBLIC_BASE_PATH=/chat
export NEXT_PUBLIC_APP_URL=http://localhost:3040/chat
export PORT=3040
export NODE_ENV=production

# Verificar porta
echo "📍 Verificando porta 3040..."
if lsof -i:3040 > /dev/null 2>&1; then
    echo "❌ Porta 3040 já está em uso!"
    echo "   Execute: lsof -i:3040"
    exit 1
else
    echo "✅ Porta 3040 está livre"
fi

# Build
echo ""
echo "📦 Criando build de produção..."
npm run build

# Iniciar servidor
echo ""
echo "🚀 Iniciando servidor..."
echo "=============================================="
echo ""
echo "📍 URL Local: http://localhost:3040/chat"
echo "📍 URL Apache: https://ultrassom.ai/chat (após instalação)"
echo ""
echo "Pressione Ctrl+C para parar"
echo ""

# Iniciar com npm start
npm start
