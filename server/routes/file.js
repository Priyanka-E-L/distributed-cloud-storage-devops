const express = require('express');
const multer = require('multer');
const File = require('../models/File');
const auth = require('../middleware/auth');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Storage servers configuration
const storageServers = [
  { id: 'server1', url: 'http://localhost:5001' },
  { id: 'server2', url: 'http://localhost:5002' },
  { id: 'server3', url: 'http://localhost:5003' }
];

// Simple round-robin load balancing
let currentServerIndex = 0;

function getNextServer() {
  const server = storageServers[currentServerIndex];
  currentServerIndex = (currentServerIndex + 1) % storageServers.length;
  return server;
}

// Upload file
router.post('/upload', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Select server using round-robin
    const server = getNextServer();

    // Upload to storage server
    try {
      const formData = new FormData();
      formData.append('file', req.file.buffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype
      });

      const response = await axios.post(`${server.url}/upload`, formData, {
        headers: {
          ...formData.getHeaders()
        }
      });

      // Save file metadata
      const newFile = new File({
        filename: response.data.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        fileType: req.file.mimetype,
        serverLocations: [{
          serverId: server.id,
          url: `${server.url}/files/${response.data.filename}`
        }],
        owner: req.user.id
      });

      const savedFile = await newFile.save();

      res.json({
        message: 'File uploaded successfully',
        file: savedFile
      });
    } catch (storageError) {
      console.error('Storage server error:', storageError.message);
      // Fallback: save file metadata anyway
      const newFile = new File({
        filename: req.file.originalname,
        originalName: req.file.originalname,
        size: req.file.size,
        fileType: req.file.mimetype,
        serverLocations: [{
          serverId: 'temp',
          url: 'temp-url'
        }],
        owner: req.user.id
      });

      const savedFile = await newFile.save();
      res.json({
        message: 'File uploaded successfully (metadata only)',
        file: savedFile
      });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user files
router.get('/my-files', auth, async (req, res) => {
  try {
    const files = await File.find({ owner: req.user.id }).sort({ uploadDate: -1 });
    res.json(files);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Delete file
router.delete('/:id', auth, async (req, res) => {
  try {
    const file = await File.findOne({ _id: req.params.id, owner: req.user.id });
    
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Delete from storage servers
    for (const location of file.serverLocations) {
      if (location.url && location.url !== 'temp-url') {
        try {
          await axios.delete(location.url);
        } catch (err) {
          console.error(`Failed to delete from server ${location.serverId}:`, err.message);
        }
      }
    }

    // Delete from database
    await File.findByIdAndDelete(req.params.id);

    res.json({ message: 'File deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
