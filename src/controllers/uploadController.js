const db = require("../database/Database");

module.exports = {
  uploadArquivo: (req, res) => {
    res.send("Upload de arquivo");
  },
  listarUploads: (req, res) => {
    // Lógica para listar uploads
    res.send("Listar uploads");
  },
  uploadOriginal: async (req, res) => {
    const path = require("path");
    const { saveUploadToDisk } = require("../services/save-upload");
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
      try {
        const savedVideo = await db.insert("videos", [videoInfo]);
        return res.json({ success: true, video: savedVideo });
      } catch (error) {
        console.error("Error saving video to database:", error);
        return res
          .status(500)
          .json({ error: "Error saving video to database" });
      }
    } catch (err) {
      return res.status(500).json({ error: "Erro ao salvar vídeo original." });
    }
  },
  uploadFormat: async (req, res) => {
    const path = require("path");
    const { saveUploadToDisk } = require("../services/save-upload");
    const { generateHLSUnified } = require("../services/generateHLSUnified");
    const format = req.params.format;
    if (format !== "ts" && format !== "fmp4") {
      return res.status(400).json({ error: "Formato inválido" });
    }
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
      // Função utilitária igual ao app.js
      try {
        const savedVideo = await db.insert("videos", [videoInfo]);
        if (inputPath) require("fs").unlink(inputPath, () => {});
        return res.json({ success: true, video: savedVideo });
      } catch (error) {
        console.error("Error saving video to database:", error);
        return res
          .status(500)
          .json({ error: "Error saving video to database" });
      }
    } catch (err) {
      return res.status(500).json({
        error: `Error converting video to ${format === "ts" ? "TS" : "fMP4"}.`,
      });
    }
  },
};
