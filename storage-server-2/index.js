const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 5002; // Change to 5002, 5003 for other servers

// === NEW: Create proper directory structure ===
const baseDir = __dirname;
const uploadsDir = path.join(baseDir, 'uploads');
const chunksDir = path.join(baseDir, 'chunks'); // NEW: Dedicated chunks folder

// Create directories if they don't exist
[uploadsDir, chunksDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

console.log(`=== STORAGE SERVER ${PORT} INITIALIZED ===`);
console.log(`Uploads directory: ${uploadsDir}`);
console.log(`Chunks directory: ${chunksDir}`);

// === UPDATED: Multer configuration for both regular files and chunks ===
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Determine where to store based on endpoint
    if (req.path === '/upload-chunk' || req.originalUrl.includes('chunk')) {
      console.log('Storing as chunk in:', chunksDir);
      cb(null, 'chunks/'); // Store chunks in dedicated folder
    } else {
      console.log('Storing as regular file in:', uploadsDir);
      cb(null, 'uploads/'); // Backward compatibility
    }
  },
  filename: (req, file, cb) => {
    // Generate appropriate filename
    if (req.path === '/upload-chunk' || req.originalUrl.includes('chunk')) {
      // For chunks: use descriptive naming
      const timestamp = Date.now();
      const random = Math.round(Math.random() * 1E9);
      const filename = `chunk-${timestamp}-${random}${path.extname(file.originalname)}`;
      console.log('Generated chunk filename:', filename);
      cb(null, filename);
    } else {
      // For regular files: keep original naming
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const filename = file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname);
      console.log('Generated regular filename:', filename);
      cb(null, filename);
    }
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit per chunk/file
  }
});

// === MIDDLEWARE ===
app.use(cors());
app.use('/uploads', express.static('uploads'));
app.use('/chunks', express.static('chunks')); // NEW: Serve chunks

// === NEW ENDPOINT: Upload Chunk ===
app.post('/upload-chunk', upload.single('file'), (req, res) => {
  console.log(`=== CHUNK UPLOAD TO SERVER ${PORT} ===`);
  console.log('Chunk details:', {
    originalname: req.file?.originalname,
    size: req.file?.size,
    filename: req.file?.filename,
    path: req.file?.path
  });
  
  if (!req.file) {
    console.log('No chunk received');
    return res.status(400).json({ 
      message: 'No chunk uploaded',
      server: `server${PORT - 5000}`
    });
  }

  console.log('Chunk uploaded successfully to:', req.file.path);
  
  res.json({
    message: 'Chunk uploaded successfully to storage server',
    filename: req.file.filename,
    size: req.file.size,
    path: req.file.path,
    server: `server${PORT - 5000}`,
    timestamp: new Date().toISOString()
  });
});

// === NEW ENDPOINT: Get Chunk ===
app.get('/chunks/:chunkname', (req, res) => {
  const chunkname = req.params.chunkname;
  console.log(`=== REQUESTING CHUNK: ${chunkname} ===`);
  
  const chunkPath = path.join(chunksDir, chunkname);
  console.log('Looking for chunk at:', chunkPath);
  
  // Check if chunk exists
  if (fs.existsSync(chunkPath)) {
    console.log('Chunk found, sending file...');
    res.sendFile(chunkPath, (err) => {
      if (err) {
        console.error('Error sending chunk:', err);
        res.status(500).json({ message: 'Error sending chunk' });
      }
    });
  } else {
    console.log('Chunk not found:', chunkPath);
    res.status(404).json({ 
      message: 'Chunk not found', 
      chunkname: chunkname,
      server: `server${PORT - 5000}`
    });
  }
});

// === NEW ENDPOINT: Delete Chunk ===
app.delete('/chunks/:chunkname', (req, res) => {
  const chunkname = req.params.chunkname;
  console.log(`=== DELETING CHUNK: ${chunkname} ===`);
  
  const chunkPath = path.join(chunksDir, chunkname);
  console.log('Deleting chunk at:', chunkPath);
  
  if (fs.existsSync(chunkPath)) {
    try {
      fs.unlinkSync(chunkPath);
      console.log('Chunk deleted successfully');
      res.json({ 
        message: 'Chunk deleted successfully',
        chunkname: chunkname,
        server: `server${PORT - 5000}`
      });
    } catch (error) {
      console.error('Error deleting chunk:', error);
      res.status(500).json({ 
        message: 'Error deleting chunk', 
        error: error.message 
      });
    }
  } else {
    console.log('Chunk not found for deletion:', chunkPath);
    res.status(404).json({ 
      message: 'Chunk not found for deletion',
      chunkname: chunkname,
      server: `server${PORT - 5000}`
    });
  }
});

// === KEEP EXISTING ENDPOINTS for backward compatibility ===

// Regular file upload (existing functionality)
app.post('/upload', upload.single('file'), (req, res) => {
  console.log(`=== REGULAR FILE UPLOAD TO SERVER ${PORT} ===`);
  
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  res.json({
    message: 'File uploaded successfully',
    filename: req.file.filename,
    path: req.file.path,
    size: req.file.size,
    server: `server${PORT - 5000}`
  });
});

// Regular file download (existing functionality)
app.get('/files/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(uploadsDir, filename);
  
  console.log('Requested file:', filename);
  console.log('File path:', filePath);

  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ message: 'File not found' });
  }
});

// Regular file delete (existing functionality)
app.delete('/files/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(uploadsDir, filename);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    res.json({ message: 'File deleted successfully' });
  } else {
    res.status(404).json({ message: 'File not found' });
  }
});

// === SERVER STARTUP ===
app.listen(PORT, () => {
  console.log(`Storage Server ${PORT} running and ready!`);
  console.log(`Directories:`);
  console.log(`  - Uploads: ${uploadsDir}`);
  console.log(`  - Chunks: ${chunksDir}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(`Storage Server ${PORT} shutting down gracefully...`);
  process.exit(0);
});
