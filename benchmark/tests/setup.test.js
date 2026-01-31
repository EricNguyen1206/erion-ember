const { describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

describe('Benchmark Setup', () => {
  test('package.json exists', () => {
    const pkgPath = path.join(__dirname, '..', 'package.json');
    assert.strictEqual(fs.existsSync(pkgPath), true);
  });

  test('package.json has correct name', () => {
    const pkg = require('../package.json');
    assert.strictEqual(pkg.name, 'semantic-cache-benchmark');
  });
});
