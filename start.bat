@echo off
echo ============================================
echo   FT-02 FraudShield AI - Startup Script
echo   Hack2Ignite Hackathon
echo ============================================
echo.

:: Check if model exists
if not exist "model\artifacts\model.joblib" (
    echo [!] Model not found. Training first...
    echo [!] This will take 2-3 minutes.
    cd model
    pip install -r requirements.txt
    python train.py
    cd ..
    echo.
)

:: Start backend
echo [1/2] Starting FastAPI backend on port 8000...
start "FraudShield-Backend" cmd /c "cd backend && pip install -r requirements.txt && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

:: Wait for backend to start
timeout /t 5 /nobreak > nul

:: Start frontend
echo [2/2] Starting React frontend on port 5173...
start "FraudShield-Frontend" cmd /c "cd frontend && npm run dev"

echo.
echo ============================================
echo   Backend:  http://localhost:8000
echo   Frontend: http://localhost:5173
echo   API Docs: http://localhost:8000/docs
echo ============================================
echo.
echo Press any key to stop all services...
pause > nul

:: Cleanup
taskkill /FI "WINDOWTITLE eq FraudShield-Backend" /F 2>nul
taskkill /FI "WINDOWTITLE eq FraudShield-Frontend" /F 2>nul
