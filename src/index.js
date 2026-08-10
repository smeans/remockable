import { createRequire } from 'node:module';
import { Command } from 'commander';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

export function buildProgram() {
  const program = new Command();

  program
    .name('remockable')
    .description(pkg.description)
    .version(pkg.version);

  program
    .command('hello')
    .description('Print a greeting')
    .argument('[name]', 'name to greet', 'world')
    .action((name) => {
      console.log(`Hello, ${name}!`);
    });

  return program;
}

export function run(argv) {
  return buildProgram().parse(argv);
}
