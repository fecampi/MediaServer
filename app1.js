const express = require("express");
const { captureStream } = require("./controllers/captureController");
const { uploadVideo, setConvertedVideos } = require("./controllers/uploadController");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const upload = require("./utils/multer");

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware para servir arquivos estáticos
app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/hls", express.static(path.join(__dirname, "hls")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Middleware para parsing de JSON e URL encoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Lista de vídeos convertidos (em produção, usar banco de dados)
let convertedVideos = [];
setConvertedVideos(convertedVideos);
// Rota principal
app.get("/", (req, res) => {
  // Monta a base da URL (protocolo, host, porta)
  const baseUrl =
    req.protocol +
    "://" +
    req.hostname +
    (req.socket.localPort ? ":" + req.socket.localPort : "");
  // Adiciona a url completa em cada vídeo
  const videosWithFullUrl = convertedVideos.map((v) => ({
    ...v,
    fullUrl: baseUrl + v.hlsUrl,
  }));
  res.render("index", { videos: videosWithFullUrl });
});

// Rota para upload de vídeo com escolha de formato
app.post("/upload", upload.single("video"), uploadVideo);

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

// HLS Capture endpoint
app.post("/capture", captureStream);

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
