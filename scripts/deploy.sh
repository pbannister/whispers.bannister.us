#!/usr/bin/env bash
set -e

echo "Building site..."
npm run build

echo "Deploying to DreamHost..."
rsync -avz --delete site.out/ preston@bannister.us:whispers.bannister.us/

echo "Deployment complete: https://whispers.bannister.us"
