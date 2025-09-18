import { register } from 'ts-node';
import { pathToFileURL } from 'node:url';

// Register ts-node with ESM loader
register({
  project: './tsconfig.node.json', // Point to your tsconfig
  compilerOptions: {
    module: 'ESNext',  // TypeScript to output ESNext modules
  },
});

// Now import the main server file dynamically
import('./server/server.ts').catch((err) => {
  console.error('Failed to start server:', err);
});