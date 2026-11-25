# Ada - connected devices: Bluetooth (classic and Low Energy: headphones, mice, keyboards, game
# controllers, phones…) with their battery level when Windows knows it, and USB drives.
# Prints {"bt":[{id,name,kind,battery}],"usb":[{id,name,size}]} whenever something changes.
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$haveBt = $true
try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
  } | Select-Object -First 1
  function Await($op, [Type]$type) {
    $task = $asTask.MakeGenericMethod($type).Invoke($null, @($op))
    if (-not $task.Wait(5000)) { throw 'timeout' }
    $task.Result
  }
  $null = [Windows.Devices.Enumeration.DeviceInformation, Windows.Devices.Enumeration, ContentType = WindowsRuntime]
  $null = [Windows.Devices.Enumeration.DeviceInformationCollection, Windows.Devices.Enumeration, ContentType = WindowsRuntime]
  $null = [Windows.Devices.Bluetooth.BluetoothDevice, Windows.Devices.Bluetooth, ContentType = WindowsRuntime]
  $null = [Windows.Devices.Bluetooth.BluetoothLEDevice, Windows.Devices.Bluetooth, ContentType = WindowsRuntime]
  $DI = [Windows.Devices.Enumeration.DeviceInformation]
  $DIC = [Windows.Devices.Enumeration.DeviceInformationCollection]
  $connected = [Windows.Devices.Bluetooth.BluetoothConnectionStatus]::Connected
  $selClassic = [Windows.Devices.Bluetooth.BluetoothDevice]::GetDeviceSelectorFromConnectionStatus($connected)
  $selLE = [Windows.Devices.Bluetooth.BluetoothLEDevice]::GetDeviceSelectorFromConnectionStatus($connected)
} catch { $haveBt = $false }

$kinds = @{}      # device id -> kind (looked up once)
$battery = @{}    # 12-hex address -> percent
$nextBattery = [DateTime]::MinValue

function Kind-Classic($id) {
  try {
    $d = Await ([Windows.Devices.Bluetooth.BluetoothDevice]::FromIdAsync($id)) ([Windows.Devices.Bluetooth.BluetoothDevice])
    $c = $d.ClassOfDevice
    switch ("$($c.MajorClass)") {
      'AudioVideo' { return 'audio' }
      'Phone' { return 'phone' }
      'Computer' { return 'computer' }
      'Wearable' { return 'watch' }
      'Peripheral' {
        $m = "$($c.MinorClass)"
        if ($m -match 'Keyboard') { return 'keyboard' }
        if ($m -match 'Pointer|Mouse') { return 'mouse' }
        if ($m -match 'Gamepad|Joystick') { return 'gamepad' }
        return 'input'
      }
    }
  } catch {}
  return ''
}

function Kind-LE($id) {
  try {
    $d = Await ([Windows.Devices.Bluetooth.BluetoothLEDevice]::FromIdAsync($id)) ([Windows.Devices.Bluetooth.BluetoothLEDevice])
    $a = $d.Appearance
    if ($a.Category -eq 15) {            # HID
      switch ([int]$a.SubCategory) { 1 { return 'keyboard' } 2 { return 'mouse' } 3 { return 'gamepad' } 4 { return 'gamepad' } default { return 'input' } }
    }
    if ($a.Category -eq 3) { return 'watch' }
    if ($a.Category -eq 1) { return 'phone' }
    if ($a.Category -eq 37) { return 'audio' }   # hearing aid
  } catch {}
  return ''
}

function Address($id) {
  # "...Bluetooth#Bluetooth00:11:22:33:44:55-a0:b1:c2:d3:e4:f5" -> "A0B1C2D3E4F5"
  $m = [regex]::Matches($id, '([0-9a-fA-F]{2}[:]){5}[0-9a-fA-F]{2}')
  if ($m.Count -gt 0) { return ($m[$m.Count - 1].Value -replace ':', '').ToUpper() }
  return ''
}

function Read-Batteries($addrs) {
  # Windows keeps the battery level (when the device reports one) on the device node:
  # DEVPKEY_Bluetooth_Battery = {104EA319-6EE2-4701-BD47-8DDBF425BBE5} 2
  $out = @{}
  if (-not $addrs.Count) { return $out }
  $all = Get-PnpDevice -PresentOnly | Where-Object { $_.InstanceId -match 'BTHENUM|BTHLE|BTHLEDEVICE|BTHHFENUM' }
  foreach ($a in $addrs) {
    foreach ($p in ($all | Where-Object { $_.InstanceId -match $a })) {
      $v = Get-PnpDeviceProperty -InstanceId $p.InstanceId -KeyName '{104EA319-6EE2-4701-BD47-8DDBF425BBE5} 2'
      if ($v -and $null -ne $v.Data -and "$($v.Data)" -ne '') {
        $n = [int]$v.Data
        if (-not $out.ContainsKey($a) -or $n -gt $out[$a]) { $out[$a] = $n }
      }
    }
  }
  return $out
}

$last = ''
$lastAddrs = ''
while ($true) {
  $bt = @()
  if ($haveBt) {
    $seen = @{}
    foreach ($pair in @(@($selClassic, 'classic'), @($selLE, 'le'))) {
      try {
        $list = Await ($DI::FindAllAsync($pair[0])) $DIC
        foreach ($d in $list) {
          $addr = Address $d.Id
          $key = if ($addr) { $addr } else { $d.Id }
          if ($seen.ContainsKey($key) -or -not $d.Name) { continue }
          $seen[$key] = $true
          if (-not $kinds.ContainsKey($d.Id)) { $kinds[$d.Id] = if ($pair[1] -eq 'classic') { Kind-Classic $d.Id } else { Kind-LE $d.Id } }
          $bt += [ordered]@{ id = $key; name = "$($d.Name)"; kind = $kinds[$d.Id]; battery = $null }
        }
      } catch {}
    }
    # battery: right after something new connects (Windows needs a few seconds), then once a minute
    $addrs = @($bt | ForEach-Object { $_.id } | Where-Object { $_ -match '^[0-9A-F]{12}$' })
    $sig = ($addrs | Sort-Object) -join ','
    if ($sig -ne $lastAddrs) { $lastAddrs = $sig; $nextBattery = [DateTime]::Now.AddSeconds(4) }
    if ([DateTime]::Now -ge $nextBattery) {
      $nextBattery = [DateTime]::Now.AddSeconds(60)
      $battery = Read-Batteries $addrs
    }
    foreach ($b in $bt) { if ($battery.ContainsKey($b.id)) { $b.battery = $battery[$b.id] } }
  }

  $usb = @()
  foreach ($d in (Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=2')) {
    $usb += [ordered]@{ id = "$($d.DeviceID)"; name = $(if ($d.VolumeName) { "$($d.VolumeName) ($($d.DeviceID))" } else { "USB bellek ($($d.DeviceID))" }); size = [long]$d.Size }
  }

  $state = [ordered]@{ bt = @($bt); usb = @($usb) }
  $json = $state | ConvertTo-Json -Compress -Depth 4
  if ($json -ne $last) {
    [Console]::Out.WriteLine($json)
    [Console]::Out.Flush()
    $last = $json
  }
  Start-Sleep -Milliseconds 2500
}
