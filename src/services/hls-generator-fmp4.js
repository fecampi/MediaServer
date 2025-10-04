const ffmpeg = require("fluent-ffmpeg");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
const fs = require("fs");
const path = require("path");

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

/**
 * Função para gerar HLS com fMP4 a partir de um vídeo com múltiplas resoluções
 * @param {string} inputFile Caminho do arquivo de entrada (vídeo)
 * @param {string} outputFolder Caminho da pasta de saída
 */
async function generateHLS_fMP4(inputFile, outputFolder) {
  console.log("🎬 Iniciando processo de conversão HLS (fMP4)...");
  console.log(`📁 Arquivo de entrada: ${inputFile}`);
  // Força saída para dist/hls
  const distHls = path.join(__dirname, '..', '..', 'dist', 'hls');
  let finalOutputFolder = outputFolder;
  if (!outputFolder.startsWith(distHls)) {
    // Se não está em dist/hls, ajusta
    const baseName = path.basename(outputFolder);
    finalOutputFolder = path.join(distHls, baseName);
  }
  return new Promise((resolve, reject) => {
    ffmpeg(inputFile).ffprobe((err, metadata) => {
      if (err) {
        console.error("Erro ao obter metadados:", err);
        reject(err);
        return;
      }
      console.log("Metadados obtidos com sucesso!");
      // Obtém o primeiro fluxo de vídeo
      console.log("Procurando fluxo de vídeo nos metadados...");
      const videoStream = metadata.streams.find(
        (stream) => stream.codec_type === "video"
      );
      if (videoStream) {
        const width = videoStream.width;
        const height = videoStream.height;
        const duration = metadata.format.duration;
        const bitrate = metadata.format.bit_rate;

        console.log("Informações do vídeo original:");
        console.log(`   • Resolução: ${width}x${height}`);
        console.log(
          `   • Duração: ${duration ? Math.round(duration) : "N/A"} segundos`
        );
        console.log(
          `   • Bitrate: ${bitrate ? Math.round(bitrate / 1000) : "N/A"} kbps`
        );
        console.log(`   • Codec: ${videoStream.codec_name}`);

        // Resoluções desejadas
        const resolutions = [
          { label: "1080p", width: 1920, height: 1080 },
          { label: "720p", width: 1280, height: 720 },
          { label: "480p", width: 854, height: 480 },
          { label: "360p", width: 640, height: 360 },
        ];

        console.log("Filtrando resoluções compatíveis...");
        // Filtra as resoluções que são menores ou iguais à resolução original
        const validResolutions = resolutions.filter(
          (resolution) =>
            resolution.width <= width && resolution.height <= height
        );

        console.log(
          "Resoluções que serão processadas: " +
            validResolutions.map((r) => r.label).join(", ")
        );

        // Usa diretamente a pasta de saída informada
        const outputVideoFolder = finalOutputFolder;
        console.log(`Usando pasta de saída: ${outputVideoFolder}`);
        if (!fs.existsSync(outputVideoFolder)) {
          fs.mkdirSync(outputVideoFolder, { recursive: true });
          console.log("Pasta de saída criada com sucesso!");
        } else {
          console.log("Pasta de saída já existe");
        }

        // Gerar fluxos de vídeo e arquivos .m3u8 para cada resolução
        console.log("Iniciando processamento das resoluções...");
        let processedCount = 0;
        const totalResolutions = validResolutions.length;

        const videoStreams = validResolutions.map((resolution, index) => {
          return new Promise((resolve2, reject2) => {
            const outputFile = path.join(
              outputVideoFolder,
              `output_${resolution.label}.m3u8`
            );
            const segmentFile = path.join(
              outputVideoFolder,
              `output_${resolution.label}_%03d.m4s`
            );
            const initFile = path.join(
              outputVideoFolder,
              `init_${resolution.label}.mp4`
            );

            console.log(
              `Processando resolução ${resolution.label} (${
                index + 1
              }/${totalResolutions})`
            );
            console.log(`   Saída: ${path.basename(outputFile)}`);
            console.log(
              `   Resolução alvo: ${resolution.width}x${resolution.height}`
            );
            console.log(`   Formato: fMP4 (Fragmented MP4)`);

            const startTime = Date.now();

            ffmpeg(inputFile)
              .outputOptions([
                `-vf scale=${resolution.width}:${resolution.height}`, // Redimensionar para a resolução desejada
                "-c:v libx264",
                "-preset fast",
                "-crf 23",
                "-c:a aac",
                "-b:a 128k",
                "-f hls",
                "-hls_time 10",
                "-hls_list_size 0",
                "-hls_segment_type fmp4", // Usa fMP4 ao invés de TS
                `-hls_fmp4_init_filename init_${resolution.label}.mp4`, // Arquivo de inicialização
                `-hls_segment_filename ${segmentFile}`,
                "-movflags +faststart", // Otimização para streaming
                "-map 0:v:0",
                "-map 0:a:0?", // ? torna opcional
                "-map 0:a:1?",
                "-map 0:a:2?",
                "-map 0:a:3?",
                "-map 0:a:4?",
                "-map 0:a:5?",
              ])
              .output(outputFile)
              .on("start", (commandLine) => {
                console.log(`Comando FFmpeg iniciado para ${resolution.label}`);
                console.log(`   Comando: ${commandLine.substring(0, 100)}...`);
              })
              .on("progress", (progress) => {
                if (progress.percent) {
                  const percent = Math.round(progress.percent);
                  console.log(
                    `${resolution.label}: ${percent}% concluído (${
                      progress.currentFps || 0
                    } fps)`
                  );
                }
              })
              .on("end", () => {
                const endTime = Date.now();
                const duration = Math.round((endTime - startTime) / 1000);
                processedCount++;

                console.log(
                  `${resolution.label} processado com sucesso! (${duration}s)`
                );
                console.log(
                  `Progresso geral: ${processedCount}/${totalResolutions} resoluções concluídas`
                );
                resolve2();
              })
              .on("error", (err) => {
                console.error(
                  `Erro durante o processamento para ${resolution.label}: ${err.message}`
                );
                reject2(err);
              })
              .run();
          });
        });

        // Aguarda todos os vídeos serem gerados e cria o arquivo mestre M3U8
        console.log("Aguardando conclusão de todas as resoluções...");
        const startTime = Date.now();
        Promise.all(videoStreams)
          .then(() => {
            const totalTime = Math.round((Date.now() - startTime) / 1000);
            console.log(
              `Todas as resoluções processadas com sucesso! (Tempo total: ${totalTime}s)`
            );
            console.log("Criando arquivo mestre M3U8...");
            // Estimativas de largura de banda, average bandwidth, codecs e frame-rate para cada resolução
            const resolutionInfo = {
              "1080p": {
                bw: 4000000,
                avg: 3700000,
                codecs: "mp4a.40.2,avc1.640029",
                res: "1920x1080",
                fr: 30,
              },
              "720p": {
                bw: 2500000,
                avg: 2200000,
                codecs: "mp4a.40.2,avc1.64001F",
                res: "1280x720",
                fr: 30,
              },
              "480p": {
                bw: 1000000,
                avg: 900000,
                codecs: "mp4a.40.2,avc1.4d401e",
                res: "854x480",
                fr: 30,
              },
              "360p": {
                bw: 500000,
                avg: 400000,
                codecs: "mp4a.40.2,avc1.4d4015",
                res: "640x360",
                fr: 30,
              },
            };
            // Cabeçalho sem grupo de áudio
            let masterFileContent =
              "#EXTM3U\n#EXT-X-VERSION:6\n## Gerado por express-hls-example\n\n# variants\n";
            // Variants (apenas vídeo+áudio juntos)
            masterFileContent +=
              validResolutions
                .map((resolution) => {
                  const info = resolutionInfo[resolution.label];
                  return `#EXT-X-STREAM-INF:BANDWIDTH=${info.bw},AVERAGE-BANDWIDTH=${info.avg},CODECS=\"${info.codecs}\",RESOLUTION=${info.res},FRAME-RATE=${info.fr},CLOSED-CAPTIONS=NONE\noutput_${resolution.label}.m3u8`;
                })
                .join("\n") + "\n";
            // Cria o arquivo mestre M3U8
            const masterFile = path.join(outputVideoFolder, "master.m3u8");
            fs.writeFileSync(masterFile, masterFileContent);
            console.log("Arquivo mestre M3U8 gerado com sucesso!");
            console.log(`Arquivo criado: ${masterFile}`);
            console.log(
              "Processo de conversão HLS (fMP4) concluído com sucesso!"
            );
            console.log(`Estatísticas finais:`);
            console.log(
              `   Resoluções processadas: ${validResolutions.length}`
            );
            console.log(`   Tempo total: ${totalTime}s`);
            console.log(`   Formato: fMP4 (Fragmented MP4)`);
            console.log(`   Pasta de saída: ${outputVideoFolder}`);
            console.log("Vantagens do fMP4:");
            console.log("   Melhor compatibilidade com navegadores modernos");
            console.log(
              "   Suporte a recursos avançados (CMAF, Low-Latency HLS)"
            );
            console.log("   Melhor integração com DRM");
            resolve();
          })
          .catch((err) => {
            console.error(
              "Erro durante a criação dos arquivos de vídeo HLS:",
              err.message
            );
            console.error(
              "Verifique se o arquivo de entrada existe e está acessível"
            );
            reject(err);
          });
      } else {
        console.error("Fluxo de vídeo não encontrado nos metadados");
        console.log("Verifique se o arquivo é um vídeo válido");
        reject(new Error("Fluxo de vídeo não encontrado nos metadados"));
      }
    });
  });
}
module.exports = { generateHLS_fMP4 };
