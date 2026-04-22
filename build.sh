#!/usr/bin/env bash
set -e

VITE_API_URL=https://api.supermover.neutheria.ch \
VITE_KINDE_DOMAIN=https://auth.neutheria.ch \
VITE_KINDE_CLIENT_ID=962ccbd9a8584af498b6d4f1eea75360 \
VITE_KINDE_REDIRECT_URI=https://supermover.neutheria.ch \
VITE_KINDE_LOGOUT_REDIRECT_URI=https://supermover.neutheria.ch \
VITE_KINDE_AUDIENCE=https://api.supermover.neutheria.ch \
npm run build
