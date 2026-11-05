# Ada - battery level of a Bluetooth audio device, by (part of) its name. Prints a number or nothing.
param([string]$Name)
$ErrorActionPreference = 'SilentlyContinue'
$key = '{104EA319-6EE2-4701-BD47-8DDBF425BBE5} 2'   # DEVPKEY_Bluetooth_Battery
if (-not $Name) { exit 0 }
$pattern = '*' + ($Name -replace '[\[\]\*\?]', '') + '*'
$best = $null
foreach ($d in (Get-PnpDevice -FriendlyName $pattern -PresentOnly)) {
  $p = Get-PnpDeviceProperty -InstanceId $d.InstanceId -KeyName $key
  if ($p -and $null -ne $p.Data -and "$($p.Data)" -ne '') { $best = [int]$p.Data; break }
}
if ($null -ne $best) { [Console]::Out.WriteLine($best) }
