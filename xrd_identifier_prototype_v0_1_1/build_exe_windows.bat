@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8

echo ==============================================
echo XRD Identifier Prototype v0.1.1 - EXE builder
echo ==============================================
echo.

echo [1/4] Checking Python...
python --version || (
  echo Python was not found.
  echo Install Python 3.11-3.13 and enable "Add python.exe to PATH".
  pause
  exit /b 1
)

echo.
echo [2/4] Installing/updating required packages...
python -m pip install --upgrade pip
python -m pip install numpy scipy matplotlib pyinstaller
if errorlevel 1 (
  echo pip install failed. Check your network connection and Python environment.
  pause
  exit /b 1
)

echo.
echo [3/4] Building EXE...
pyinstaller --noconfirm --clean --onefile --windowed ^
  --name XRDIdentifierPrototype ^
  --add-data "sample_data;sample_data" ^
  --add-data "reference_db;reference_db" ^
  xrd_identifier_prototype.py
if errorlevel 1 (
  echo PyInstaller build failed.
  pause
  exit /b 1
)

echo.
echo [4/4] Done.
echo EXE: %cd%\dist\XRDIdentifierPrototype.exe
echo.
pause
