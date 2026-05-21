// server/utils/fileChunker.js
const fs = require('fs');
const path = require('path');

class FileChunker {
  static async chunkFile(buffer, chunkSize = 1024 * 1024) { // 1MB chunks
    const chunks = [];
    const totalChunks = Math.ceil(buffer.length / chunkSize);
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, buffer.length);
      const chunkBuffer = buffer.slice(start, end);
      
      chunks.push({
        chunkId: `chunk-${i}`,
        data: chunkBuffer,
        size: chunkBuffer.length,
        sequence: i
      });
    }
    
    return chunks;
  }
  
  static async reconstructFile(chunks) {
    // Sort chunks by sequence
    chunks.sort((a, b) => a.sequence - b.sequence);
    
    // Combine all chunk buffers
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.data.length, 0);
    const resultBuffer = Buffer.alloc(totalLength);
    
    let offset = 0;
    for (const chunk of chunks) {
      chunk.data.copy(resultBuffer, offset);
      offset += chunk.data.length;
    }
    
    return resultBuffer;
  }
}

module.exports = FileChunker;
