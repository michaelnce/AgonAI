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
export PYTHONPATH=$PYTHONPATH:.
nohup python3 -m uvicorn backend.main:app --host 0.0.0.0 --port $BACKEND_PORT --reload > backend.log 2>&1 &
BACKEND_PID=$!
disown $BACKEND_PID

# Start Frontend
echo "Starting Frontend on port $FRONTEND_PORT..."
if [ -d "frontend" ]; then
    cd frontend
    nohup npm run dev -- --host 0.0.0.0 --port $FRONTEND_PORT > ../frontend.log 2>&1 &
    FRONTEND_PID=$!
    disown $FRONTEND_PID
    cd ..
else
    echo "Frontend directory not found. Skipping frontend start."
fi

echo ""
echo "Backend:  http://localhost:$BACKEND_PORT  (PID: $BACKEND_PID, log: backend.log)"
if [ ! -z "$FRONTEND_PID" ]; then
    echo "Frontend: http://localhost:$FRONTEND_PORT  (PID: $FRONTEND_PID, log: frontend.log)"
fi

echo ""
echo "Services started in background."
echo "To stop them, run: ./stop.sh"
