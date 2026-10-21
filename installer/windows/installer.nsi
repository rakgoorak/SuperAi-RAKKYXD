; SuperAi & RAKKYXD - Windows installer (per-user, no admin prompt).
; Built by scripts/build-installer.mjs:
;   makensis /DVERSION=1.0.0 /DSRCDIR=<packaged app folder> /DOUTFILE=<setup.exe> /DICON=<icon.ico> installer.nsi
Unicode true
ManifestDPIAware true
RequestExecutionLevel user
SetCompressor /SOLID lzma

!define APPNAME "SuperAi & RAKKYXD"
!define APPID "SuperAi-RAKKYXD"
!define EXENAME "SuperAi-RAKKYXD.exe"
!define UNINSTKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPID}"
!define MARKER ".superai-install"
; Windows controls treat "&" as a shortcut marker, so labels need "&&" to show one "&".
!define APPLABEL "SuperAi && RAKKYXD"

Name "${APPNAME}"
OutFile "${OUTFILE}"
InstallDir "$LOCALAPPDATA\Programs\${APPID}"
InstallDirRegKey HKCU "Software\${APPID}" "InstallDir"
BrandingText "${APPLABEL} ${VERSION}"
VIProductVersion "${VERSION}.0"
VIAddVersionKey /LANG=0 "ProductName" "${APPNAME}"
VIAddVersionKey /LANG=0 "FileDescription" "${APPNAME} Setup"
VIAddVersionKey /LANG=0 "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=0 "ProductVersion" "${VERSION}"
VIAddVersionKey /LANG=0 "CompanyName" "RAKKYXD"
VIAddVersionKey /LANG=0 "LegalCopyright" "RAKKYXD"

!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"
!define MUI_ICON "${ICON}"
!define MUI_UNICON "${ICON}"
!define MUI_ABORTWARNING
!define MUI_WELCOMEFINISHPAGE_BITMAP "${ART}\sidebar.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "${ART}\sidebar.bmp"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_RIGHT
!define MUI_HEADERIMAGE_BITMAP "${ART}\header.bmp"
!define MUI_HEADERIMAGE_UNBITMAP "${ART}\header.bmp"

!insertmacro MUI_PAGE_WELCOME
!define MUI_PAGE_CUSTOMFUNCTION_LEAVE DirectoryLeave
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
; Finish page: "launch now" + "desktop shortcut" (the README slot carries the shortcut option).
!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXENAME}"
!define MUI_FINISHPAGE_RUN_TEXT "$(RunNow)"
!define MUI_FINISHPAGE_SHOWREADME ""
!define MUI_FINISHPAGE_SHOWREADME_TEXT "$(DesktopShortcut)"
!define MUI_FINISHPAGE_SHOWREADME_FUNCTION CreateDesktopShortcut
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "Thai"
!insertmacro MUI_LANGUAGE "English"

LangString RunNow ${LANG_THAI} "เปิด ${APPLABEL} เลย"
LangString RunNow ${LANG_ENGLISH} "Launch ${APPLABEL}"
LangString DesktopShortcut ${LANG_THAI} "สร้างทางลัดบนเดสก์ท็อป"
LangString DesktopShortcut ${LANG_ENGLISH} "Create a desktop shortcut"
LangString AppRunning ${LANG_THAI} "${APPNAME} กำลังเปิดอยู่ กรุณาปิดโปรแกรมก่อน แล้วกด Retry"
LangString AppRunning ${LANG_ENGLISH} "${APPNAME} is running. Close it, then press Retry."
LangString NotOurFolder ${LANG_THAI} "โฟลเดอร์นี้ไม่ได้ติดตั้งด้วยตัวติดตั้งของ ${APPNAME} จึงไม่ลบไฟล์ในโฟลเดอร์ ลบทางลัดและรายการโปรแกรมเท่านั้น"
LangString NotOurFolder ${LANG_ENGLISH} "This folder was not created by the ${APPNAME} installer, so its files are left in place. Only shortcuts and the program entry are removed."

; The app is Thai, so the installer is Thai on every Windows language.
Function .onInit
  StrCpy $LANGUAGE ${LANG_THAI}
FunctionEnd
Function un.onInit
  StrCpy $LANGUAGE ${LANG_THAI}
FunctionEnd

; Never install straight into a folder that already holds other things (e.g. Documents):
; put the app in its own subfolder so uninstalling can remove it safely.
Function DirectoryLeave
  IfFileExists "$INSTDIR\${EXENAME}" done
  IfFileExists "$INSTDIR\${MARKER}" done
  ${DirState} "$INSTDIR" $0
  ${If} $0 == 1
    StrCpy $INSTDIR "$INSTDIR\${APPID}"
  ${EndIf}
  done:
FunctionEnd

Function CreateDesktopShortcut
  CreateShortCut "$DESKTOP\${APPNAME}.lnk" "$INSTDIR\${EXENAME}" "" "$INSTDIR\${EXENAME}" 0
FunctionEnd

Section "Install"
  ; The app must be closed so its files can be replaced.
  retry:
  IfFileExists "$INSTDIR\${EXENAME}" 0 copy
  ClearErrors
  Rename "$INSTDIR\${EXENAME}" "$INSTDIR\${EXENAME}.check"
  IfErrors 0 +3
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(AppRunning)" IDRETRY retry
    Abort
  Rename "$INSTDIR\${EXENAME}.check" "$INSTDIR\${EXENAME}"
  copy:
  SetOutPath "$INSTDIR"
  ; resources\app belongs to SuperAi: replace it whole so stale files from older versions go away.
  RMDir /r "$INSTDIR\resources\app"
  File /r "${SRCDIR}\*.*"
  FileOpen $0 "$INSTDIR\${MARKER}" w
  FileWrite $0 "${APPID} ${VERSION}"
  FileClose $0
  WriteUninstaller "$INSTDIR\Uninstall ${APPID}.exe"
  CreateShortCut "$SMPROGRAMS\${APPNAME}.lnk" "$INSTDIR\${EXENAME}" "" "$INSTDIR\${EXENAME}" 0
  WriteRegStr HKCU "Software\${APPID}" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayName" "${APPNAME}"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINSTKEY}" "Publisher" "RAKKYXD"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayIcon" "$INSTDIR\${EXENAME}"
  WriteRegStr HKCU "${UNINSTKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTKEY}" "UninstallString" '"$INSTDIR\Uninstall ${APPID}.exe"'
  WriteRegStr HKCU "${UNINSTKEY}" "QuietUninstallString" '"$INSTDIR\Uninstall ${APPID}.exe" /S'
  WriteRegDWORD HKCU "${UNINSTKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTKEY}" "NoRepair" 1
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKCU "${UNINSTKEY}" "EstimatedSize" "$0"
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\${APPNAME}.lnk"
  Delete "$SMPROGRAMS\${APPNAME}.lnk"
  DeleteRegKey HKCU "${UNINSTKEY}"
  DeleteRegKey HKCU "Software\${APPID}"
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
