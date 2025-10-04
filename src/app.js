const { downloadHLSSegment } = require("./services/downloadHLSSegment");
const { generateHLSUnified } = require("./services/generateHLSUnified");
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { generateHLS } = require("./services/hls-generator-ts");
const { generateHLS_fMP4 } = require("./services/hls-generator-fmp4");
const { saveUploadToDisk } = require("./services/save-upload");
const upload = require("./utils/multer");
const { Database } = require("../src/database/Database");

const app = express();
const PORT = process.env.PORT || 3000;

// Inicializar o banco de dados
const databasePath = path.join(__dirname, "..", "database.json");
const db = new Database(databasePath);

// Configuração do EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware para servir arquivos estáticos da pasta dist
const distDir = path.join(__dirname, "..", "dist");
app.use("/public", express.static(path.join(distDir, "public")));
app.use("/hls", express.static(path.join(distDir, "hls")));
app.use("/uploads", express.static(path.join(distDir, "uploads")));

// Middleware para parsing de JSON e URL encoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Função utilitária para adicionar vídeo ao banco e responder
async function addVideoAndRespond(res, videoInfo, inputPath) {
  try {
    const savedVideo = await db.insert("videos", [videoInfo]);
    if (inputPath) fs.unlink(inputPath, () => {});
    return res.json({ success: true, video: savedVideo });
  } catch (error) {
    console.error("Erro ao salvar vídeo no banco:", error);
    return res
      .status(500)
      .json({ error: "Erro ao salvar vídeo no banco de dados" });
  }
}

// Função genérica para upload HLS (TS ou fMP4)
async function handleHLSUpload(req, res, format) {
  if (!req.file)
    return res.status(400).json({ error: "Nenhum arquivo enviado" });

  try {
    const { path: inputPath, filename } = await saveUploadToDisk(req.file);
    const videoId = path.parse(filename).name;
    const outputDir = path.join(__dirname, "..", "dist", "hls", videoId);

    await generateHLSUnified(inputPath, outputDir, {
      format,
      onEvent: (event) => {
        console.log(`[${event.type}]`, event.data);
      },
    });

    const videoInfo = {
      id: videoId,
      originalName: req.file.originalname,
      hlsUrl: `/hls/${videoId}/master.m3u8`,
      segmentType: format === "ts" ? "ts" : "mp4",
      uploadDate: new Date().toISOString(),
    };

    return await addVideoAndRespond(res, videoInfo, inputPath);
  } catch (err) {
    return res.status(500).json({ error: `Erro ao converter vídeo para ${format === "ts" ? "TS" : "fMP4"}.` });
  }
}

app.post("/upload/original", upload.single("video"), async (req, res) => {
  if (!req.file)
    return res.status(400).json({ error: "Nenhum arquivo enviado" });
  try {
    const { path: inputPath, filename } = await saveUploadToDisk(req.file);
    const videoId = path.parse(filename).name;
    const videoInfo = {
      id: videoId,
      originalName: req.file.originalname,
      hlsUrl: `/uploads/${filename}`,
      segmentType: "original",
      uploadDate: new Date().toISOString(),
    };
    return await addVideoAndRespond(res, videoInfo);
  } catch (err) {
    return res.status(500).json({ error: "Erro ao salvar vídeo original." });
  }
});

app.post("/upload/:format", upload.single("video"), (req, res) => {
  const format = req.params.format;
  if (format !== "ts" && format !== "fmp4") {
    return res.status(400).json({ error: "Formato inválido" });
  }
  return handleHLSUpload(req, res, format);
});

// Rotas de captura HLS separadas por formato
app.post("/capture/original", async (req, res) => {
  const { url, duration } = req.body;
  if (!url) {
    return res
      .status(400)
      .json({ success: false, error: "URL é obrigatória." });
  }
  let dur = duration && duration !== "all" ? parseInt(duration) : undefined;
  try {
    const originalFilePath = await downloadHLSSegment(url, "original", dur);
    const videoId = path.parse(originalFilePath).name;
    const videoInfo = {
      id: videoId,
      originalName: path.basename(originalFilePath),
      hlsUrl: `/uploads/${path.basename(originalFilePath)}`,
      segmentType: "original",
      uploadDate: new Date().toISOString(),
    };
    const savedVideo = await db.insert("videos", [videoInfo]);
    return res.json({ success: true, video: savedVideo });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Erro ao capturar stream: " + err.message,
    });
  }
});

app.post("/capture/ts", async (req, res) => {
  const { url, duration } = req.body;
  if (!url) {
    return res
      .status(400)
      .json({ success: false, error: "URL é obrigatória." });
  }
  let dur = duration && duration !== "all" ? parseInt(duration) : undefined;
  try {
    const originalFilePath = await downloadHLSSegment(url, "ts", dur);
    const videoId = path.parse(originalFilePath).name;
    const distDir = path.join(__dirname, "..", "dist");
    const outputDir = path.join(distDir, "hls", videoId);
    await generateHLS(originalFilePath, outputDir);
    const videoInfo = {
      id: videoId,
      originalName: `captured_${videoId}.ts`,
      hlsUrl: `/hls/${videoId}/master.m3u8`,
      segmentType: "ts",
      uploadDate: new Date().toISOString(),
    };
    fs.unlink(originalFilePath, () => {});
    const savedVideo = await db.insert("videos", [videoInfo]);
    return res.json({ success: true, video: savedVideo });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Erro ao capturar/converter stream TS: " + err.message,
    });
  }
});

