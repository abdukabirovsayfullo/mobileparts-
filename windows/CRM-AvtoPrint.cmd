@echo off
setlocal
set "CRM_CHROME_EXE="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CRM_CHROME_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined CRM_CHROME_EXE if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CRM_CHROME_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined CRM_CHROME_EXE if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "CRM_CHROME_EXE=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if not defined CRM_CHROME_EXE (
 echo Google Chrome topilmadi. Chrome o'rnating.
 pause
 exit /b 1
)
powershell -NoProfile -Command "$p=Get-CimInstance Win32_Printer | Where-Object Default; if (!$p -or $p.Name -notmatch 'XP[- _]?80') { Write-Host 'Windows asosiy printerini Xprinter XP-80 qilib tanlang.'; exit 1 }; Write-Host ('Printer: '+$p.Name)"
if errorlevel 1 (
 start "" ms-settings:printers
 pause
 exit /b 1
)
echo CRM avtomatik printer rejimida ochilmoqda.
echo XP-80 qog'oz sozlamasi 80 mm bo'lishi kerak.
start "" "%CRM_CHROME_EXE%" --user-data-dir="%LOCALAPPDATA%\BeelineCRM-AutoPrint" --kiosk-printing --no-first-run --no-default-browser-check --app="https://mobileparts-pos.onrender.com/"
endlocal
