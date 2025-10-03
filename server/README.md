# Backend Express - Media Server HLS

## Como rodar o backend

1. Instale as dependências:
   ```bash
   cd server
   npm install
   ```
2. Certifique-se de ter o GStreamer instalado:
   ```bash
   gst-launch-1.0 --version
   ```
3. Inicie o backend:
   ```bash
   npm start
   # ou
   node index.js
   ```

O backend roda na porta 5000 por padrão e serve a API e os arquivos HLS.