app.post("/capture/fmp4", async (req, res) => {
  const { url, duration } = req.body;
  if (!url) {
    return res
      .status(400)
      .json({ success: false, error: "URL é obrigatória." });
  }
  let dur = duration && duration !== "all" ? parseInt(duration) : undefined;
  try {
    const originalFilePath = await downloadHLSSegment(url, "fmp4", dur);
    const videoId = path.parse(originalFilePath).name;
    const distDir = path.join(__dirname, "..", "dist");
    const outputDir = path.join(distDir, "hls", videoId);
    await generateHLS_fMP4(originalFilePath, outputDir);
    const videoInfo = {
      id: videoId,
      originalName: `captured_${videoId}.fmp4`,
      hlsUrl: `/hls/${videoId}/master.m3u8`,
      segmentType: "mp4",
      uploadDate: new Date().toISOString(),
    };
    fs.unlink(originalFilePath, () => {});
    const savedVideo = await db.insert("videos", [videoInfo]);
    return res.json({ success: true, video: savedVideo });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Erro ao capturar/converter stream fMP4: " + err.message,
    });
  }
});
// Rota principal
app.get("/", async (req, res) => {
  try {
    // Busca todos os vídeos do banco de dados
    const videos = await db.select("videos");

    // Monta a base da URL (protocolo, host, porta)
    const baseUrl =
      req.protocol +
      "://" +
      req.hostname +
      (req.socket.localPort ? ":" + req.socket.localPort : "");

    // Adiciona a url completa em cada vídeo
    const videosWithFullUrl = videos.map((v) => ({
      ...v,
      fullUrl: baseUrl + v.hlsUrl,
    }));

    res.render("index", { videos: videosWithFullUrl });
  } catch (error) {
    console.error("Erro ao buscar vídeos:", error);
    res.render("index", { videos: [] });
  }
});

// Rota para servir segmentos .ts com headers corretos
app.get("/hls/:id/*.ts", (req, res) => {
  const filePath = path.join(
    __dirname,
    "hls",
    req.params.id,
    req.params[0] + ".ts"
  );

  if (!fs.existsSync(filePath)) {
    return res.status(404).send("Segmento não encontrado");
  }

  res.setHeader("Content-Type", "video/mp2t");
  res.setHeader("Cache-Control", "public, max-age=31536000");
  res.sendFile(filePath);
});

// Rotas API para gerenciar vídeos
app.get("/api/videos", async (req, res) => {
  try {
    const videos = await db.select("videos");
    res.json(videos);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar vídeos" });
  }
});

app.get("/api/videos/:id", async (req, res) => {
  try {
    const video = await db.findById("videos", req.params.id);
    if (!video) {
      return res.status(404).json({ error: "Vídeo não encontrado" });
    }
    res.json(video);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar vídeo" });
  }
});

app.delete("/api/videos/:id", async (req, res) => {
  try {
    const video = await db.findById("videos", req.params.id);
    if (!video) {
      console.log("[DELETE] Vídeo não encontrado no banco");
      return res.status(404).json({ error: "Vídeo não encontrado no banco" });
    }

    let fileFound = false;
    let fileDeleteError = null;

    // Verifica e apaga arquivo original (uploads ou dist/uploads)
    if (
      video.segmentType === "original" &&
      video.hlsUrl.startsWith("/uploads/")
    ) {
      const filePath1 = path.join(__dirname, "..", video.hlsUrl);
      const filePath2 = path.join(__dirname, "..", "dist", video.hlsUrl);
      let found = false;
      for (const filePath of [filePath1, filePath2]) {
        if (fs.existsSync(filePath)) {
          fileFound = true;
          found = true;
          try {
            fs.unlinkSync(filePath);
          } catch (err) {
            fileDeleteError = err;
          }
        }
      }
    }
    // Verifica e apaga pasta HLS se for TS ou fMP4
    if (
      (video.segmentType === "ts" || video.segmentType === "mp4") &&
      video.hlsUrl.startsWith("/hls/")
    ) {
      const hlsDir = path.join(__dirname, "..", "dist", "hls", video.id);
      if (fs.existsSync(hlsDir)) {
        fileFound = true;
        try {
          fs.rmSync(hlsDir, { recursive: true, force: true });
        } catch (err) {
          fileDeleteError = err;
        }
      }
    }

    if (fileDeleteError) {
      return res.status(500).json({
        error: "Erro ao apagar arquivos do vídeo",
        details: fileDeleteError.message,
      });
    }

    const deleted = await db.delete("videos", req.params.id);
    if (!deleted) {
      return res
        .status(500)
        .json({ error: "Erro ao remover vídeo do banco de dados" });
    }
    res.json({ success: true, message: "Vídeo deletado com sucesso" });
  } catch (error) {
    console.error("[DELETE] Erro inesperado:", error);
    res.status(500).json({ error: "Erro ao deletar vídeo" });
  }
});

// Middleware de tratamento de erros
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ error: "Arquivo muito grande! Máximo 500MB." });
    }
  }

  if (error.message === "Apenas arquivos de vídeo são permitidos!") {
    return res.status(400).json({ error: error.message });
  }

  console.error("Erro:", error);
  res.status(500).json({ error: "Erro interno do servidor" });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log("Certifique-se de que o GStreamer está instalado no sistema!");
  console.log(
    "Para instalar no Ubuntu/Debian: sudo apt install gstreamer1.0-tools gstreamer1.0-plugins-base gstreamer1.0-plugins-good gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly"
  );
});

module.exports = app;
