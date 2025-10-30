@echo off
REM Test script for messaging patterns examples (Windows)
REM Run this after starting the application with: npm run start:dev

echo ================================================
echo   Messaging Patterns - Live Examples Test
echo ================================================
echo.

set BASE_URL=http://localhost:3000

echo Step 1: Setting up workers and subscribers...
echo.
curl -X POST "%BASE_URL%/examples/setup"
echo.
echo.
timeout /t 2 /nobreak >nul

echo Step 2: Testing RabbitMQ Job Queue...
echo Watch your console for worker logs!
echo.
curl -X POST "%BASE_URL%/examples/rabbitmq"
echo.
echo.
timeout /t 3 /nobreak >nul

echo Step 3: Testing Redis Pub/Sub...
echo Watch your console for subscriber logs!
echo.
curl -X POST "%BASE_URL%/examples/redis"
echo.
echo.
timeout /t 2 /nobreak >nul

echo Step 4: Testing Combined Flow (User Registration)...
echo Watch your console to see all three patterns working together!
echo.
curl -X POST "%BASE_URL%/examples/combined?email=test@example.com"
echo.
echo.

echo ================================================
echo   All tests completed!
echo   Check your console logs for detailed output
echo ================================================
pause
