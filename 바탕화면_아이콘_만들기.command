#!/bin/sh
cd "$(dirname "$0")"
D="$PWD"
DESK="$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")"
if [ "$(uname)" = "Darwin" ]; then
  ln -sf "$D/실행.command" "$DESK/예약접수.command"
else
  F="$DESK/예약접수.desktop"
  printf '[Desktop Entry]\nType=Application\nName=예약접수\nExec=sh "%s/실행.command"\nIcon=%s/public/icon.ico\nTerminal=true\n' "$D" "$D" > "$F"
  chmod +x "$F"
fi
echo "바탕화면에 '예약접수' 아이콘을 만들었습니다."
