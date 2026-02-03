#!/bin/bash

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '#' | awk '/=/ {print $1}')
fi

# Activate virtual environment
source .venv/bin/activate

echo "Starting Multi-Agent Debater..."

# Start Backend
echo "Starting Backend on port $BACKEND_PORT..."
# Note: We assume the backend module is 'backend.main' or similar. 
# Adjusting PYTHONPATH to include current directory
export PYTHONPATH=$PYTHONPATH:.
python3 -m uvicorn backend.main:app --port $BACKEND_PORT --reload &
BACKEND_PID=$!

# Start Frontend
echo "Starting Frontend on port $FRONTEND_PORT..."
if [ -d "frontend" ]; then
    cd frontend
    npm run dev -- --port $FRONTEND_PORT &
    FRONTEND_PID=$!
    cd ..
else
    echo "Frontend directory not found. Skipping frontend start."
fi

echo "Backend PID: $BACKEND_PID"
if [ ! -z "$FRONTEND_PID" ]; then
    echo "Frontend PID: $FRONTEND_PID"
fi

# Wait for processes
wait
