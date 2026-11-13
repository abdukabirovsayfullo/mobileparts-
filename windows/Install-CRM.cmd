@echo off
"%~dp0node.exe" "%~dp0offline-device.mjs" install
if errorlevel 1 pause
