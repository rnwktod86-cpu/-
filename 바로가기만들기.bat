@echo off
chcp 65001 >nul
set "TARGET=%~dp0수질검사관리.html"
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\수질검사관리.lnk'); $s.TargetPath='%TARGET%'; $s.WorkingDirectory='%~dp0'; $s.Save()"
echo 바탕화면에 [수질검사관리] 바로가기를 만들었습니다.
pause
