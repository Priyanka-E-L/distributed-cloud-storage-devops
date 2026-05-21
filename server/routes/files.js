const express = require('express');
const multer = require('multer');
const File = require('../models/File');
const auth = require('../middleware/auth');
const axios = require('axios');
const FormData = require('form-data');

const router = express.Router();

// ============================================
// MULTER CONFIGURATION
// ============================================

const storage = multer.memoryStorage();

const upload = multer({
  storage: storage
});

// ============================================
// STORAGE NODES
// ============================================

const storageServers = [
  {
    id: 'server1',
    url: 'http://storage1:5001'
  },
  {
    id: 'server2',
    url: 'http://storage2:5002'
  },
  {
    id: 'server3',
    url: 'http://storage3:5003'
  }
];
// ============================================
// CHUNK SIZE = 1MB
// ============================================

const CHUNK_SIZE = 1024 * 1024;

const SERVER_STORAGE_LIMIT =
  20 * 1024 * 1024; // 20MB

function getServerStorageUsed(serverId) {

  const fs = require('fs');
  const path = require('path');

  // const serverPath =
  //   path.join(
  //     __dirname,
  //     `../../storage-${serverId}/chunks`
  //   );
  const serverMap = {
  server1: '../../storage-server-1/chunks',
  server2: '../../storage-server-2/chunks',
  server3: '../../storage-server-3/chunks'
};

const serverPath =
  path.join(
    __dirname,
    serverMap[serverId]
  );

  if (!fs.existsSync(serverPath)) {
    return 0;
  }

  const files =
    fs.readdirSync(serverPath);

  let totalSize = 0;

  files.forEach(file => {

    const stats =
      fs.statSync(
        path.join(serverPath, file)
      );

    totalSize += stats.size;
  });

  return totalSize;
}

// ============================================
// UPLOAD FILE
// ============================================

router.post(
  '/upload',
  auth,
  upload.single('file'),
  async (req, res) => {

    try {

      if (!req.file) {
        return res.status(400).json({
          message: 'No file uploaded'
        });
      }

      console.log('\n================================');
      console.log('FILE RECEIVED BY MAIN SERVER');
      console.log('================================');

      console.log({
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      });

      // ============================================
      // SPLIT FILE INTO CHUNKS
      // ============================================

      const chunks = [];

      for (
        let i = 0;
        i < req.file.buffer.length;
        i += CHUNK_SIZE
      ) {
        const chunk = req.file.buffer.slice(
          i,
          i + CHUNK_SIZE
        );
        chunks.push(chunk);
      }

      console.log(`\nTotal Chunks: ${chunks.length}`);

      // ============================================
      // DISTRIBUTED CHUNK STORAGE + REPLICATION
      // ============================================

      const uploadedChunks = [];

      for (let i = 0; i < chunks.length; i++) {

        console.log(`\nUploading Chunk ${i}`);

        // // Primary server
        // const primaryServer =
        //   storageServers[
        //     i % storageServers.length
        //   ];
         
        let primaryServer =
  storageServers[
    i % storageServers.length
  ];

let attempts = 0;

while (
  getServerStorageUsed(
    primaryServer.id
  ) + chunks[i].length >
  SERVER_STORAGE_LIMIT
) {

  console.log(
    `${primaryServer.id} FULL`
  );

  primaryServer =
    storageServers[
      (i + attempts + 1)
      % storageServers.length
    ];

  attempts++;

  if (
    attempts >=
    storageServers.length
  ) {

    return res.status(500).json({
      message:
        'All storage servers full'
    });
  }
}

        // Replica server
        const replicaServer =
          storageServers[
            (i + 1) % storageServers.length
          ];

        const replicas = [
          primaryServer,
          replicaServer
        ];

        const replicaLocations = [];

        for (const server of replicas) {

          console.log(
            `Sending Chunk ${i} to ${server.id}`
          );

          const formData = new FormData();
          const chunkFilename = `chunk-${i}-${Date.now()}-${req.file.originalname}`;

          formData.append(
            'file',
            chunks[i],
            chunkFilename
          );

          try {
            // Fix: Use the server base URL + /upload-chunk endpoint
            const uploadUrl = `${server.url}/upload-chunk`;
            
            const response = await axios.post(
              uploadUrl,
              formData,
              {
                headers: formData.getHeaders()
              }
            );

            console.log(
              `Chunk ${i} replicated to ${server.id}`
            );

            replicaLocations.push({
              serverId: server.id,
              serverUrl: server.url,
              filename: response.data.filename // Use the actual filename returned by storage server
            });

          } catch (err) {
            console.error(
              `Replication failed on ${server.id}`,
              err.message
            );
          }
        }

        uploadedChunks.push({
          chunkNumber: i,
          replicas: replicaLocations
        });
      }

      // ============================================
      // SAVE METADATA IN MONGODB
      // ============================================

      const newFile = new File({
        filename: req.file.originalname,
        originalName: req.file.originalname,
        size: req.file.size,
        fileType: req.file.mimetype,
        chunks: uploadedChunks,
        owner: req.user.id
      });

      const savedFile = await newFile.save();

      console.log('\n================================');
      console.log('FILE DISTRIBUTED SUCCESSFULLY');
      console.log('================================');

      res.json({
        success: true,
        message: 'File uploaded to distributed storage system',
        file: savedFile
      });

    } catch (err) {
      console.error('\nUPLOAD ERROR');
      console.error(err);
      res.status(500).json({
        success: false,
        message: 'Distributed upload failed'
      });
    }
  }
);

