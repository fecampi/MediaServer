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

// Initialize database
const databasePath = path.join(__dirname, "..", "database.json");
const db = new Database(databasePath);

// EJS configuration
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware to serve static files from dist folder
const distDir = path.join(__dirname, "..", "dist");
app.use("/public", express.static(path.join(distDir, "public")));
app.use("/hls", express.static(path.join(distDir, "hls")));
app.use("/uploads", express.static(path.join(distDir, "uploads")));

// Middleware for parsing JSON and URL encoded
app.use(express.json({ limit: "500mb" }));
app.use(express.urlencoded({ extended: true, limit: "500mb" }));

// Utility function to add video to database and respond
async function addVideoAndRespond(res, videoInfo, inputPath) {
  try {
    const savedVideo = await db.insert("videos", [videoInfo]);
    if (inputPath) fs.unlink(inputPath, () => {});
    return res.json({ success: true, video: savedVideo });
  } catch (error) {
    console.error("Error saving video to database:", error);
    return res.status(500).json({ error: "Error saving video to database" });
  }
}

// Generic function for HLS upload (TS or fMP4)
async function handleHLSUpload(req, res, format) {
  if (!req.file)
    return res.status(400).json({ error: "Nenhum arquivo enviado" });

  try {
    const { path: inputPath, filename } = await saveUploadToDisk(req.file);
    const videoId = path.parse(filename).name;
    const outputDir = path.join(__dirname, "..", "dist", "hls", videoId);

    await generateHLSUnified(inputPath, outputDir, {
      format,
      onEvent: () => {},
    });

    const videoInfo = {
      id: videoId,
      originalName: req.file.originalname,
      hlsUrl: `/hls/${videoId}/master.m3u8`,
      segmentType: format === "ts" ? "ts" : "fmp4",
      uploadDate: new Date().toISOString(),
    };

    return await addVideoAndRespond(res, videoInfo, inputPath);
  } catch (err) {
    return res
      .status(500)
      .json({
        error: `Error converting video to ${format === "ts" ? "TS" : "fMP4"}.`,
      });
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

app.post("/upload/:format", upload.single("video"), async (req, res) => {
  const format = req.params.format;
  if (format !== "ts" && format !== "fmp4") {
    return res.status(400).json({ error: "Formato inválido" });
  }

  // Conteúdo movido de handleHLSUpload
  if (!req.file)
    return res.status(400).json({ error: "Nenhum arquivo enviado" });

  try {
    const { path: inputPath, filename } = await saveUploadToDisk(req.file);
    const videoId = path.parse(filename).name;
    const outputDir = path.join(__dirname, "..", "dist", "hls", videoId);

    await generateHLSUnified(inputPath, outputDir, {
      format,
      onEvent: () => {},
    });

    const videoInfo = {
      id: videoId,
      originalName: req.file.originalname,
      hlsUrl: `/hls/${videoId}/master.m3u8`,
      segmentType: format,
      uploadDate: new Date().toISOString(),
    };

    return await addVideoAndRespond(res, videoInfo, inputPath);
  } catch (err) {
    return res
      .status(500)
      .json({
        error: `Error converting video to ${format === "ts" ? "TS" : "fMP4"}.`,
      });
  }
});

// Separate HLS capture routes by format
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
// Main route
app.get("/", async (req, res) => {
  try {
    // Fetch all videos from database
    const videos = await db.select("videos");

    // Build base URL (protocol, host, port)
    const baseUrl =
      req.protocol +
      "://" +
      req.hostname +
      (req.socket.localPort ? ":" + req.socket.localPort : "");

    // Add full URL to each video
    const videosWithFullUrl = videos.map((v) => ({
      ...v,
      fullUrl: baseUrl + v.hlsUrl,
    }));

    res.render("index", { videos: videosWithFullUrl });
  } catch (error) {
    console.error("Error fetching videos:", error);
    res.render("index", { videos: [] });
  }
});

app.get("/capture", (req, res) => {
  res.render("capture");
});

app.get("/upload", (req, res) => {
  res.render("upload", { videos: [] });
});

app.get("/videos", (req, res) => {
  res.render("videos", { videos: [] });
});

app.get("/videos", async (req, res) => {
  try {
    const videos = await db.select("videos");
    res.render("videos", { videos });
  } catch (error) {
    console.error("Error fetching videos:", error);
    res.render("videos", { videos: [] });
  }
});

// Route to serve .ts segments with correct headers
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

// API routes to manage videos
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
      return res.status(404).json({ error: "Vídeo não encontrado no banco" });
    }

    let fileFound = false;
    let fileDeleteError = null;

    // Check and delete original file (uploads or dist/uploads)
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
    // Check and delete HLS folder if TS or fMP4
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
    console.error("[DELETE] Unexpected error:", error);
    res.status(500).json({ error: "Erro ao deletar vídeo" });
  }
});

// Error handling middleware
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

  console.error("Error:", error);
  res.status(500).json({ error: "Erro interno do servidor" });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

module.exports = app;
