#!/bin/bash
# Demo: LlamaFarm Extension Load
# Shows that the LlamaFarm extension loads in Moltbot and logs registration

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

echo "=== LlamaFarm Extension Load Demo ==="
echo ""
echo "This demo verifies that the LlamaFarm extension loads correctly."
echo ""

cd "$REPO_ROOT"

# Run a simple import test to verify the extension loads
echo "1. Testing extension import..."
node --import tsx --eval "
import register, { PLUGIN_ID, PLUGIN_NAME, PLUGIN_VERSION, DEFAULT_CONFIG } from './extensions/llamafarm/index.ts';

console.log('');
console.log('Extension loaded successfully!');
console.log('  Plugin ID:', PLUGIN_ID);
console.log('  Plugin Name:', PLUGIN_NAME);
console.log('  Plugin Version:', PLUGIN_VERSION);
console.log('');
console.log('Default Config:');
console.log('  Server URL:', DEFAULT_CONFIG.serverUrl);
console.log('  Namespace:', DEFAULT_CONFIG.namespace);
console.log('  Project:', DEFAULT_CONFIG.project);
console.log('  Model Name:', DEFAULT_CONFIG.modelName);
console.log('  Auto Bootstrap:', DEFAULT_CONFIG.autoBootstrap);
console.log('');
console.log('register function type:', typeof register);
"

echo ""
echo "=== Demo Complete ==="
echo ""
echo "Expected output:"
echo "  - Plugin ID: llamafarm"
echo "  - Server URL: http://localhost:8000"
echo "  - register function type: function"
