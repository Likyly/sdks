#!/bin/sh
# Builds likyly-chatgpt.zip (plugin package for platform.openai.com/plugins) from this folder, after
# validating plugin.json and mcp.json against the official Agent Plugins 1.0.0 schemas.
# Needs python3 with jsonschema (pip install jsonschema). The zip is not committed.
set -e
cd "$(dirname "$0")"
for f in plugin mcp; do
  curl -fsS "https://agent-plugins.org/schemas/1.0.0/$f.schema.json" -o "/tmp/likyly-$f.schema.json"
  python3 -c "import json, jsonschema; jsonschema.validate(json.load(open('$f.json')), json.load(open('/tmp/likyly-$f.schema.json'))); print('$f.json valid')"
done
rm -f likyly-chatgpt.zip
zip -qrX likyly-chatgpt.zip plugin.json mcp.json assets -x '*.DS_Store'
unzip -l likyly-chatgpt.zip
