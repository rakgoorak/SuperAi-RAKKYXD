; SuperAi & RAKKYXD - Setup.exe (per-user, no admin prompt).
; Unpacks the app to a temp folder, then hands over to the branded installer UI
; (packages/desktop/installer, started with --superai-installer), which copies the app to the
; chosen folder, creates shortcuts and registers it. This file also builds the uninstaller.
; Built by scripts/build-installer.mjs:
;   makensis /DVERSION=1.0.0 /DSRCDIR=<packaged app> /DOUTFILE=<setup.exe> /DICON=<icon.ico> installer.nsi
Unicode true
ManifestDPIAware true
RequestExecutionLevel user
SetCompressor /SOLID lzma

!define APPNAME "SuperAi & RAKKYXD"
!define APPID "SuperAi-RAKKYXD"
!define EXENAME "SuperAi-RAKKYXD.exe"
!define UNINSTKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPID}"
!define MARKER ".superai-install"

Name "${APPNAME}"
Caption "${APPNAME}"
UninstallCaption "${APPNAME}"
OutFile "${OUTFILE}"
Icon "${ICON}"
UninstallIcon "${ICON}"
; A small progress window only: the real installer UI is the branded one.
ChangeUI all "${NSISDIR}\Contrib\UIs\sdbarker_tiny.exe"
ShowInstDetails nevershow
ShowUninstDetails nevershow
AutoCloseWindow true
BrandingText " "
VIProductVersion "${VERSION}.0"
VIAddVersionKey /LANG=0 "ProductName" "${APPNAME}"
VIAddVersionKey /LANG=0 "FileDescription" "${APPNAME} Setup"
VIAddVersionKey /LANG=0 "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=0 "ProductVersion" "${VERSION}"
VIAddVersionKey /LANG=0 "CompanyName" "RAKKYXD"
VIAddVersionKey /LANG=0 "LegalCopyright" "RAKKYXD"

; Setup and the uninstaller speak the computer's language when it is one of these; English
; (loaded first) is the fallback.
LoadLanguageFile "${NSISDIR}\Contrib\Language files\English.nlf"
LoadLanguageFile "${NSISDIR}\Contrib\Language files\Thai.nlf"
LoadLanguageFile "${NSISDIR}\Contrib\Language files\Japanese.nlf"
LoadLanguageFile "${NSISDIR}\Contrib\Language files\SimpChinese.nlf"
LangString Preparing ${LANG_ENGLISH} "Preparing the ${APPNAME} installer..."
LangString Removing ${LANG_ENGLISH} "Uninstalling ${APPNAME}..."
LangString ConfirmRemove ${LANG_ENGLISH} "Remove ${APPNAME} from this computer?$\r$\n$\r$\nYour projects, history and settings are kept."
LangString AppRunning ${LANG_ENGLISH} "${APPNAME} is open. Please close it, then press Retry."
LangString NotOurFolder ${LANG_ENGLISH} "This folder was not installed by the ${APPNAME} installer, so its files are not deleted. Only the shortcuts and the program entry are removed."
LangString LaunchFailed ${LANG_ENGLISH} "Could not start the installer. Please download Setup again."
LangString Preparing ${LANG_THAI} "กำลังเตรียมตัวติดตั้ง ${APPNAME}..."
LangString Removing ${LANG_THAI} "กำลังถอนการติดตั้ง ${APPNAME}..."
LangString ConfirmRemove ${LANG_THAI} "ถอนการติดตั้ง ${APPNAME} ออกจากเครื่อง?$\r$\n$\r$\nโปรเจกต์ ประวัติ และการตั้งค่าของคุณจะยังอยู่"
LangString AppRunning ${LANG_THAI} "${APPNAME} กำลังเปิดอยู่ กรุณาปิดโปรแกรมก่อน แล้วกด Retry"
LangString NotOurFolder ${LANG_THAI} "โฟลเดอร์นี้ไม่ได้ติดตั้งด้วยตัวติดตั้งของ ${APPNAME} จึงไม่ลบไฟล์ในโฟลเดอร์ ลบทางลัดและรายการโปรแกรมเท่านั้น"
LangString LaunchFailed ${LANG_THAI} "เปิดตัวติดตั้งไม่สำเร็จ กรุณาดาวน์โหลด Setup ใหม่อีกครั้ง"
LangString Preparing ${LANG_JAPANESE} "${APPNAME} のインストーラーを準備しています..."
LangString Removing ${LANG_JAPANESE} "${APPNAME} をアンインストールしています..."
LangString ConfirmRemove ${LANG_JAPANESE} "${APPNAME} をこのコンピューターから削除しますか？$\r$\n$\r$\nプロジェクト、履歴、設定は残ります。"
LangString AppRunning ${LANG_JAPANESE} "${APPNAME} が起動しています。終了してから「再試行」を押してください。"
LangString NotOurFolder ${LANG_JAPANESE} "このフォルダーは ${APPNAME} のインストーラーでインストールされていないため、ファイルは削除しません。ショートカットとプログラムの登録のみ削除します。"
LangString LaunchFailed ${LANG_JAPANESE} "インストーラーを起動できませんでした。Setup をもう一度ダウンロードしてください。"
LangString Preparing ${LANG_SIMPCHINESE} "正在准备 ${APPNAME} 安装程序..."
LangString Removing ${LANG_SIMPCHINESE} "正在卸载 ${APPNAME}..."
LangString ConfirmRemove ${LANG_SIMPCHINESE} "要从本机卸载 ${APPNAME} 吗？$\r$\n$\r$\n你的项目、历史和设置会保留。"
LangString AppRunning ${LANG_SIMPCHINESE} "${APPNAME} 正在运行，请先关闭程序，再点击“重试”。"
LangString NotOurFolder ${LANG_SIMPCHINESE} "此文件夹并非由 ${APPNAME} 安装程序安装，因此不会删除其中的文件，只删除快捷方式和程序条目。"
LangString LaunchFailed ${LANG_SIMPCHINESE} "无法启动安装程序，请重新下载 Setup。"

