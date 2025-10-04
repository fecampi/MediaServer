const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

// Forçar FFmpeg do sistema (versão 4.4.2) em vez do pacote npm antigo (2018)
ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');
ffmpeg.setFfprobePath('/usr/bin/ffprobe');

async function downloadHLSSegment(m3u8Url, format = "mp4", duration) {
  return new Promise((resolve, reject) => {
    const uploadsDir = path.join(__dirname, "..", "..", "dist", "uploads");
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const outputFile = path.join(
      uploadsDir,
      `${uuidv4()}.mkv`
    );

    // Criar instância do ffmpeg e forçar o caminho do sistema
    let command = ffmpeg(m3u8Url);
    command.setFfmpegPath('/usr/bin/ffmpeg');
    command.setFfprobePath('/usr/bin/ffprobe');

    if (duration) command = command.setDuration(duration);

    // Sempre baixar em formato original (mkv) - conversão será feita depois se necessário
    command = command
      .videoCodec("copy")
      .audioCodec("eac3")
      .audioBitrate("640k")
      .outputOptions(["-movflags", "+faststart"])
      .format("matroska"); // .mkv format

    console.log("[downloadHLSSegment] Iniciando captura HLS:");
    console.log("  URL:", m3u8Url);
    console.log("  Formato:", format);
    console.log("  Duração:", duration || "completa");
    console.log("  Arquivo de saída:", outputFile);
    console.log("  FFmpeg path configurado:", ffmpeg().options.ffmpegPath || 'default');

    command
      .on("start", (cmdLine) => {
        console.log("[downloadHLSSegment] Comando FFmpeg:", cmdLine);
        console.log("[downloadHLSSegment] FFmpeg iniciado, PID:", command.ffmpegProc?.pid);
      })
      .on("progress", (progress) => {
        console.log(`[downloadHLSSegment] Progresso:`, progress);
        if (progress.percent) {
          console.log(`[downloadHLSSegment] Progresso: ${progress.percent.toFixed(2)}%`);
        }
      })
      .on("stderr", (stderrLine) => {
        console.log("[downloadHLSSegment] FFmpeg stderr:", stderrLine);
      })
      .on("error", (err, stdout, stderr) => {
        console.error("[downloadHLSSegment] Erro completo:", err);
        console.error("[downloadHLSSegment] stdout:", stdout);
        console.error("[downloadHLSSegment] stderr:", stderr);
        console.error("[downloadHLSSegment] Error stack:", err.stack);
        reject(err);
      })
      .on("end", (stdout, stderr) => {
        console.log("[downloadHLSSegment] Download concluído:", outputFile);
        console.log("[downloadHLSSegment] stdout final:", stdout);
        console.log("[downloadHLSSegment] stderr final:", stderr);
        resolve(outputFile);
      })
      .save(outputFile);
  });
}

module.exports = { downloadHLSSegment };
