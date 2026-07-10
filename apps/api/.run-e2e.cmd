@echo off
set API_BASE_URL=http://localhost:8080
npx jest --config test/jest-e2e.json %*