Page instfiles
UninstPage instfiles

Var STAGE

Section "Unpack"
  SetDetailsPrint textonly
  DetailPrint "$(Preparing)"
  SetDetailsPrint none
  ; A fresh folder per run, so two downloads never clash.
  System::Call 'kernel32::GetTickCount() i .r0'
  StrCpy $STAGE "$TEMP\${APPID}-setup-$0"
  RMDir /r "$STAGE"
  SetOutPath "$STAGE"
  File /r "${SRCDIR}\*.*"
  WriteUninstaller "$STAGE\Uninstall ${APPID}.exe"
  HideWindow
  ; Setup.exe /S installs unattended (default folder, desktop shortcut).
  StrCpy $1 ""
  IfSilent 0 +2
    StrCpy $1 "--silent"
  ClearErrors
  ExecWait '"$STAGE\${EXENAME}" --superai-installer "--payload=$STAGE" $1' $0
  IfErrors 0 +2
    MessageBox MB_ICONSTOP "$(LaunchFailed)" /SD IDOK
  SetErrorLevel $0
  SetOutPath "$TEMP"
  RMDir /r "$STAGE"
SectionEnd

Function un.onInit
  MessageBox MB_YESNO|MB_ICONQUESTION "$(ConfirmRemove)" /SD IDYES IDYES +2
  Abort
FunctionEnd

Section "Uninstall"
  SetDetailsPrint textonly
  DetailPrint "$(Removing)"
  SetDetailsPrint none
  retry:
  IfFileExists "$INSTDIR\${EXENAME}" 0 remove
  ClearErrors
  Rename "$INSTDIR\${EXENAME}" "$INSTDIR\${EXENAME}.check"
  IfErrors 0 +3
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(AppRunning)" /SD IDCANCEL IDRETRY retry
    Abort
  Rename "$INSTDIR\${EXENAME}.check" "$INSTDIR\${EXENAME}"
  remove:
  Delete "$DESKTOP\${APPNAME}.lnk"
  Delete "$SMPROGRAMS\${APPNAME}.lnk"
  DeleteRegKey HKCU "${UNINSTKEY}"
  ; Only remove the folder the installer created (it carries the marker file).
  IfFileExists "$INSTDIR\${MARKER}" 0 notours
    SetOutPath "$TEMP" ; a process cannot delete its own working directory
    RMDir /r "$INSTDIR"
    Goto end
  notours:
    MessageBox MB_ICONINFORMATION "$(NotOurFolder)" /SD IDOK
  end:
  ; Projects, history and settings live in %USERPROFILE%\.opencode-multi and are kept.
SectionEnd