// ============================================
// DOWNLOAD + FILE RECONSTRUCTION
// ============================================

router.get(
  '/download/:id',
  auth,
  async (req, res) => {

    try {

      const file =
        await File.findById(req.params.id);

      if (!file) {
        return res.status(404).json({
          message: 'File not found'
        });
      }

      console.log('\n================================');
      console.log('STARTING FILE RECONSTRUCTION');
      console.log('================================');

      // Sort chunks by chunkNumber
      const sortedChunks =
        file.chunks.sort(
          (a, b) =>
            a.chunkNumber - b.chunkNumber
        );

      const chunkBuffers = [];

      // ============================================
      // DOWNLOAD CHUNKS
      // ============================================

      for (const chunk of sortedChunks) {
        let chunkDownloaded = false;

        // Try replicas one by one
        for (const replica of chunk.replicas) {
          try {
            // Fix: Construct proper URL for chunk download
            const chunkUrl = `${replica.serverUrl}/chunks/${replica.filename}`;
            
            console.log(
              `Downloading chunk ${chunk.chunkNumber} from ${chunkUrl}`
            );

            const response =
              await axios.get(
                chunkUrl,
                {
                  responseType: 'arraybuffer',
                  timeout: 10000 // Add timeout
                }
              );

            chunkBuffers.push(
              Buffer.from(response.data)
            );

            console.log(
              `Chunk ${chunk.chunkNumber} downloaded successfully from ${replica.serverId}`
            );

            chunkDownloaded = true;
            break;

          } catch (err) {
            console.log(
              `Replica failed for chunk ${chunk.chunkNumber} on ${replica.serverId}:`,
              err.message
            );
          }
        }

        if (!chunkDownloaded) {
          return res.status(500).json({
            message: `Failed to reconstruct chunk ${chunk.chunkNumber} - no available replicas`
          });
        }
      }

      console.log('\nMerging chunks...');

      // ============================================
      // MERGE CHUNKS
      // ============================================

      const reconstructedFile =
        Buffer.concat(chunkBuffers);

      console.log(
        'File reconstructed successfully, size:', reconstructedFile.length
      );

      // ============================================
      // SEND FILE
      // ============================================

      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${file.originalName}"`
      );

      res.setHeader(
        'Content-Type',
        file.fileType || 'application/octet-stream'
      );

      res.setHeader(
        'Content-Length',
        reconstructedFile.length
      );

      res.send(reconstructedFile);

    } catch (err) {
      console.error('Download error:', err);
      res.status(500).json({
        message: 'Download failed: ' + err.message
      });
    }
  }
);

// ============================================
// GET USER FILES
// ============================================

router.get(
  '/my-files',
  auth,
  async (req, res) => {
    try {
      const files =
        await File.find({
          owner: req.user.id
        }).sort({
          uploadDate: -1
        });
      res.json(files);
    } catch (err) {
      console.error(err);
      res.status(500).json({
        message: 'Server error'
      });
    }
  }
);

// ============================================
// DELETE FILE
// ============================================

router.delete(
  '/:id',
  auth,
  async (req, res) => {
    try {
      const file =
        await File.findOne({
          _id: req.params.id,
          owner: req.user.id
        });

      if (!file) {
        return res.status(404).json({
          message: 'File not found'
        });
      }

      // TODO: Delete chunks from storage servers
      // This would involve calling delete endpoints on storage servers

      await File.findByIdAndDelete(
        req.params.id
      );

      res.json({
        message: 'File deleted successfully'
      });

    } catch (err) {
      console.error(err);
      res.status(500).json({
        message: 'Server error'
      });
    }
  }
);

module.exports = router;
