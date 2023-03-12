#!/bin/sh

redis-server &

flyctl auth login --access-token "<your-token>" &

# Run tail to keep the container running
tail -f /dev/null