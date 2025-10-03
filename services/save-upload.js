const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * Salva um arquivo de upload no disco, na pasta 'uploads/'.
 * @param {object} file - Objeto file do multer
 * @returns {Promise<{ path: string, filename: string }>} Caminho e nome do arquivo salvo
 */
async function saveUploadToDisk(file) {
  if (!file) throw new Error('Arquivo não fornecido');
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    await fsp.mkdir(uploadsDir, { recursive: true });
  }
  const uniqueName = uuidv4() + path.extname(file.originalname);
  const destPath = path.join(uploadsDir, uniqueName);
  await fsp.writeFile(destPath, file.buffer);
  return { path: destPath, filename: uniqueName };
}

module.exports = { saveUploadToDisk };
