#!/bin/bash

# Script de instalação do ChatGPT Clone no Apache2
# Autor: Anders & Claude 🧉

set -e

echo "🚀 Instalando ChatGPT Clone no Apache2..."
echo "======================================="

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar se está rodando como root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}Este script precisa rodar como root${NC}"
   exit 1
fi

# Diretórios
APP_DIR="/root/CHATGPT"
APACHE_DIR="/etc/apache2"
LOG_DIR="/var/log/chatgpt"

# 1. Criar diretório de logs
echo -e "${YELLOW}1. Criando diretório de logs...${NC}"
mkdir -p $LOG_DIR
touch $LOG_DIR/app.log
touch $LOG_DIR/error.log
chmod 755 $LOG_DIR

# 2. Build de produção
echo -e "${YELLOW}2. Criando build de produção...${NC}"
cd $APP_DIR
npm run build

# 3. Adicionar configuração ao Apache
echo -e "${YELLOW}3. Adicionando configuração ao Apache...${NC}"

# Verificar se já existe configuração /chat
if grep -q "Location /chat" $APACHE_DIR/sites-available/ultrassom.ai-optimized.conf; then
    echo -e "${YELLOW}   Configuração /chat já existe. Pulando...${NC}"
else
    echo -e "${GREEN}   Adicionando configuração /chat...${NC}"
    # Adicionar antes do </VirtualHost>
    sed -i '/<\/VirtualHost>/i\
\
    # ===== ChatGPT Clone (Gaúcho Chat) =====\
    <Location /chat>\
        ProxyPass http://localhost:3040/chat\
        ProxyPassReverse http://localhost:3040/chat\
        ProxyPreserveHost On\
        RequestHeader set X-Forwarded-Proto "https"\
        RequestHeader set X-Forwarded-Host "ultrassom.ai"\
        ProxyTimeout 120\
    </Location>\
\
    <Location /chat/api>\
        ProxyPass http://localhost:3040/chat/api\
        ProxyPassReverse http://localhost:3040/chat/api\
        ProxyPreserveHost On\
        RequestHeader set X-Forwarded-Proto "https"\
        ProxyTimeout 300\
    </Location>\
\
    <Location /chat/_next>\
        ProxyPass http://localhost:3040/chat/_next\
        ProxyPassReverse http://localhost:3040/chat/_next\
        ProxyPreserveHost On\
        Header set Cache-Control "public, max-age=31536000, immutable"\
    </Location>\
\
    <Location /chat/_next/webpack-hmr>\
        ProxyPass ws://localhost:3040/chat/_next/webpack-hmr\
        ProxyPassReverse ws://localhost:3040/chat/_next/webpack-hmr\
    </Location>\
\
    # ===== Fim ChatGPT Clone =====\
' $APACHE_DIR/sites-available/ultrassom.ai-optimized.conf
fi

# 4. Instalar systemd service
echo -e "${YELLOW}4. Instalando systemd service...${NC}"
cp $APP_DIR/systemd/chatgpt.service /etc/systemd/system/
systemctl daemon-reload

# 5. Habilitar e iniciar serviço
echo -e "${YELLOW}5. Habilitando e iniciando serviço...${NC}"
systemctl enable chatgpt.service
systemctl start chatgpt.service

# 6. Recarregar Apache
echo -e "${YELLOW}6. Recarregando Apache...${NC}"
systemctl reload apache2

# 7. Aguardar inicialização
echo -e "${YELLOW}7. Aguardando aplicação iniciar...${NC}"
sleep 5

# 8. Verificar status
echo -e "${YELLOW}8. Verificando status...${NC}"
if systemctl is-active --quiet chatgpt.service; then
    echo -e "${GREEN}✅ ChatGPT Clone está rodando!${NC}"
    echo ""
    echo -e "${GREEN}🎉 Instalação concluída com sucesso!${NC}"
    echo ""
    echo "📍 Acesse em: https://ultrassom.ai/chat"
    echo "📊 Logs em: $LOG_DIR"
    echo ""
    echo "Comandos úteis:"
    echo "  systemctl status chatgpt       # Ver status"
    echo "  systemctl restart chatgpt      # Reiniciar"
    echo "  journalctl -u chatgpt -f       # Ver logs"
    echo "  tail -f $LOG_DIR/app.log       # Ver logs da app"
else
    echo -e "${RED}❌ Erro ao iniciar o serviço${NC}"
    echo "Verifique os logs:"
    echo "  journalctl -u chatgpt -n 50"
    echo "  tail -f $LOG_DIR/error.log"
    exit 1
fi

# 9. Atualizar APACHE.md
echo -e "${YELLOW}9. Atualizando documentação do Apache...${NC}"
if ! grep -q "/chat/" $APACHE_DIR/APACHE.md; then
    # Adicionar entrada na tabela de endpoints
    sed -i '/| `\/chathub\/api\/` | 3021 | ChatHub API | OK |/a\
| `/chat/` | 3040 | ChatGPT Clone (Gaúcho Chat) | OK |' $APACHE_DIR/APACHE.md
    
    # Adicionar na lista de portas Node.js
    sed -i '/| 3021 | ChatHub Backend | chathub-api.service |/a\
| 3040 | ChatGPT Clone | chatgpt.service |' $APACHE_DIR/APACHE.md
    
    echo -e "${GREEN}   Documentação atualizada${NC}"
fi

echo ""
echo "============================================"
echo -e "${GREEN}🚀 ChatGPT Clone instalado com sucesso!${NC}"
echo "============================================"
echo ""
echo "URL: https://ultrassom.ai/chat"
echo "Porta: 3040"
echo "Serviço: chatgpt.service"
echo ""
echo -e "${YELLOW}Lembre-se de configurar a OPENAI_API_KEY em:${NC}"
echo "$APP_DIR/.env.production"
echo ""