import React, { useState, useRef } from 'react';
import { Container, Typography, Box, Button, LinearProgress, Card, CardContent, Grid, Snackbar, Alert } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import axios from 'axios';
import Hls from 'hls.js';

function App() {
  const [videos, setVideos] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [current, setCurrent] = useState(null);
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });
  const videoRef = useRef();

  React.useEffect(() => {
    axios.get('/api/videos').then(r => setVideos(r.data));
  }, []);

  const handleFile = e => {
    setSelectedFile(e.target.files[0]);
  };

  const handleUpload = async e => {
    e.preventDefault();
    if (!selectedFile) return;
    setUploading(true);
    setProgress(0);
    const formData = new FormData();
    formData.append('video', selectedFile);
    try {
      const res = await axios.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: p => setProgress(Math.round((p.loaded * 100) / p.total))
      });
      setSnack({ open: true, msg: 'Upload e conversão concluídos!', severity: 'success' });
      setVideos(v => [...v, res.data.video]);
      setSelectedFile(null);
      setCurrent(res.data.video);
    } catch (err) {
      setSnack({ open: true, msg: err.response?.data?.error || 'Erro no upload', severity: 'error' });
    }
    setUploading(false);
    setProgress(0);
  };

  const playVideo = video => {
    setCurrent(video);
    setTimeout(() => {
      if (videoRef.current) {
        if (Hls.isSupported()) {
          const hls = new Hls();
          hls.loadSource(video.hlsUrl);
          hls.attachMedia(videoRef.current);
        } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
          videoRef.current.src = video.hlsUrl;
        }
      }
    }, 100);
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h3" align="center" gutterBottom>Media Server HLS</Typography>
      <Box component="form" onSubmit={handleUpload} sx={{ mb: 4, p: 3, border: '1px dashed #1976d2', borderRadius: 2, textAlign: 'center' }}>
        <input type="file" accept="video/*" style={{ display: 'none' }} id="upload-input" onChange={handleFile} />
        <label htmlFor="upload-input">
          <Button variant="contained" component="span" startIcon={<CloudUploadIcon />} disabled={uploading}>
            Selecionar vídeo
          </Button>
        </label>
        {selectedFile && <Typography sx={{ mt: 2 }}>{selectedFile.name}</Typography>}
        <Box sx={{ mt: 2 }}>
          <Button type="submit" variant="contained" color="primary" disabled={!selectedFile || uploading}>
            Enviar e Converter
          </Button>
        </Box>
        {uploading && <LinearProgress variant="determinate" value={progress} sx={{ mt: 2 }} />}
      </Box>
      {current && (
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <Typography variant="h5" gutterBottom>{current.name}</Typography>
          <video ref={videoRef} controls style={{ width: '100%', maxWidth: 800, borderRadius: 8 }} poster="">
            Seu navegador não suporta vídeo HLS.
          </video>
        </Box>
      )}
      <Typography variant="h5" gutterBottom>Vídeos Convertidos</Typography>
      <Grid container spacing={2}>
        {videos.map(video => (
          <Grid item xs={12} sm={6} md={4} key={video.id}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" noWrap>{video.name}</Typography>
                <Typography variant="caption" color="text.secondary">{new Date(video.date).toLocaleString()}</Typography>
                <Button fullWidth variant="outlined" startIcon={<PlayArrowIcon />} sx={{ mt: 1 }} onClick={() => playVideo(video)}>
                  Reproduzir
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack(s => ({ ...s, open: false }))}>
        <Alert severity={snack.severity} sx={{ width: '100%' }}>{snack.msg}</Alert>
      </Snackbar>
    </Container>
  );
}

export default App;
