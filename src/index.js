import { createRequire } from 'node:module';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { Command } from 'commander';
import { startServer } from './server.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

export function buildProgram() {
  const program = new Command();

  program
    .name('remockable')
    .description(pkg.description)
    .version(pkg.version)
    .argument('[folder]', 'mocks tree folder to serve', '.')
    .option('-p, --port <port>', 'port to listen on', '3333')
    .option('-H, --host <ip>', 'IP address / hostname to bind', '0.0.0.0')
    .action(async (folder, options) => {
      const root = path.resolve(folder);

      const stat = await fs.stat(root).catch(() => null);
      if (!stat || !stat.isDirectory()) {
        console.error(`remockable: '${folder}' is not a directory`);
        process.exitCode = 1;
        return;
      }

      const port = Number(options.port);
      if (!Number.isInteger(port) || port < 0 || port > 65535) {
        console.error(`remockable: invalid port '${options.port}'`);
        process.exitCode = 1;
        return;
      }

      const host = options.host;

      let server;
      try {
        server = await startServer({ root, port, host });
      } catch (err) {
        console.error(`remockable: failed to start server: ${err.message}`);
        process.exitCode = 1;
        return;
      }

      const shown = host === '0.0.0.0' ? 'localhost' : host;
      const bound = server.address();
      const boundPort = bound && typeof bound === 'object' ? bound.port : port;
      console.log(`remockable serving ${root}`);
      console.log(`  http://${shown}:${boundPort}`);

      listenForExit(server);
    });

  return program;
}

/**
 * Watch stdin for an exit keystroke (q or Esc) and shut the server down.
 * Falls back to SIGINT (Ctrl+C) handling when stdin is not an interactive TTY.
 * @param {import('node:http').Server} server
 */
function listenForExit(server) {
  const shutdown = () => {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
    }
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', shutdown);

  if (!process.stdin.isTTY) return;

  console.log('  press q or Esc to stop');
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (key) => {
    // q, Q, Esc, or Ctrl+C
    if (key === 'q' || key === 'Q' || key === '\u001b' || key === '\u0003') {
      shutdown();
    }
  });
}

export function run(argv) {
  return buildProgram().parseAsync(argv);
}
