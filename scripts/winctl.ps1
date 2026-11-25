# Ada - window helper.
#   -Watch                       prints {"fullscreen":true|false} whenever the foreground window
#                                starts or stops covering its whole monitor (games, videos, slides).
#   -Focus -Names a,b -Title x   brings the first window of those processes (title containing x
#                                if given) to the front.
#   -Focus ... -PasteB64 <b64>   then pastes that (UTF-8, base64) text into it and presses Enter;
#                                the clipboard is put back afterwards.
param(
  [switch]$Watch,
  [int]$AdaX = 0,
  [int]$AdaY = 0,
  [switch]$Focus,
  [string]$Names = '',
  [string]$Title = '',
  [string]$PasteB64 = '',
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
  [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h, int idx);
  [DllImport("user32.dll")] public static extern IntPtr MonitorFromPoint(POINT pt, uint flags);
  [DllImport("shell32.dll")] public static extern int SHQueryUserNotificationState(out int state);
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }

  // Windows' own idea of "busy": 2 = fullscreen app, 3 = Direct3D fullscreen game, 4 = presentation mode.
  public static int Quns() { int s; return SHQueryUserNotificationState(out s) == 0 ? s : 0; }

  // Fullscreen = the foreground window covers the whole monitor Ada is on, has no title bar and
  // is not just a maximized window; or Windows itself reports a fullscreen / game / presentation state.
  public static bool IsFullscreen(int selfPid, int adaX, int adaY) {
    IntPtr h = GetForegroundWindow();
    if (h == IntPtr.Zero) return false;
    var sb = new StringBuilder(64); GetClassName(h, sb, 64);
    string c = sb.ToString();
    if (c == "Progman" || c == "WorkerW" || c == "Shell_TrayWnd" || c == "Shell_SecondaryTrayWnd") return false;
    uint pid; GetWindowThreadProcessId(h, out pid);
    if (selfPid != 0 && pid == (uint)selfPid) return false;
    IntPtr mon = MonitorFromWindow(h, 2);
    var pt = new POINT(); pt.X = adaX; pt.Y = adaY;
    if (adaX != 0 || adaY != 0) { if (MonitorFromPoint(pt, 2) != mon) return false; }  // another monitor
    int q = Quns();
    if (q == 3 || q == 4) return true;
    if (IsZoomed(h)) return false;                       // maximized, not fullscreen
    const int WS_CAPTION = 0x00C00000;
    if ((GetWindowLong(h, -16) & WS_CAPTION) == WS_CAPTION) return false;  // has a title bar
    RECT r; if (!GetWindowRect(h, out r)) return false;
    var mi = new MONITORINFO(); mi.cbSize = Marshal.SizeOf(typeof(MONITORINFO));
    if (!GetMonitorInfo(mon, ref mi)) return false;
    bool covers = r.L <= mi.rcMonitor.L && r.T <= mi.rcMonitor.T && r.R >= mi.rcMonitor.R && r.B >= mi.rcMonitor.B;
    // transparent overlays (screen recorders, game overlays) cover the screen but are not apps
    const int WS_EX_TRANSPARENT = 0x20, WS_EX_LAYERED = 0x80000, WS_EX_NOACTIVATE = 0x8000000;
    int ex = GetWindowLong(h, -20);
    if ((ex & WS_EX_TRANSPARENT) != 0 || (ex & WS_EX_NOACTIVATE) != 0) return false;
    if ((ex & WS_EX_LAYERED) != 0 && q != 2) return false;
    return covers;
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
    if ($p) {
      [AdaWin]::Bring($p.MainWindowHandle)
      if ($PasteB64) {
        Add-Type -AssemblyName System.Windows.Forms
        $text = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($PasteB64))
        $old = $null
        try { if ([System.Windows.Forms.Clipboard]::ContainsText()) { $old = [System.Windows.Forms.Clipboard]::GetText() } } catch {}
        Start-Sleep -Milliseconds 350
        [System.Windows.Forms.Clipboard]::SetText($text)
        [System.Windows.Forms.SendKeys]::SendWait('^v')
        Start-Sleep -Milliseconds 250
        [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
        Start-Sleep -Milliseconds 400
        try { if ($null -ne $old) { [System.Windows.Forms.Clipboard]::SetText($old) } else { [System.Windows.Forms.Clipboard]::Clear() } } catch {}
        Write-Output "pasted: $($p.ProcessName)"
        exit 0
      }
      Write-Output "focused: $($p.ProcessName) $($p.MainWindowTitle)"; exit 0
    }
  }
  Write-Output 'not-found'
  exit 2
}

if ($Watch) {
  $last = $null
  while ($true) {
    $fs = [AdaWin]::IsFullscreen($SelfPid, $AdaX, $AdaY)
    if ($fs -ne $last) {
      [Console]::Out.WriteLine((@{ fullscreen = $fs } | ConvertTo-Json -Compress))
      [Console]::Out.Flush()
      $last = $fs
    }
    Start-Sleep -Milliseconds 1000
  }
}
