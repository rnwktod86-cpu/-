@echo off
chcp 65001 >nul
set "DEST=D:\수질관리"
if not exist "%DEST%" mkdir "%DEST%"
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%DEST%\수질검사관리.lnk'); $s.TargetPath='%~dp0수질검사관리.html'; $s.WorkingDirectory='%~dp0'; $s.Save()"
echo 바로가기를 만들었습니다: %DEST%\수질검사관리.lnk
pause
