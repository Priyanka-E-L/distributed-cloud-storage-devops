// server/utils/replicationManager.js
class ReplicationManager {
  constructor(storageServers) {
    this.servers = storageServers;
  }
  
  // Select 3 servers for replication using consistent hashing
  selectReplicationServers(chunkId, replicaCount = 3) {
    const servers = [];
    const startIndex = this.hashToServerIndex(chunkId);
    
    for (let i = 0; i < replicaCount; i++) {
      const serverIndex = (startIndex + i) % this.servers.length;
      servers.push(this.servers[serverIndex]);
    }
    
    return servers;
  }
  
  hashToServerIndex(chunkId) {
    // Simple hash function for demonstration
    let hash = 0;
    for (let i = 0; i < chunkId.length; i++) {
      hash = ((hash << 5) - hash) + chunkId.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % this.servers.length;
  }
}

module.exports = ReplicationManager;
