const ffmpeg = require("fluent-ffmpeg");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
const fs = require("fs");
const path = require("path");

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

/**
 * Função única para gerar HLS (TS ou fMP4) a partir de um vídeo com múltiplas resoluções
 * @param {string} inputFile Caminho do arquivo de entrada (vídeo)
 * @param {string} outputFolder Caminho da pasta de saída
 * @param {Object} options Configurações extras
 * @param {"ts"|"fmp4"} [options.format="ts"] Formato de saída
 * @param {(event: {type: string, data?: any}) => void} [options.onEvent] Callback para eventos (start, progress, end, error, done)
 */
async function generateHLSUnified(inputFile, outputFolder, options = {}) {
  const { format = "ts", onEvent } = options;

  const distHls = path.join(__dirname, "..", "..", "dist", "hls");
  let finalOutputFolder = outputFolder;

  if (!outputFolder.startsWith(distHls)) {
    const baseName = path.basename(outputFolder);
    finalOutputFolder = path.join(distHls, baseName);
  }

  return new Promise((resolve, reject) => {
    ffmpeg(inputFile).ffprobe((err, metadata) => {
      if (err) {
        onEvent?.({ type: "error", data: err });
        return reject(err);
      }

      const videoStream = metadata.streams.find((s) => s.codec_type === "video");
      if (!videoStream) {
        const error = new Error("Fluxo de vídeo não encontrado nos metadados");
        onEvent?.({ type: "error", data: error });
        return reject(error);
      }

      const width = videoStream.width;
      const height = videoStream.height;
      const resolutions = [
        { label: "1080p", width: 1920, height: 1080 },
        { label: "720p", width: 1280, height: 720 },
        { label: "480p", width: 854, height: 480 },
        { label: "360p", width: 640, height: 360 },
      ];
      const validResolutions = resolutions.filter(
        (r) => r.width <= width && r.height <= height
      );

      if (!fs.existsSync(finalOutputFolder)) {
        fs.mkdirSync(finalOutputFolder, { recursive: true });
      }

      const tasks = validResolutions.map((res) => {
        return new Promise((resolve2, reject2) => {
          const ext = format === "fmp4" ? "m4s" : "ts";
          const outputFile = path.join(finalOutputFolder, `output_${res.label}.m3u8`);
          const segmentFile = path.join(finalOutputFolder, `output_${res.label}_%03d.${ext}`);

          const args = [
            `-vf scale=${res.width}:${res.height}`,
            "-c:v libx264",
            "-preset fast",
            "-crf 23",
            "-c:a aac",
            "-b:a 128k",
            "-f hls",
            "-hls_time 10",
            "-hls_list_size 0",
            `-hls_segment_filename ${segmentFile}`,
            "-map 0:v:0",
            "-map 0:a:0?",
          ];

          if (format === "fmp4") {
            args.push("-hls_segment_type fmp4");
            args.push(`-hls_fmp4_init_filename init_${res.label}.mp4`);
            args.push("-movflags +faststart");
          }

          const command = ffmpeg(inputFile)
            .outputOptions(args)
            .output(outputFile);

          command
            .on("start", (cmd) => {
              onEvent?.({ type: "start", data: { resolution: res.label, command: cmd } });
            })
            .on("progress", (progress) => {
              onEvent?.({ type: "progress", data: { resolution: res.label, progress } });
            })
            .on("end", () => {
              onEvent?.({ type: "end", data: { resolution: res.label } });
              resolve2();
            })
            .on("error", (err) => {
              onEvent?.({ type: "error", data: { resolution: res.label, error: err } });
              reject2(err);
            })
            .run();
        });
      });

      Promise.all(tasks)
        .then(() => {
          const master = validResolutions
            .map((res) => {
              return `#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=${res.width}x${res.height}\noutput_${res.label}.m3u8`;
            })
            .join("\n");

          fs.writeFileSync(
            path.join(finalOutputFolder, "master.m3u8"),
            "#EXTM3U\n" + master
          );

          onEvent?.({ type: "done", data: { outputFolder: finalOutputFolder } });
          resolve();
        })
        .catch(reject);
    });
  });
}

module.exports = { generateHLSUnified };
