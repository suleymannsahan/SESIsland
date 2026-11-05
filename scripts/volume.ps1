# Ada - Windows master volume bridge (Core Audio, IAudioEndpointVolume on the default output device).
# Reads commands from stdin:  get | set <0-100> | mute <0|1> | togglemute
# Prints {"vol":<0-100>,"muted":true|false,"dev":"<output device name>"} whenever something changes
# (also when it was changed elsewhere, or another output device became the default).
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
  int f(); int g(); int h(); int i();
  int SetMasterVolumeLevelScalar(float fLevel, Guid pguidEventContext);
  int j();
  int GetMasterVolumeLevelScalar(out float pfLevel);
  int k(); int l(); int m(); int n();
  int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, Guid pguidEventContext);
  int GetMute(out bool pbMute);
}
[StructLayout(LayoutKind.Sequential)] public struct PROPERTYKEY { public Guid fmtid; public int pid; }
// PROPVARIANT is 24 bytes on x64 (16 on x86); the padding keeps the callee from writing past it.
[StructLayout(LayoutKind.Explicit, Size = 24)] public struct PROPVARIANT { [FieldOffset(0)] public short vt; [FieldOffset(8)] public IntPtr p; }
[Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IPropertyStore { int GetCount(out int c); int GetAt(int i, out PROPERTYKEY k); int GetValue(ref PROPERTYKEY k, out PROPVARIANT v); }
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice {
  int Activate(ref Guid id, int clsCtx, int activationParams, out IAudioEndpointVolume aev);
  int OpenPropertyStore(int access, out IPropertyStore props);
}
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator { int f(); int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint); }
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorComObject { }

public static class AdaAudio {
  [DllImport("ole32.dll")] static extern int PropVariantClear(ref PROPVARIANT pv);
  static IMMDevice Dev() {
    var en = new MMDeviceEnumeratorComObject() as IMMDeviceEnumerator;
    IMMDevice dev = null;
    Marshal.ThrowExceptionForHR(en.GetDefaultAudioEndpoint(0, 1, out dev));   // eRender, eMultimedia
    return dev;
  }
  public static string Name() {
    try {
      IPropertyStore ps = null;
      if (Dev().OpenPropertyStore(0, out ps) != 0 || ps == null) return "";
      var key = new PROPERTYKEY { fmtid = new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"), pid = 14 };  // PKEY_Device_FriendlyName
      PROPVARIANT v;
      if (ps.GetValue(ref key, out v) != 0) return "";
      string s = v.vt == 31 ? Marshal.PtrToStringUni(v.p) : "";                                          // VT_LPWSTR
      PropVariantClear(ref v);
      return s ?? "";
    } catch { return ""; }
  }
  static IAudioEndpointVolume Vol() {
    var dev = Dev();
    IAudioEndpointVolume v = null;
    var id = typeof(IAudioEndpointVolume).GUID;
    Marshal.ThrowExceptionForHR(dev.Activate(ref id, 23, 0, out v));           // CLSCTX_ALL
    return v;
  }
  public static int Get() { float f; Marshal.ThrowExceptionForHR(Vol().GetMasterVolumeLevelScalar(out f)); return (int)Math.Round(f * 100); }
  public static void Set(int p) { p = Math.Max(0, Math.Min(100, p)); Marshal.ThrowExceptionForHR(Vol().SetMasterVolumeLevelScalar(p / 100f, Guid.Empty)); }
  public static bool Muted() { bool m; Marshal.ThrowExceptionForHR(Vol().GetMute(out m)); return m; }
  public static void Mute(bool m) { Marshal.ThrowExceptionForHR(Vol().SetMute(m, Guid.Empty)); }
}
'@

function State {
  try { return @{ vol = [AdaAudio]::Get(); muted = [AdaAudio]::Muted(); dev = [AdaAudio]::Name() } } catch { return @{ vol = -1; muted = $false; error = $_.Exception.Message } }
}

# stdin is read on a background runspace: Console.In blocks, and we also poll for outside changes.
$queue = New-Object 'System.Collections.Concurrent.ConcurrentQueue[string]'
$reader = [PowerShell]::Create()
$null = $reader.AddScript({
  param($q)
  $in = [Console]::In
  while ($true) {
    $line = $in.ReadLine()
    if ($null -eq $line) { $q.Enqueue('__eof__'); break }
    $q.Enqueue($line)
  }
}).AddArgument($queue)
$handle = $reader.BeginInvoke()

$last = ''
$lastPoll = Get-Date '2000-01-01'
$cmd = $null
while ($true) {
  while ($queue.TryDequeue([ref]$cmd)) {
    if ($cmd -eq '__eof__') { exit 0 }
    $parts = $cmd.Trim() -split '\s+'
    try {
      switch ($parts[0]) {
        'set' { [AdaAudio]::Set([int]$parts[1]); if ([AdaAudio]::Muted() -and [int]$parts[1] -gt 0) { [AdaAudio]::Mute($false) } }
        'mute' { [AdaAudio]::Mute($parts[1] -eq '1') }
        'togglemute' { [AdaAudio]::Mute(-not [AdaAudio]::Muted()) }
        default { }
      }
    } catch {}
    $last = ''
    $lastPoll = Get-Date '2000-01-01'
  }
  if (((Get-Date) - $lastPoll).TotalMilliseconds -ge 800) {
    $lastPoll = Get-Date
    $json = (State | ConvertTo-Json -Compress)
    if ($json -ne $last) { [Console]::Out.WriteLine($json); [Console]::Out.Flush(); $last = $json }
  }
  Start-Sleep -Milliseconds 40
}
