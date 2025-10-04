const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

// Force system FFmpeg (version 4.4.2) instead of old npm package (2018)
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

    // Create ffmpeg instance and force system path
    let command = ffmpeg(m3u8Url);
    command.setFfmpegPath('/usr/bin/ffmpeg');
    command.setFfprobePath('/usr/bin/ffprobe');

    if (duration) command = command.setDuration(duration);

    // Always download in original format (mkv) - conversion will be done later if necessary
    command = command
      .videoCodec("copy")
      .audioCodec("eac3")
      .audioBitrate("640k")
      .outputOptions(["-movflags", "+faststart"])
      .format("matroska"); // .mkv format

    command
      .on("start", (cmdLine) => {
      })
      .on("progress", (progress) => {
      })
      .on("stderr", (stderrLine) => {
      })
      .on("error", (err, stdout, stderr) => {
        console.error("[downloadHLSSegment] Error:", err);
        reject(err);
      })
      .on("end", (stdout, stderr) => {
        resolve(outputFile);
      })
      .save(outputFile);
  });
}

module.exports = { downloadHLSSegment };
