@echo off
cd /d "D:\ZomboidServer\koru-mvp"
echo Levantando Koru en http://localhost:3000 ...
call npx vite --host 0.0.0.0 --port 3000 --strictPort
pause
