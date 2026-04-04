@echo off
REM Browserclaw Native Messaging Host — Windows Installer
REM Run this as Administrator after loading the extension to register the native host.
REM
REM Usage: install-windows.bat <chrome-extension-id>
REM   e.g.: install-windows.bat abcdefghijklmnopqrstuvwxyz123456

setlocal

if "%~1"=="" (
    echo Usage: install-windows.bat ^<chrome-extension-id^>
    echo.
    echo Find your extension ID at chrome://extensions with Developer mode on.
    exit /b 1
)

set EXT_ID=%~1
set HOST_NAME=com.guildos.browserclaw
set SCRIPT_DIR=%~dp0
set HOST_JS=%SCRIPT_DIR%host.js
set MANIFEST_SRC=%SCRIPT_DIR%%HOST_NAME%.json
set MANIFEST_DIR=%LOCALAPPDATA%\GuildOS\NativeMessagingHosts
set MANIFEST_DEST=%MANIFEST_DIR%\%HOST_NAME%.json

REM Find node.exe
for /f "delims=" %%i in ('where node 2^>nul') do set NODE_EXE=%%i
if "%NODE_EXE%"=="" (
    echo ERROR: node.exe not found in PATH.
    exit /b 1
)

echo.
echo === Browserclaw Native Host Installer ===
echo Extension ID: %EXT_ID%
echo Node.exe:     %NODE_EXE%
echo Host script:  %HOST_JS%
echo Manifest:     %MANIFEST_DEST%
echo.

REM Create manifest directory
if not exist "%MANIFEST_DIR%" mkdir "%MANIFEST_DIR%"

REM Write the manifest with correct path and allowed_origins
(
echo {
echo   "name": "%HOST_NAME%",
echo   "description": "GuildOS Browserclaw native messaging host",
echo   "path": "%NODE_EXE:\=\\%",
echo   "args": ["%HOST_JS:\=\\%"],
echo   "type": "stdio",
echo   "allowed_origins": ["chrome-extension://%EXT_ID%/"]
echo }
) > "%MANIFEST_DEST%"

REM Write registry key
reg add "HKCU\Software\Google\Chrome\NativeMessagingHosts\%HOST_NAME%" /ve /t REG_SZ /d "%MANIFEST_DEST%" /f

echo.
echo Done! Restart Chrome and reload the extension.
echo.
pause
