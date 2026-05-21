class LoadBalancer {
  constructor(servers) {
    this.servers = servers;
    this.currentServerIndex = 0;
    console.log('LoadBalancer initialized with', servers.length, 'servers');
  }

  getNextServer() {
    const server = this.servers[this.currentServerIndex];
    console.log(`LoadBalancer: Selecting server ${this.currentServerIndex + 1}: ${server.id}`);
    
    // Round-robin: move to next server
    this.currentServerIndex = (this.currentServerIndex + 1) % this.servers.length;
    
    return server;
  }
}

const storageServers = [
  { id: 'server1', url: 'http://localhost:5001' },
  { id: 'server2', url: 'http://localhost:5002' },
  { id: 'server3', url: 'http://localhost:5003' }
];

const loadBalancer = new LoadBalancer(storageServers);

module.exports = loadBalancer;
