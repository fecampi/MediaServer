const { downloadHLSSegment } = require('./services/downloadHLSSegment');
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

// Middleware para servir arquivos estáticos da pasta dist
const distDir = path.join(__dirname, '..', 'dist');
app.use('/public', express.static(path.join(distDir, 'public')));
app.use('/hls', express.static(path.join(distDir, 'hls')));
app.use('/uploads', express.static(path.join(distDir, 'uploads')));

// Middleware para parsing de JSON e URL encoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));




// Lista de vídeos convertidos (em produção, usar banco de dados)
let convertedVideos = [];
// Função utilitária para filtrar vídeos por tipo

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

// Rotas de captura HLS separadas por formato
app.post('/capture/original', async (req, res) => {
  const { url, duration } = req.body;
  if (!url) {
    return res.status(400).json({ success: false, error: 'URL é obrigatória.' });
  }
  let dur = duration && duration !== 'all' ? parseInt(duration) : undefined;
  try {
    const originalFilePath = await downloadHLSSegment(url, 'original', dur);
    const videoId = path.parse(originalFilePath).name;
    const videoInfo = {
      id: videoId,
      originalName: path.basename(originalFilePath),
      hlsUrl: `/uploads/${path.basename(originalFilePath)}`,
      segmentType: 'original',
      uploadDate: new Date().toISOString()
    };
    convertedVideos.push(videoInfo);
    return res.json({ success: true, video: videoInfo });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Erro ao capturar stream: ' + err.message });
  }
});

app.post('/capture/ts', async (req, res) => {
  const { url, duration } = req.body;
  if (!url) {
    return res.status(400).json({ success: false, error: 'URL é obrigatória.' });
  }
  let dur = duration && duration !== 'all' ? parseInt(duration) : undefined;
  try {
    const originalFilePath = await downloadHLSSegment(url, 'ts', dur);
    const videoId = path.parse(originalFilePath).name;
    const distDir = path.join(__dirname, '..', 'dist');
    const outputDir = path.join(distDir, 'hls', videoId);
    await generateHLS(originalFilePath, outputDir);
    const videoInfo = {
      id: videoId,
      originalName: `captured_${videoId}.ts`,
      hlsUrl: `/hls/${videoId}/master.m3u8`,
      segmentType: 'ts',
      uploadDate: new Date().toISOString()
    };
    fs.unlink(originalFilePath, () => {});
    convertedVideos.push(videoInfo);
    return res.json({ success: true, video: videoInfo });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Erro ao capturar/converter stream TS: ' + err.message });
  }
});

app.post('/capture/fmp4', async (req, res) => {
  const { url, duration } = req.body;
  if (!url) {
    return res.status(400).json({ success: false, error: 'URL é obrigatória.' });
  }
  let dur = duration && duration !== 'all' ? parseInt(duration) : undefined;
  try {
    const originalFilePath = await downloadHLSSegment(url, 'fmp4', dur);
    const videoId = path.parse(originalFilePath).name;
    const distDir = path.join(__dirname, '..', 'dist');
    const outputDir = path.join(distDir, 'hls', videoId);
    await generateHLS_fMP4(originalFilePath, outputDir);
    const videoInfo = {
      id: videoId,
      originalName: `captured_${videoId}.fmp4`,
      hlsUrl: `/hls/${videoId}/master.m3u8`,
      segmentType: 'mp4',
      uploadDate: new Date().toISOString()
    };
    fs.unlink(originalFilePath, () => {});
    convertedVideos.push(videoInfo);
    return res.json({ success: true, video: videoInfo });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Erro ao capturar/converter stream fMP4: ' + err.message });
  }
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