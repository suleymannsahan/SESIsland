# Ada - which apps are using the camera or the microphone right now.
# Windows records this in the registry (the same data as the taskbar's privacy icon):
#   HKCU\...\CapabilityAccessManager\ConsentStore\<webcam|microphone>\[NonPackaged\]<app>
# An app is using the device while LastUsedTimeStart is set and LastUsedTimeStop is 0.
# Prints {"cam":[...],"mic":[...]} whenever the list changes.
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$base = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore'

function Friendly($key) {
  $n = $key.PSChildName
  if ($key.PSParentPath -like '*NonPackaged') {
    $n = ($n -split '#')[-1] -replace '\.exe$', ''
  } else {
    $n = ($n -split '_')[0]
    $n = ($n -split '\.')[-1]
  }
  switch -Regex ($n) {
    '^WindowsCamera$' { 'Kamera' }
    '^(msedge|MicrosoftEdge)$' { 'Edge' }
    '^chrome$' { 'Chrome' }
    '^firefox$' { 'Firefox' }
    '^(Zoom|zoom)$' { 'Zoom' }
    '^(ms-teams|Teams|MSTeams)$' { 'Teams' }
    '^Discord$' { 'Discord' }
    '^obs64$' { 'OBS' }
    default { $n }
  }
}

function InUse($cap) {
  $names = @()
  foreach ($root in @("$base\$cap", "$base\$cap\NonPackaged")) {
    foreach ($k in (Get-ChildItem $root)) {
      if ($k.PSChildName -eq 'NonPackaged') { continue }
      $p = Get-ItemProperty $k.PSPath
      if ($p -and $p.LastUsedTimeStart -and [long]$p.LastUsedTimeStop -eq 0) {
        $f = Friendly $k
        if ($f -and $f -notmatch '^(Ada|electron)$') { $names += $f }
      }
    }
  }
  @($names | Sort-Object -Unique)
}

$last = ''
while ($true) {
  $cam = @(InUse 'webcam')
  $mic = @(InUse 'microphone')
  $json = (@{ cam = $cam; mic = $mic } | ConvertTo-Json -Compress)
  if ($json -ne $last) {
    [Console]::Out.WriteLine($json)
    [Console]::Out.Flush()
    $last = $json
  }
  Start-Sleep -Milliseconds 1500
}
