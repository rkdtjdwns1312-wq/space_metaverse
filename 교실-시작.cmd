@echo off
chcp 65001 >nul
cd /d "%~dp0"

set "CLASSROOM_NODE="

for /f "delims=" %%N in ('where node 2^>nul') do if not defined CLASSROOM_NODE set "CLASSROOM_NODE=%%N"
if defined CLASSROOM_NODE goto :found

if exist "%ProgramFiles%\nodejs\node.exe" (
  set "CLASSROOM_NODE=%ProgramFiles%\nodejs\node.exe"
  goto :found
)

if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
  set "CLASSROOM_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
  goto :found
)

for /d %%D in ("%LOCALAPPDATA%\OpenAI\Codex\runtimes\cua_node\*") do if not defined CLASSROOM_NODE if exist "%%D\bin\node.exe" set "CLASSROOM_NODE=%%D\bin\node.exe"
if defined CLASSROOM_NODE goto :found

echo Node.js가 설치되어 있지 않아요. https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행해주세요.
pause
exit /b 1

:found
for /f "delims=" %%V in ('"%CLASSROOM_NODE%" --version') do set "CLASSROOM_NODE_VERSION=%%V"
echo 사용하는 Node: %CLASSROOM_NODE% (%CLASSROOM_NODE_VERSION%)
echo 교실 서버를 확인합니다. 새로 켠 서버 창은 학생 이용 중 닫지 마세요.
"%CLASSROOM_NODE%" scripts\local.mjs --open
if errorlevel 1 (
  echo 시작하지 못했습니다. 위 오류를 확인하거나 도우미^(Claude 또는 Codex^)에게 이 창의 내용을 알려주세요.
  pause
)
