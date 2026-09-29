#!/bin/sh
set -eu
umask 077

if [ ! -f secrets/issuer-key.json ]; then
  node dist/scripts/generate-key.js
fi

OPERATOR_API_KEY_SHA256="$(node scripts/setup-local-operator-key.mjs)"
export OPERATOR_API_KEY_SHA256

exec node dist/src/server.js
