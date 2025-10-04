const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const fs = require('fs');
const path = require('path');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

/**
 * Function to generate HLS from a video with multiple resolutions
 * @param {string} inputFile Input file path (video)
 * @param {string} outputFolder Output folder path
 */

async function generateHLS(inputFile, outputFolder) {
    // Force output to dist/hls
    const distHls = path.join(__dirname, '..', '..', 'dist', 'hls');
    let finalOutputFolder = outputFolder;
    if (!outputFolder.startsWith(distHls)) {
        // If not in dist/hls, adjust
        const baseName = path.basename(outputFolder);
        finalOutputFolder = path.join(distHls, baseName);
    }
    return new Promise((resolve, reject) => {
        ffmpeg(inputFile).ffprobe((err, metadata) => {
            if (err) {
                console.error('Error getting metadata:', err);
                reject(err);
                return;
            }
            const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
            if (videoStream) {
                const width = videoStream.width;
                const height = videoStream.height;
                const duration = metadata.format.duration;
                const bitrate = metadata.format.bit_rate;
                // Desired resolutions
                const resolutions = [
                    { label: '1080p', width: 1920, height: 1080 },
                    { label: '720p', width: 1280, height: 720 },
                    { label: '480p', width: 854, height: 480 },
                    { label: '360p', width: 640, height: 360 }
                ];
                // Filter resolutions that are smaller or equal to original
                const validResolutions = resolutions.filter(resolution => resolution.width <= width && resolution.height <= height);
                // Use the provided output folder directly
                const outputVideoFolder = finalOutputFolder;
                if (!fs.existsSync(outputVideoFolder)) {
                    fs.mkdirSync(outputVideoFolder, { recursive: true });
                }
                // Generate video streams and .m3u8 files for each resolution
                let processedCount = 0;
                const totalResolutions = validResolutions.length;
                const videoStreams = validResolutions.map((resolution, index) => {
                    return new Promise((resolve2, reject2) => {
                        const outputFile = path.join(outputVideoFolder, `output_${resolution.label}.m3u8`);
                        const segmentFile = path.join(outputVideoFolder, `output_${resolution.label}_%03d.ts`);
                        const startTime = Date.now();
                        ffmpeg(inputFile)
                            .outputOptions([
                                `-vf scale=${resolution.width}:${resolution.height}`,
                                '-c:v libx264',
                                '-preset fast',
                                '-crf 23',
                                '-c:a aac',
                                '-b:a 128k',
                                '-f hls',
                                `-hls_time 10`,
                                `-hls_list_size 0`,
                                `-hls_segment_filename ${segmentFile}`,
                                '-map 0:v:0',
                                '-map 0:a:0?',
                                '-map 0:a:1?',
                                '-map 0:a:2?',
                                '-map 0:a:3?',
                                '-map 0:a:4?',
                                '-map 0:a:5?'
                            ])
                            .output(outputFile)
                            .on('start', () => {})
                            .on('progress', () => {})
                            .on('end', () => {
                                processedCount++;
                                resolve2();
                            })
                            .on('error', (err) => {
                                console.error(`Error processing ${resolution.label}:`, err.message);
                                reject2(err);
                            })
                            .run();
                    });
                });
                // Wait for all videos to be generated and create master M3U8 file
                const startTime = Date.now();
                Promise.all(videoStreams)
                    .then(() => {
                        const totalTime = Math.round((Date.now() - startTime) / 1000);
                        // Bandwidth estimates for each resolution (in Kbps)
                        const resolutionBandwidth = {
                            '1080p': 4000000,
                            '720p': 2500000,
                            '480p': 1000000,
                            '360p': 500000
                        };
                        const masterPlaylist = validResolutions.map(resolution => {
                            const bandWidth = resolutionBandwidth[resolution.label] || 1000000;
                            return `#EXT-X-STREAM-INF:BANDWIDTH=${bandWidth},RESOLUTION=${resolution.width}x${resolution.height}\noutput_${resolution.label}.m3u8`;
                        }).join('\n');
                        // Add header information for master file
                        const masterFileContent = `#EXTM3U\n${masterPlaylist}`;
                        // Create master M3U8 file
                        const masterFile = path.join(outputVideoFolder, 'master.m3u8');
                        fs.writeFileSync(masterFile, masterFileContent);
                        resolve();
                    })
                    .catch(err => {
                        console.error('Error creating HLS video files:', err.message);
                        reject(err);
                    });
            } else {
                console.error('Video stream not found in metadata');
                reject(new Error('Video stream not found in metadata'));
            }
        });
    });
}

module.exports = { generateHLS };