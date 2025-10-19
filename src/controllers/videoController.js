const fs = require("fs");
const { downloadHLSSegment } = require("../services/downloadHLSSegment");
const { generateHLS } = require("../services/hls-generator-ts");
const db = require("../database/Database");

module.exports = {
  captureOriginal: async (req, res) => {
    const path = require("path");
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
  },
  captureFMP4: async (req, res) => {
    const path = require("path");
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
      const { generateHLS_fMP4 } = require("../services/hls-generator-fmp4");
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
  },
  captureTS: async (req, res) => {
    const path = require("path");
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
  },
  renderIndex: async (req, res) => {
    try {
      const videos = await db.select("videos");
      const baseUrl =
        req.protocol +
        "://" +
        req.hostname +
        (req.socket.localPort ? ":" + req.socket.localPort : "");
      const videosWithFullUrl = videos.map((v) => ({
        ...v,
        fullUrl: baseUrl + v.hlsUrl,
      }));
      res.render("index", { videos: videosWithFullUrl });
    } catch (error) {
      console.error("Error fetching videos:", error);
      res.render("index", { videos: [] });
    }
  },
  deleteVideo: async (req, res) => {
    const path = require("path");
    const fs = require("fs");
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
        for (const filePath of [filePath1, filePath2]) {
          if (fs.existsSync(filePath)) {
            fileFound = true;
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
  },
  renderVideos: async (req, res) => {
    try {
      const videos = await db.select("videos");
      res.render("videos", { videos });
    } catch (error) {
      console.error("Error fetching videos:", error);
      res.render("videos", { videos: [] });
    }
  },
  getVideoById: async (req, res) => {
    try {
      const video = await db.findById("videos", req.params.id);
      if (!video) {
        return res.status(404).json({ error: "Vídeo não encontrado" });
      }
      res.json(video);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar vídeo" });
    }
  },
  serveTsSegment: (req, res) => {
    const path = require("path");
    const fs = require("fs");
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
  }
};
