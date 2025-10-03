# Media Server HLS

Uma aplicação Node.js completa para upload, conversão e streaming de vídeos em formato HLS (HTTP Live Streaming).

## 🚀 Funcionalidades

- ✅ Upload de vídeos via interface web
- ✅ Conversão automática para formato HLS usando GStreamer
- ✅ Player HTML5 com suporte HLS.js
- ✅ Interface moderna com Material-UI
- ✅ Drag & Drop para upload
- ✅ Streaming de vídeo otimizado
- ✅ Suporte a múltiplos formatos de vídeo

## 📋 Pré-requisitos

### 1. Node.js
Certifique-se de ter o Node.js (versão 14 ou superior) instalado:
```bash
node --version
npm --version
```

### 2. GStreamer
O GStreamer é essencial para a conversão de vídeos para HLS.

#### Ubuntu/Debian:
```bash
sudo apt update
sudo apt install gstreamer1.0-tools gstreamer1.0-plugins-base gstreamer1.0-plugins-good gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly gstreamer1.0-libav
```

#### CentOS/RHEL/Fedora:
```bash
sudo dnf install gstreamer1 gstreamer1-plugins-base gstreamer1-plugins-good gstreamer1-plugins-bad-free gstreamer1-plugins-ugly-free gstreamer1-libav
```

#### macOS (com Homebrew):
```bash
brew install gstreamer gst-plugins-base gst-plugins-good gst-plugins-bad gst-plugins-ugly gst-libav
```

#### Windows:
1. Baixe o GStreamer em: https://gstreamer.freedesktop.org/download/
2. Instale o "Complete" package
3. Adicione o GStreamer ao PATH do sistema

### 3. Verificar instalação do GStreamer
```bash
gst-launch-1.0 --version
```

## 🛠️ Instalação

1. **Clone ou baixe o projeto:**
```bash
# Se estiver em um repositório Git
git clone <repository-url>
cd MediaServer

# Ou navegue até a pasta do projeto
cd /home/fecamp/Projetos/Player/MediaServer
```

2. **Instale as dependências:**
```bash
npm install
```

3. **Inicie o servidor:**
```bash
# Modo produção
npm start

# Modo desenvolvimento (com nodemon)
npm run dev
```

4. **Acesse a aplicação:**
Abra seu navegador e vá para: http://localhost:3000

## 📁 Estrutura do Projeto

```
MediaServer/
├── app.js              # Servidor principal Express
├── package.json        # Configurações e dependências
├── README.md          # Este arquivo
├── uploads/           # Pasta temporária para uploads
├── hls/              # Vídeos convertidos em HLS
├── public/           # Arquivos estáticos
│   └── styles.css    # Estilos adicionais
└── views/            # Templates EJS
    └── index.ejs     # Interface principal
```

## 💻 Como Usar

1. **Upload de Vídeo:**
   - Clique na área de upload ou arraste um arquivo
   - Formatos suportados: MP4, AVI, MOV, WMV, FLV, WebM, MKV
   - Tamanho máximo: 500MB

2. **Conversão Automática:**
   - O vídeo será automaticamente convertido para HLS
   - O processo gera arquivos .m3u8 e segmentos .ts

3. **Reprodução:**
   - Clique em "REPRODUZIR" em qualquer vídeo da lista
   - O player suporta streaming adaptativo
   - Funciona em todos os navegadores modernos

## ⚙️ Configuração

### Porta do Servidor
Altere a porta no arquivo `app.js` ou use variável de ambiente:
```bash
PORT=8080 npm start
```

### Limites de Upload
Modifique em `app.js`:
```javascript
limits: {
  fileSize: 500 * 1024 * 1024 // 500MB
}
```

### Configurações HLS
Ajuste os parâmetros de conversão em `app.js`:
```javascript
const gstCommand = [
  // ... outros parâmetros
  'target-duration=10',  // Duração dos segmentos
  'max-files=0'         // Manter todos os segmentos
];
```

## 🐛 Solução de Problemas

### Erro: "GStreamer não encontrado"
- Verifique se o GStreamer está instalado: `gst-launch-1.0 --version`
- No Linux: instale com apt/dnf como mostrado acima
- No Windows: adicione o GStreamer ao PATH

### Erro: "Conversão falhou"
- Verifique se o arquivo de vídeo não está corrompido
- Tente com um formato diferente (MP4 é o mais confiável)
- Verifique os logs do servidor no terminal

### Player não carrega vídeo
- Verifique se o arquivo .m3u8 foi criado na pasta `hls/`
- Teste em navegador diferente
- Verifique o console do navegador para erros

### Problemas de permissão
```bash
# Linux/macOS
chmod -R 755 uploads/ hls/

# Ou execute como sudo se necessário
sudo npm start
```

## 🔧 Desenvolvimento

### Scripts Disponíveis
```bash
npm start     # Inicia em produção
npm run dev   # Inicia com nodemon (auto-reload)
```

### Estrutura de Dados
Os vídeos são armazenados em memória. Para produção, considere usar:
- Banco de dados (MongoDB, PostgreSQL)
- Storage em nuvem (AWS S3, Google Cloud)

### Melhorias Sugeridas
- [ ] Autenticação de usuários
- [ ] Banco de dados persistente
- [ ] Upload em chunks para arquivos grandes
- [ ] Múltiplas qualidades de vídeo
- [ ] Sistema de thumbnails
- [ ] API REST completa

## 📄 Licença

MIT License - veja o arquivo LICENSE para detalhes.

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

---

**Desenvolvido com ❤️ usando Node.js, Express, GStreamer e Material-UI**