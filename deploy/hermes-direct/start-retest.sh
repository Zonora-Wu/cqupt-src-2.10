#!/bin/bash
set -euo pipefail

proxy_url="http://cqupt:${EGRESS_PROXY_TOKEN}@retest-egress-proxy:8080"
export HTTP_PROXY="$proxy_url"
export HTTPS_PROXY="$proxy_url"
export ALL_PROXY="$proxy_url"
export http_proxy="$proxy_url"
export https_proxy="$proxy_url"
export all_proxy="$proxy_url"

exec hermes gateway run --replace
