#!/bin/bash
# Demo: LlamaFarm Chat API
# Shows sending a chat message through the LlamaFarm API

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

echo "=== LlamaFarm Chat Demo ==="
echo ""
echo "This demo sends a chat message through LlamaFarm and displays the response."
echo ""

cd "$REPO_ROOT"

# First check if LlamaFarm server is running
echo "1. Checking LlamaFarm server health..."
HEALTH=$(curl -s http://localhost:8000/health 2>/dev/null || echo '{"status":"unhealthy"}')
if echo "$HEALTH" | grep -q '"status":"healthy"'; then
    echo "   Server is healthy!"
else
    echo "   ERROR: LlamaFarm server is not running on port 8000"
    echo "   Please start the server first with: lf start"
    exit 1
fi
echo ""

# Bootstrap a demo project if needed
echo "2. Bootstrapping demo project..."
node --import tsx --eval "
import { bootstrapProject } from './extensions/llamafarm/src/bootstrap.js';

const config = {
  serverUrl: 'http://localhost:8000',
  namespace: 'demo',
  project: 'chat',
  modelName: 'qwen3-8b',
  autoBootstrap: true,
};

const result = await bootstrapProject(config);
console.log('   Project:', result.projectDir);
console.log('   Created:', result.created);
"
echo ""

# Load the project config
echo "3. Loading project into LlamaFarm..."
cd ~/.llamafarm/demo-chat 2>/dev/null || true
if [ -f llamafarm.yaml ]; then
    # Use lf start to register the project (requires lf CLI)
    if command -v lf &> /dev/null; then
        lf start 2>/dev/null || echo "   (lf start skipped - project may already be loaded)"
    fi
fi
cd "$REPO_ROOT"
echo ""

# Send a chat message using an existing project
echo "4. Sending chat message via LlamaFarm API..."
echo ""

# Use the test/demo project which should exist
NAMESPACE="test"
PROJECT="demo"

echo "   Using project: $NAMESPACE/$PROJECT"
echo ""

node --import tsx --eval "
import { LlamaFarmClient } from './extensions/llamafarm/src/client.js';

const client = new LlamaFarmClient({
  serverUrl: 'http://localhost:8000',
  namespace: 'test',
  project: 'demo',
});

async function main() {
  console.log('Sending message: \"What is 2+2?\"');
  console.log('');

  try {
    const response = await client.chat({
      messages: [
        { role: 'user', content: 'What is 2+2? Please answer in one word.' }
      ],
      max_tokens: 50,
    });

    console.log('Response:');
    console.log('---');
    console.log(response.choices[0]?.message?.content || '(no content)');
    console.log('---');
    console.log('');
    console.log('Model:', response.model);
    console.log('Tokens used:', response.usage?.total_tokens || 'unknown');
    console.log('');
    console.log('SUCCESS: Chat API working!');
  } catch (err) {
    console.error('Error:', err.message);
    console.log('');
    console.log('Note: This demo requires a LlamaFarm project at test/demo.');
    console.log('Try: cd ~/.llamafarm/projects/test/demo && lf start');
  }
}

main();
"

echo ""
echo "=== Demo Complete ==="
