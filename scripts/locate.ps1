# Ada - the computer's approximate location from Windows (Settings → Privacy → Location must allow
# desktop apps). Prints {"lat":..,"lon":..,"acc":..} or {"error":".."}. Used once, for the weather.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
  } | Select-Object -First 1
  function Await($op, [Type]$type) {
    $task = $asTask.MakeGenericMethod($type).Invoke($null, @($op))
    if (-not $task.Wait(12000)) { throw 'zaman aşımı' }
    $task.Result
  }
  $null = [Windows.Devices.Geolocation.Geolocator, Windows.Devices.Geolocation, ContentType = WindowsRuntime]
  $null = [Windows.Devices.Geolocation.Geoposition, Windows.Devices.Geolocation, ContentType = WindowsRuntime]
  $g = New-Object Windows.Devices.Geolocation.Geolocator
  $g.DesiredAccuracyInMeters = 5000
  $pos = Await ($g.GetGeopositionAsync()) ([Windows.Devices.Geolocation.Geoposition])
  $c = $pos.Coordinate.Point.Position
  [Console]::Out.WriteLine((@{ lat = [math]::Round($c.Latitude, 3); lon = [math]::Round($c.Longitude, 3); acc = [int]$pos.Coordinate.Accuracy } | ConvertTo-Json -Compress))
} catch {
  [Console]::Out.WriteLine((@{ error = "$($_.Exception.Message)" } | ConvertTo-Json -Compress))
}
