@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\예약접수.lnk'); $s.TargetPath='%~dp0실행.bat'; $s.WorkingDirectory='%~dp0'; $s.IconLocation='%~dp0public\icon.ico'; $s.Save()"
echo 바탕화면에 "예약접수" 아이콘을 만들었습니다.
pause
