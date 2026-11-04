# Ada - serial port bridge. Uses .NET's System.IO.Ports, so no drivers or native modules are needed.
#   -List            prints the available ports as JSON and exits
#   -Port COM3 -Baud 115200   opens the port; every received line is printed to stdout,
#                             every line written to stdin is sent to the device.
param(
  [switch]$List,
  [string]$Port = '',
  [int]$Baud = 115200,
  [string]$NewLine = "`n"
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

if ($List) {
  $names = @([System.IO.Ports.SerialPort]::GetPortNames() | Sort-Object -Unique)
  $friendly = @{}
  try {
    Get-CimInstance -ClassName Win32_PnPEntity -Filter "Name LIKE '%(COM%'" | ForEach-Object {
      if ($_.Name -match '\((COM\d+)\)') { $friendly[$Matches[1]] = ($_.Name -replace '\s*\(COM\d+\)', '') }
    }
  } catch {}
  $out = @($names | ForEach-Object { @{ port = $_; name = [string]$friendly[$_] } })
  [Console]::Out.WriteLine((ConvertTo-Json -Compress -InputObject $out))
  exit 0
}

if (-not $Port) { [Console]::Out.WriteLine('!ERR Port seçilmedi'); exit 2 }

$sp = New-Object System.IO.Ports.SerialPort $Port, $Baud, 'None', 8, 'One'
$sp.NewLine = $NewLine
$sp.ReadTimeout = 200
$sp.DtrEnable = $true
$sp.RtsEnable = $true
$sp.Encoding = [System.Text.Encoding]::UTF8
try { $sp.Open() } catch { [Console]::Out.WriteLine("!ERR $($_.Exception.Message)"); exit 1 }
[Console]::Out.WriteLine("!OPEN $Port $Baud")
[Console]::Out.Flush()

# stdin -> port, on a background runspace so reading the port is never blocked.
$writer = [PowerShell]::Create()
$null = $writer.AddScript({
  param($port)
  $in = [Console]::In
  while ($true) {
    $line = $in.ReadLine()
    if ($null -eq $line) { break }
    try { $port.WriteLine($line) } catch { break }
  }
}).AddArgument($sp)
$handle = $writer.BeginInvoke()

$buf = ''
try {
  while ($sp.IsOpen) {
    try {
      $chunk = $sp.ReadExisting()
    } catch [System.TimeoutException] { $chunk = '' }
    if ($chunk) {
      $buf += $chunk
      while (($i = $buf.IndexOf("`n")) -ge 0) {
        $line = $buf.Substring(0, $i).TrimEnd("`r")
        $buf = $buf.Substring($i + 1)
        [Console]::Out.WriteLine($line)
      }
      if ($buf.Length -gt 4096) { [Console]::Out.WriteLine($buf); $buf = '' }
      [Console]::Out.Flush()
    } else {
      Start-Sleep -Milliseconds 15
    }
    if ($handle.IsCompleted) { break }
  }
} catch {
  [Console]::Out.WriteLine("!ERR $($_.Exception.Message)")
} finally {
  try { $sp.Close() } catch {}
  [Console]::Out.WriteLine('!CLOSED')
}
