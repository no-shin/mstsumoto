@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8

echo Running sample analysis...
python xrd_identifier_prototype.py --cli ^
  --measurement "sample_data\007_Ba3Cu2Fe24O41_1050C.TXT" ^
  --references "reference_db" ^
  --output "output" ^
  --tolerance 0.25 ^
  --orientation none

echo.
echo Done. Check the output folder.
pause
