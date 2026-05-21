const mongoose = require('mongoose');

const ReplicaSchema = new mongoose.Schema({
  serverId: {
    type: String,
    required: true
  },

  serverUrl: {
    type: String,
    required: true
  },

  filename: {
    type: String,
    required: true
  }
});

const ChunkSchema = new mongoose.Schema({
  chunkNumber: {
    type: Number,
    required: true
  },

  replicas: [ReplicaSchema]
});

const fileSchema = new mongoose.Schema({

  filename: {
    type: String,
    required: true
  },

  originalName: {
    type: String,
    required: true
  },

  size: {
    type: Number,
    required: true
  },

  fileType: {
    type: String,
    required: true
  },

  uploadDate: {
    type: Date,
    default: Date.now
  },

  chunks: [ChunkSchema],

  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }

});

module.exports =
  mongoose.model(
    'File',
    fileSchema
  );