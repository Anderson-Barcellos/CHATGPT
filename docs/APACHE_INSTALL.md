# 🚀 Instalação do ChatGPT Clone no Apache2

## Configuração Rápida

O ChatGPT Clone está configurado para rodar na **porta 3040** e ser servido através do Apache no caminho `/chat` com SSL.

### URLs
- **Local**: http://localhost:3040/chat
- **Produção**: https://ultrassom.ai/chat

---

## 📋 Pré-requisitos

1. Node.js 18+ instalado
2. Apache2 com mod_proxy habilitado
3. Certificado SSL configurado
4. Porta 3040 disponível

---

## 🎯 Instalação Automática (Recomendado)

```bash
# 1. Configure sua API key
nano /root/CHATGPT/.env.production
# Adicione: OPENAI_API_KEY=sua_chave_aqui

# 2. Execute o instalador
cd /root/CHATGPT
./scripts/install-apache.sh
```

Pronto! Acesse https://ultrassom.ai/chat 🎉

---

## 🔧 Instalação Manual

### Passo 1: Configurar variáveis de ambiente

```bash
cp .env.example .env.production
nano .env.production
```

Adicione sua `OPENAI_API_KEY` e confirme as configurações:
```env
NEXT_PUBLIC_BASE_PATH=/chat
NEXT_PUBLIC_APP_URL=https://ultrassom.ai/chat
PORT=3040
OPENAI_API_KEY=sk-...
```

### Passo 2: Build de produção

```bash
cd /root/CHATGPT
npm install
npm run build
```

### Passo 3: Configurar Apache

Adicione ao arquivo `/etc/apache2/sites-available/ultrassom.ai-optimized.conf`:

```apache
# ChatGPT Clone (Gaúcho Chat)
<Location /chat>
    ProxyPass http://localhost:3040/chat
    ProxyPassReverse http://localhost:3040/chat
    ProxyPreserveHost On
    RequestHeader set X-Forwarded-Proto "https"
    ProxyTimeout 120
</Location>

<Location /chat/api>
    ProxyPass http://localhost:3040/chat/api
    ProxyPassReverse http://localhost:3040/chat/api
    ProxyTimeout 300
</Location>

<Location /chat/_next>
    ProxyPass http://localhost:3040/chat/_next
    ProxyPassReverse http://localhost:3040/chat/_next
    Header set Cache-Control "public, max-age=31536000, immutable"
</Location>
```

### Passo 4: Instalar systemd service

```bash
# Copiar arquivo de serviço
cp /root/CHATGPT/systemd/chatgpt.service /etc/systemd/system/

# Criar diretório de logs
mkdir -p /var/log/chatgpt

# Recarregar systemd
systemctl daemon-reload

# Habilitar e iniciar
systemctl enable chatgpt
systemctl start chatgpt
```

### Passo 5: Recarregar Apache

```bash
systemctl reload apache2
```

---

## 🧪 Teste Local (Desenvolvimento)

Para testar localmente antes de instalar:

```bash
cd /root/CHATGPT
./scripts/test-local.sh
```

Acesse: http://localhost:3040/chat

---

## 📊 Comandos Úteis

### Gerenciar serviço

```bash
# Status
systemctl status chatgpt

# Iniciar/Parar/Reiniciar
systemctl start chatgpt
systemctl stop chatgpt
systemctl restart chatgpt

# Ver logs
journalctl -u chatgpt -f
tail -f /var/log/chatgpt/app.log
tail -f /var/log/chatgpt/error.log
```

### Atualizar aplicação

```bash
cd /root/CHATGPT
git pull
npm install
npm run build
systemctl restart chatgpt
```

### Verificar porta

```bash
# Verificar se porta 3040 está em uso
lsof -i:3040
netstat -tulpn | grep 3040

# Verificar com script do Apache
/etc/apache2/check-port.sh 3040
```

---

## 🔍 Troubleshooting

### Erro: Porta 3040 em uso

```bash
# Encontrar processo usando a porta
lsof -i:3040
# Kill processo (substitua PID)
kill -9 <PID>
```

### Erro: 502 Bad Gateway

```bash
# Verificar se serviço está rodando
systemctl status chatgpt

# Ver logs de erro
journalctl -u chatgpt -n 50
tail -50 /var/log/chatgpt/error.log
```

### Erro: Página não carrega recursos

```bash
# Verificar build
cd /root/CHATGPT
npm run build

# Verificar basePath
echo $NEXT_PUBLIC_BASE_PATH  # Deve ser /chat
```

### Erro: API não funciona

```bash
# Verificar OPENAI_API_KEY
cat /root/CHATGPT/.env.production | grep OPENAI

# Testar API diretamente
curl http://localhost:3040/chat/api/health
```

---

## 🔒 Segurança

### Headers de segurança (já configurados)

- HTTPS forçado via Apache
- CORS configurado
- Rate limiting ativo
- CSP headers
- XSS Protection

### Rate Limiting

Configurado em `.env.production`:
```env
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS=100    # Requisições
RATE_LIMIT_WINDOW=60000     # Por minuto
```

---

## 📈 Performance

### Otimizações aplicadas

- Build otimizado do Next.js
- Cache de assets estáticos (1 ano)
- Compressão gzip via Apache
- Code splitting automático
- Lazy loading de componentes pesados

### Monitoramento

```bash
# CPU e memória do processo
htop -p $(pgrep -f "npm start")

# Logs de acesso Apache
tail -f /var/log/apache2/access.log | grep /chat

# Performance do Node.js
node --trace-warnings /root/CHATGPT/.next/standalone/server.js
```

---

## 📝 Notas Importantes

1. **API Key**: Sempre mantenha sua `OPENAI_API_KEY` segura e nunca commite no git
2. **Logs**: Monitore regularmente `/var/log/chatgpt/` para erros
3. **Backup**: Faça backup regular de `.env.production` e dos arquivos em `data/*.json`
4. **Updates**: Teste updates em desenvolvimento antes de aplicar em produção

---

## 🆘 Suporte

Se precisar de ajuda:

1. Verifique os logs: `journalctl -u chatgpt -n 100`
2. Teste localmente: `./scripts/test-local.sh`
3. Verifique a documentação: `/etc/apache2/APACHE.md`

---

*Documento criado em: 2026-01-29*
*Autor: Anders & Claude* 🧉
