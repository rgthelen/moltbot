#!/bin/bash
# Demo: LlamaFarm Bootstrap Service
# Shows project creation and LlamaFarm server health check

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Use a test directory to avoid affecting user's actual config
TEST_PROJECT_DIR="/tmp/llamafarm-demo-bootstrap"

echo "=== LlamaFarm Bootstrap Demo ==="
echo ""
echo "This demo creates a fresh LlamaFarm project and checks server health."
echo ""

cd "$REPO_ROOT"

# Clean up any previous demo run
rm -rf "$TEST_PROJECT_DIR"

echo "1. Running bootstrap..."
echo ""

node --import tsx --eval "
import { bootstrapProject, readProjectConfig, getProjectDir } from './extensions/llamafarm/src/bootstrap.js';
import { DEFAULT_CONFIG } from './extensions/llamafarm/src/types.js';

// Use a test namespace/project
const testConfig = {
  ...DEFAULT_CONFIG,
  namespace: 'demo',
  project: 'bootstrap',
};

async function main() {
  console.log('Creating LlamaFarm project...');
  console.log('  Project dir:', getProjectDir(testConfig));
  console.log('');

  const result = await bootstrapProject(testConfig);

  console.log('Bootstrap Result:');
  console.log('  Created:', result.created);
  console.log('  Project Dir:', result.projectDir);
  console.log('  Config Path:', result.configPath);
  console.log('  Server Healthy:', result.serverHealthy);
  console.log('');

  // Show generated config
  const config = readProjectConfig(testConfig);
  if (config) {
    console.log('Generated llamafarm.yaml:');
    console.log('---');
    console.log(config);
    console.log('---');
  }

  // Try to bootstrap again to show idempotency
  console.log('');
  console.log('Running bootstrap again (should not recreate)...');
  const result2 = await bootstrapProject(testConfig);
  console.log('  Created:', result2.created, '(should be false)');
}

main().catch(console.error);
"

echo ""
echo "=== Demo Complete ==="
echo ""
echo "Expected output:"
echo "  - Created: true (first run)"
echo "  - Created: false (second run - idempotent)"
echo "  - llamafarm.yaml contains namespace, project, model config"
