#!/usr/bin/env sh
set -eu
printf 'Checking Java API...\n'
curl -fsS http://127.0.0.1:8080/api/v1/health
printf '\nChecking security engine...\n'
curl -fsS http://127.0.0.1:8001/health
printf '\nChecking synthetic demo analysis...\n'
curl -fsS http://127.0.0.1:8080/api/v1/demo/analysis
printf '\nSmoke checks complete.\n'
