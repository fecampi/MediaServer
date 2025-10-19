const express = require("express");
const multer = require("multer");
const path = require("path");
const db = require("./database/Database");


const upload = require("./utils/multer");


//controllers
const videoController = require("./controllers/videoController");
const uploadController = require("./controllers/uploadController");

const app = express();
const PORT = process.env.PORT || 3000;




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

app.post("/upload/original", upload.single("video"), (req, res) =>
  uploadController.uploadOriginal(req, res)
);

app.post("/upload/:format", upload.single("video"), (req, res) =>
  uploadController.uploadFormat(req, res)
);

app.post("/capture/original", (req, res) =>
  videoController.captureOriginal(req, res)
);

app.post("/capture/ts", (req, res) => videoController.captureTS(req, res));

app.post("/capture/fmp4", (req, res) =>
  videoController.captureFMP4(req, res)
);
// Main route
app.get("/", (req, res) => videoController.renderIndex(req, res));

app.get("/capture", (req, res) => {
  res.render("capture");
});

app.get("/upload", (req, res) => {
  res.render("upload", { videos: [] });
});

app.get("/videos", (req, res) => {
  res.render("videos", { videos: [] });
});

app.get("/videos", (req, res) => videoController.renderVideos(req, res));

// Route to serve .ts segments with correct headers
app.get("/hls/:id/*.ts", (req, res) =>
  videoController.serveTsSegment(req, res)
);

// API routes to manage videos
app.get("/api/videos", async (req, res) => {
  try {
    const videos = await db.select("videos");
    res.json(videos);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar vídeos" });
  }
});

app.get("/api/videos/:id", (req, res) =>
  videoController.getVideoById(req, res)
);

app.delete("/api/videos/:id", (req, res) =>
  videoController.deleteVideo(req, res)
);

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
