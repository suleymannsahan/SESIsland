# Ada - window helper.
#   -Watch                       prints {"fullscreen":true|false} whenever the foreground window
#                                starts or stops covering its whole monitor (games, videos, slides).
#   -Focus -Names a,b -Title x   brings the first window of those processes (title containing x
#                                if given) to the front.
param(
  [switch]$Watch,
  [switch]$Focus,
  [string]$Names = '',
  [string]$Title = '',
  [int]$SelfPid = 0
)

$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class AdaWin {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [StructLayout(LayoutKind.Sequential)] public struct MONITORINFO { public int cbSize; public RECT rcMonitor; public RECT rcWork; public uint dwFlags; }
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern IntPtr MonitorFromWindow(IntPtr h, uint flags);
  [DllImport("user32.dll")] public static extern bool GetMonitorInfo(IntPtr m, ref MONITORINFO mi);
  [DllImport("user32.dll")] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  public static bool IsFullscreen(int selfPid) {
    IntPtr h = GetForegroundWindow();
    if (h == IntPtr.Zero) return false;
    var sb = new StringBuilder(64); GetClassName(h, sb, 64);
    string c = sb.ToString();
    if (c == "Progman" || c == "WorkerW" || c == "Shell_TrayWnd") return false;
    uint pid; GetWindowThreadProcessId(h, out pid);
    if (selfPid != 0 && pid == (uint)selfPid) return false;
    RECT r; if (!GetWindowRect(h, out r)) return false;
    var mi = new MONITORINFO(); mi.cbSize = Marshal.SizeOf(typeof(MONITORINFO));
    if (!GetMonitorInfo(MonitorFromWindow(h, 2), ref mi)) return false;
    return r.L <= mi.rcMonitor.L && r.T <= mi.rcMonitor.T && r.R >= mi.rcMonitor.R && r.B >= mi.rcMonitor.B;
  }
  public static void Bring(IntPtr h) {
    if (IsIconic(h)) ShowWindow(h, 9);
    keybd_event(0x12, 0, 0, UIntPtr.Zero);       // Alt down lets us take the foreground
    SetForegroundWindow(h);
    keybd_event(0x12, 0, 2, UIntPtr.Zero);       // Alt up
  }
}
'@

if ($Focus) {
  $list = @($Names -split ',' | Where-Object { $_ })
  foreach ($n in $list) {
    $procs = @(Get-Process -Name $n | Where-Object { $_.MainWindowHandle -ne 0 })
    if ($Title) { $match = @($procs | Where-Object { $_.MainWindowTitle -like "*$Title*" }) } else { $match = @() }
    $p = if ($match.Count) { $match[0] } elseif (-not $Title -or $n -eq 'claude') { $procs | Select-Object -First 1 } else { $null }
    if ($p) { [AdaWin]::Bring($p.MainWindowHandle); Write-Output "focused: $($p.ProcessName) $($p.MainWindowTitle)"; exit 0 }
  }
  Write-Output 'not-found'
  exit 2
}

if ($Watch) {
  $last = $null
  while ($true) {
    $fs = [AdaWin]::IsFullscreen($SelfPid)
    if ($fs -ne $last) {
      [Console]::Out.WriteLine((@{ fullscreen = $fs } | ConvertTo-Json -Compress))
      [Console]::Out.Flush()
      $last = $fs
    }
    Start-Sleep -Milliseconds 1000
  }
}
