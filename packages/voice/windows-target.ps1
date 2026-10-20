param([ValidateSet('capture','paste')][string]$Action='capture',[long]$Target=0)
$ErrorActionPreference='Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class SuperAiWindow {
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
}
'@
if($Action -eq 'capture') { [SuperAiWindow]::GetForegroundWindow().ToInt64(); exit }
$handle=[IntPtr]$Target
if(-not [SuperAiWindow]::IsWindow($handle)){throw 'หน้าต่างเป้าหมายปิดแล้ว ข้อความยังอยู่ในคลิปบอร์ด'}
[void][SuperAiWindow]::ShowWindow($handle, 9)
[void][SuperAiWindow]::SetForegroundWindow($handle)
Start-Sleep -Milliseconds 60
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait('^v')
Write-Output 'requested'
