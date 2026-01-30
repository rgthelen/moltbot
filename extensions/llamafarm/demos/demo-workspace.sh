#!/bin/bash
# Demo: LlamaFarm Workspace Bootstrap
# Shows full workspace creation with templates

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Use a test state directory
export MOLTBOT_STATE_DIR="/tmp/llamafarm-workspace-demo"

echo "=== LlamaFarm Workspace Demo ==="
echo ""
echo "This demo creates a full workspace at: $MOLTBOT_STATE_DIR"
echo ""

cd "$REPO_ROOT"

# Clean up previous demo
rm -rf "$MOLTBOT_STATE_DIR"

echo "1. Bootstrapping workspace..."
echo ""

node --import tsx --eval "
import {
  bootstrapWorkspace,
  getStateDir,
  getWorkspaceDir,
  getMemoryDir,
  readMoltbotConfig,
} from './extensions/llamafarm/src/workspace.js';
import { DEFAULT_CONFIG } from './extensions/llamafarm/src/types.js';

async function main() {
  console.log('State directory:', getStateDir());
  console.log('Workspace directory:', getWorkspaceDir());
  console.log('Memory directory:', getMemoryDir());
  console.log('');

  const result = await bootstrapWorkspace(DEFAULT_CONFIG);

  console.log('Bootstrap Result:');
  console.log('  Created:', result.created);
  console.log('  Templates copied:', result.templatesCopied.join(', '));
  console.log('  Config path:', result.configPath);
  console.log('');

  // Show config
  const config = readMoltbotConfig();
  console.log('moltbot.json config:');
  console.log(JSON.stringify(config, null, 2));
}

main().catch(console.error);
"

echo ""
echo "2. Listing workspace contents..."
echo ""

echo "State directory:"
ls -la "$MOLTBOT_STATE_DIR" 2>/dev/null || echo "(empty)"
echo ""

echo "Workspace directory (templates):"
ls -la "$MOLTBOT_STATE_DIR/workspace" 2>/dev/null || echo "(empty)"
echo ""

echo "Memory directory:"
ls -la "$MOLTBOT_STATE_DIR/memory" 2>/dev/null || echo "(empty)"
echo ""

echo "3. Sample template content (SOUL.md):"
echo "---"
head -20 "$MOLTBOT_STATE_DIR/workspace/SOUL.md" 2>/dev/null || echo "(not found)"
echo "---"

echo ""
echo "=== Demo Complete ==="
echo ""
echo "Workspace created at: $MOLTBOT_STATE_DIR"
echo "This is separate from ~/.clawdbot (which remains untouched)"
