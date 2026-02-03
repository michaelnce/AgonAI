#!/bin/bash

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '#' | awk '/=/ {print $1}')
fi

echo "Stopping Multi-Agent Debater..."

if [ ! -z "$BACKEND_PORT" ]; then
    echo "Killing process on port $BACKEND_PORT..."
    lsof -ti:$BACKEND_PORT | xargs kill -9 2>/dev/null || echo "No process found on port $BACKEND_PORT"
fi

if [ ! -z "$FRONTEND_PORT" ]; then
    echo "Killing process on port $FRONTEND_PORT..."
    lsof -ti:$FRONTEND_PORT | xargs kill -9 2>/dev/null || echo "No process found on port $FRONTEND_PORT"
fi

echo "Done."
