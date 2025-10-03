const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { generateHLS } = require('./services/hls-generator-ts');
const { generateHLS_fMP4 } = require('./services/hls-generator-fmp4');
const { saveUploadToDisk } = require('./services/save-upload');
const upload = require('./utils/multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware para servir arquivos estáticos
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/hls', express.static(path.join(__dirname, 'hls')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Middleware para parsing de JSON e URL encoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));




// Lista de vídeos convertidos (em produção, usar banco de dados)
let convertedVideos = [];
// Função utilitária para filtrar vídeos por tipo
function filterVideosByType(type) {
  if (type === 'original') return convertedVideos.filter(v => v.segmentType === 'original');
  if (type === 'ts') return convertedVideos.filter(v => v.segmentType === 'ts');
  if (type === 'fmp4' || type === 'mp4') return convertedVideos.filter(v => v.segmentType === 'mp4' || v.segmentType === 'fmp4');
  return [];
}

// Rotas de upload separadas
function addVideoAndRespond(res, videoInfo, inputPath) {
  convertedVideos.push(videoInfo);
  if (inputPath) fs.unlink(inputPath, () => {});
  return res.json({ success: true, video: videoInfo });
}

app.post('/upload/original', upload.single('video'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  try {
    const { path: inputPath, filename } = await saveUploadToDisk(req.file);
    const videoId = path.parse(filename).name;
    const videoInfo = {
      id: videoId,
      originalName: req.file.originalname,
      hlsUrl: `/uploads/${filename}`,
      segmentType: 'original',
      uploadDate: new Date().toISOString()
    };
    return addVideoAndRespond(res, videoInfo);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao salvar vídeo original.' });
  }
});

app.post('/upload/ts', upload.single('video'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  try {
    const { path: inputPath, filename } = await saveUploadToDisk(req.file);
    const videoId = path.parse(filename).name;
    const outputDir = path.join(__dirname, 'hls', videoId);
    await generateHLS(inputPath, outputDir);
    const videoInfo = {
      id: videoId,
      originalName: req.file.originalname,
      hlsUrl: `/hls/${videoId}/master.m3u8`,
      segmentType: 'ts',
      uploadDate: new Date().toISOString()
    };
    return addVideoAndRespond(res, videoInfo, inputPath);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao converter vídeo para TS.' });
  }
});

app.post('/upload/fmp4', upload.single('video'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  try {
    const { path: inputPath, filename } = await saveUploadToDisk(req.file);
    const videoId = path.parse(filename).name;
    const outputDir = path.join(__dirname, 'hls', videoId);
    await generateHLS_fMP4(inputPath, outputDir);
    const videoInfo = {
      id: videoId,
      originalName: req.file.originalname,
      hlsUrl: `/hls/${videoId}/master.m3u8`,
      segmentType: 'mp4',
      uploadDate: new Date().toISOString()
    };
    return addVideoAndRespond(res, videoInfo, inputPath);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao converter vídeo para fMP4.' });
  }
});

// Rotas de captura/listagem separadas
app.get('/capture/original', (req, res) => {
  const baseUrl = req.protocol + '://' + req.hostname + (req.socket.localPort ? ':' + req.socket.localPort : '');
  const videos = filterVideosByType('original').map(v => ({ ...v, fullUrl: baseUrl + v.hlsUrl }));
  res.json({ videos });
});

app.get('/capture/ts', (req, res) => {
  const baseUrl = req.protocol + '://' + req.hostname + (req.socket.localPort ? ':' + req.socket.localPort : '');
  const videos = filterVideosByType('ts').map(v => ({ ...v, fullUrl: baseUrl + v.hlsUrl }));
  res.json({ videos });
});

app.get('/capture/fmp4', (req, res) => {
  const baseUrl = req.protocol + '://' + req.hostname + (req.socket.localPort ? ':' + req.socket.localPort : '');
  const videos = filterVideosByType('fmp4').map(v => ({ ...v, fullUrl: baseUrl + v.hlsUrl }));
  res.json({ videos });
});
// Rota principal
app.get('/', (req, res) => {
  // Monta a base da URL (protocolo, host, porta)
  const baseUrl = req.protocol + '://' + req.hostname + (req.socket.localPort ? ':' + req.socket.localPort : '');
  // Adiciona a url completa em cada vídeo
  const videosWithFullUrl = convertedVideos.map(v => ({
    ...v,
    fullUrl: baseUrl + v.hlsUrl
  }));
  res.render('index', { videos: videosWithFullUrl });
});

// Rota para upload de vídeo com escolha de formato
app.post('/upload', upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  }
  const { format } = req.body;
  try {
    // Salva o arquivo em disco usando o novo serviço
    const { path: inputPath, filename } = await saveUploadToDisk(req.file);
    const videoId = path.parse(filename).name;
    if (format === 'original') {
      // Apenas salva o arquivo, sem conversão
      const videoInfo = {
        id: videoId,
        originalName: req.file.originalname,
        hlsUrl: `/uploads/${filename}`,
        segmentType: 'original',
        uploadDate: new Date().toISOString()
      };
      convertedVideos.push(videoInfo);
      console.log('Vídeo salvo sem conversão:', videoInfo);
      return res.json({ success: true, video: videoInfo });
    }
    // Caso contrário, faz a conversão normalmente
    const outputDir = path.join(__dirname, 'hls', videoId);
    console.log(`Processando vídeo: ${req.file.originalname}`);
    console.log(`Arquivo salvo em: ${inputPath}`);
    console.log(`Output HLS: ${outputDir}`);
    let segmentExt;
    let generatorFn;
    if (format === 'fmp4') {
      segmentExt = 'mp4';
      generatorFn = generateHLS_fMP4;
    } else {
      segmentExt = 'ts';
      generatorFn = generateHLS;
    }
    await generatorFn(inputPath, outputDir);
    const videoInfo = {
      id: videoId,
      originalName: req.file.originalname,
      hlsUrl: `/hls/${videoId}/master.m3u8`,
      segmentType: segmentExt,
      uploadDate: new Date().toISOString()
    };
    convertedVideos.push(videoInfo);
    console.log('Vídeo convertido com sucesso:', videoInfo);
    fs.unlink(inputPath, (unlinkErr) => {
      if (unlinkErr) {
        console.error('Erro ao remover arquivo original:', unlinkErr);
      } else {
        console.log('Arquivo original removido:', inputPath);
      }
      if (!res.headersSent) res.redirect('/');
    });
    setTimeout(() => {
      if (!res.headersSent) res.redirect('/');
    }, 5000);
  } catch (err) {
    console.error('Erro na conversão:', err);
    if (!res.headersSent) res.status(500).send('Erro ao converter o vídeo.');
  }
});

// Rota para servir segmentos .ts com headers corretos
app.get('/hls/:id/*.ts', (req, res) => {
  const filePath = path.join(__dirname, 'hls', req.params.id, req.params[0] + '.ts');
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Segmento não encontrado');
  }

  res.setHeader('Content-Type', 'video/mp2t');
  res.setHeader('Cache-Control', 'public, max-age=31536000');
  res.sendFile(filePath);
});

// Middleware de tratamento de erros
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Arquivo muito grande! Máximo 500MB.' });
    }
  }
  
  if (error.message === 'Apenas arquivos de vídeo são permitidos!') {
    return res.status(400).json({ error: error.message });
  }

  console.error('Erro:', error);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log('Certifique-se de que o GStreamer está instalado no sistema!');
  console.log('Para instalar no Ubuntu/Debian: sudo apt install gstreamer1.0-tools gstreamer1.0-plugins-base gstreamer1.0-plugins-good gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly');
});

module.exports = app;