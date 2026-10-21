import { StudioServer } from './StudioServer.js';

export * from './types.js';
export * from './TerminalSessionManager.js';
export * from './WorkspaceRegistry.js';
export * from './StudioServer.js';

const PORT = parseInt(process.env.PORT || '3888', 10);

if (process.argv[1] && process.argv[1].match(/index\.(js|ts)$/)) {
  const server = new StudioServer({ port: PORT });
  server.start().then(() => {
    console.log(`\n======================================================`);
    console.log(`  🚀 SuperAi & RAKKYXD Studio Server Running`);
    console.log(`  📡 API & WebSocket Server: http://localhost:${PORT}`);
    console.log(`======================================================\n`);
  });

  const cleanup = async () => {
    console.log('\nShutting down Studio Server...');
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}
