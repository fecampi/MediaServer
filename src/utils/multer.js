const multer = require('multer');

// Configuração do Multer para upload de arquivos (memória)
const multerStorage = multer.memoryStorage();

const upload = multer({
  storage: multerStorage,
  fileFilter: (req, file, cb) => {
    // Aceitar apenas arquivos de vídeo
    const allowedMimes = [
      'video/mp4',
      'video/avi',
      'video/mov',
      'video/wmv',
      'video/flv',
      'video/webm',
      'video/mkv'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos de vídeo são permitidos!'), false);
    }
  },
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB
  }
});

module.exports = upload;
