import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildProgram } from '../src/index.js';

test('buildProgram configures the CLI name and version', () => {
  const program = buildProgram();
  assert.equal(program.name(), 'remockable');
  assert.match(program.version(), /^\d+\.\d+\.\d+$/);
});

test('hello command greets the given name', () => {
  const program = buildProgram();
  program.exitOverride();
  program.configureOutput({ writeOut: () => {} });

  const logs = [];
  const original = console.log;
  console.log = (msg) => logs.push(msg);
  try {
    program.parse(['node', 'remockable', 'hello', 'Ada']);
  } finally {
    console.log = original;
  }

  assert.deepEqual(logs, ['Hello, Ada!']);
});

test('hello command defaults to world', () => {
  const program = buildProgram();

  const logs = [];
  const original = console.log;
  console.log = (msg) => logs.push(msg);
  try {
    program.parse(['node', 'remockable', 'hello']);
  } finally {
    console.log = original;
  }

  assert.deepEqual(logs, ['Hello, world!']);
});
