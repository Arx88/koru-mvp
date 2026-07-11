@echo off
cd /d "D:\ZomboidServer\koru-mvp"
echo Levantando Koru en http://localhost:5173 (o siguiente libre) ...
call npx vite --host 0.0.0.0
pause
