const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const fs = require('fs');
const path = require('path');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

/**
 * Função para gerar HLS a partir de um vídeo com múltiplas resoluções
 * @param {string} inputFile Caminho do arquivo de entrada (vídeo)
 * @param {string} outputFolder Caminho da pasta de saída
 */

async function generateHLS(inputFile, outputFolder) {
    return new Promise((resolve, reject) => {
        console.log('🎬 Iniciando processo de conversão HLS...');
        console.log(`📁 Arquivo de entrada: ${inputFile}`);
        console.log(`📂 Pasta de saída: ${outputFolder}`);
        console.log('🔍 Analisando metadados do vídeo...');
        ffmpeg(inputFile).ffprobe((err, metadata) => {
            if (err) {
                console.error('❌ Erro ao obter metadados:', err);
                reject(err);
                return;
            }
            console.log('✅ Metadados obtidos com sucesso!');
            // Obtém o primeiro fluxo de vídeo
            console.log('🔍 Procurando fluxo de vídeo nos metadados...');
            const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
            if (videoStream) {
                const width = videoStream.width;
                const height = videoStream.height;
                const duration = metadata.format.duration;
                const bitrate = metadata.format.bit_rate;
                console.log('📹 Informações do vídeo original:');
                console.log(`   • Resolução: ${width}x${height}`);
                console.log(`   • Duração: ${duration ? Math.round(duration) : 'N/A'} segundos`);
                console.log(`   • Bitrate: ${bitrate ? Math.round(bitrate/1000) : 'N/A'} kbps`);
                console.log(`   • Codec: ${videoStream.codec_name}`);
                // Resoluções desejadas
                const resolutions = [
                    { label: '1080p', width: 1920, height: 1080 },
                    { label: '720p', width: 1280, height: 720 },
                    { label: '480p', width: 854, height: 480 },
                    { label: '360p', width: 640, height: 360 }
                ];
                console.log('⚙️ Filtrando resoluções compatíveis...');
                // Filtra as resoluções que são menores ou iguais à resolução original
                const validResolutions = resolutions.filter(resolution => resolution.width <= width && resolution.height <= height);
                console.log(`📊 Resoluções que serão processadas: ${validResolutions.map(r => r.label).join(', ')}`);
                // Usa diretamente a pasta de saída informada
                const outputVideoFolder = outputFolder;
                console.log(`📁 Usando pasta de saída: ${outputVideoFolder}`);
                if (!fs.existsSync(outputVideoFolder)) {
                    fs.mkdirSync(outputVideoFolder, { recursive: true });
                    console.log('✅ Pasta de saída criada com sucesso!');
                } else {
                    console.log('📁 Pasta de saída já existe');
                }
                // Gerar fluxos de vídeo e arquivos .m3u8 para cada resolução
                console.log('🚀 Iniciando processamento das resoluções...');
                let processedCount = 0;
                const totalResolutions = validResolutions.length;
                const videoStreams = validResolutions.map((resolution, index) => {
                    return new Promise((resolve2, reject2) => {
                        const outputFile = path.join(outputVideoFolder, `output_${resolution.label}.m3u8`);
                        const segmentFile = path.join(outputVideoFolder, `output_${resolution.label}_%03d.ts`);
                        console.log(`\n🎯 Processando resolução ${resolution.label} (${index + 1}/${totalResolutions})`);
                        console.log(`   • Saída: ${path.basename(outputFile)}`);
                        console.log(`   • Resolução alvo: ${resolution.width}x${resolution.height}`);
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
                            .on('start', (commandLine) => {
                                console.log(`⚡ Comando FFmpeg iniciado para ${resolution.label}`);
                                console.log(`   Comando: ${commandLine.substring(0, 100)}...`);
                            })
                            .on('progress', (progress) => {
                                if (progress.percent) {
                                    const percent = Math.round(progress.percent);
                                    console.log(`📊 ${resolution.label}: ${percent}% concluído (${progress.currentFps || 0} fps)`);
                                }
                            })
                            .on('end', () => {
                                const endTime = Date.now();
                                const duration = Math.round((endTime - startTime) / 1000);
                                processedCount++;
                                console.log(`✅ ${resolution.label} processado com sucesso! (${duration}s)`);
                                console.log(`📈 Progresso geral: ${processedCount}/${totalResolutions} resoluções concluídas`);
                                resolve2();
                            })
                            .on('error', (err) => {
                                console.error(`❌ Erro durante o processamento para ${resolution.label}:`, err.message);
                                reject2(err);
                            })
                            .run();
                    });
                });
                // Aguarda todos os vídeos serem gerados e cria o arquivo mestre M3U8
                console.log('\n⏳ Aguardando conclusão de todas as resoluções...');
                const startTime = Date.now();
                Promise.all(videoStreams)
                    .then(() => {
                        const totalTime = Math.round((Date.now() - startTime) / 1000);
                        console.log(`\n🎉 Todas as resoluções processadas com sucesso! (Tempo total: ${totalTime}s)`);
                        console.log('📝 Criando arquivo mestre M3U8...');
                        // Estimativas de largura de banda para cada resolução (em Kbps)
                        const resolutionBandwidth = {
                            '1080p': 4000000,
                            '720p': 2500000,
                            '480p': 1000000,
                            '360p': 500000
                        };
                        console.log('⚙️ Configurando larguras de banda para cada resolução:');
                        const masterPlaylist = validResolutions.map(resolution => {
                            const bandWidth = resolutionBandwidth[resolution.label] || 1000000;
                            console.log(`   • ${resolution.label}: ${bandWidth/1000} Kbps`);
                            return `#EXT-X-STREAM-INF:BANDWIDTH=${bandWidth},RESOLUTION=${resolution.width}x${resolution.height}\noutput_${resolution.label}.m3u8`;
                        }).join('\n');
                        // Adiciona as informações de cabeçalho para o arquivo mestre
                        const masterFileContent = `#EXTM3U\n${masterPlaylist}`;
                        // Cria o arquivo mestre M3U8
                        const masterFile = path.join(outputVideoFolder, 'master.m3u8');
                        fs.writeFileSync(masterFile, masterFileContent);
                        console.log('✅ Arquivo mestre M3U8 gerado com sucesso!');
                        console.log(`📁 Arquivo criado: ${masterFile}`);
                        console.log('\n🏁 Processo de conversão HLS concluído com sucesso!');
                        console.log(`📊 Estatísticas finais:`);
                        console.log(`   • Resoluções processadas: ${validResolutions.length}`);
                        console.log(`   • Tempo total: ${totalTime}s`);
                        console.log(`   • Pasta de saída: ${outputVideoFolder}`);
                        resolve();
                    })
                    .catch(err => {
                        console.error('\n❌ Erro durante a criação dos arquivos de vídeo HLS:', err.message);
                        console.error('💡 Verifique se o arquivo de entrada existe e está acessível');
                        reject(err);
                    });
            } else {
                console.error('❌ Fluxo de vídeo não encontrado nos metadados');
                console.log('💡 Verifique se o arquivo é um vídeo válido');
                reject(new Error('Fluxo de vídeo não encontrado nos metadados'));
            }
        });
    });
}

module.exports = { generateHLS };