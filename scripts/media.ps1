# Ada - Windows media sessions (GlobalSystemMediaTransportControls): YouTube in a browser, VLC,
# Media Player, Spotify app… whatever shows up in the Windows volume flyout.
# Prints one JSON line when something changes:
#   {"t":"state","current":"<id>","sessions":[{id,title,artist,album,status,pos,dur,upd,next,prev,seek,key}]}
#   {"t":"thumb","id":"<id>","key":"<title|artist>","mime":"image/jpeg","data":"<base64>"}
# Reads JSON commands from stdin: {"c":"toggle|play|pause|next|prev|seek","id":"<id>","ms":123}
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
  } | Select-Object -First 1
  function Await($op, [Type]$type) {
    $task = $asTask.MakeGenericMethod($type).Invoke($null, @($op))
    if (-not $task.Wait(4000)) { throw 'timeout' }
    $task.Result
  }
  $null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
  $null = [Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType = WindowsRuntime]
  $MgrT = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]
  $PropsT = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties]
  $StreamT = [Windows.Storage.Streams.IRandomAccessStreamWithContentType]
  $mgr = Await ($MgrT::RequestAsync()) $MgrT
} catch {
  [Console]::Out.WriteLine((@{ t = 'error'; error = "$($_.Exception.Message)" } | ConvertTo-Json -Compress))
  exit 2
}

# stdin on a background runspace so the poll loop never blocks
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
$null = $reader.BeginInvoke()

function Find-Session($id) {
  foreach ($s in $mgr.GetSessions()) { if ($s.SourceAppUserModelId -eq $id) { return $s } }
  return $null
}

function Run-Command($line) {
  $c = $line | ConvertFrom-Json
  $s = Find-Session $c.id
  if (-not $s) { return }
  $bool = [bool]
  switch ($c.c) {
    'toggle' { $null = Await ($s.TryTogglePlayPauseAsync()) $bool }
    'play'   { $null = Await ($s.TryPlayAsync()) $bool }
    'pause'  { $null = Await ($s.TryPauseAsync()) $bool }
    'next'   { $null = Await ($s.TrySkipNextAsync()) $bool }
    'prev'   { $null = Await ($s.TrySkipPreviousAsync()) $bool }
    'seek'   { $null = Await ($s.TryChangePlaybackPositionAsync([long]$c.ms * 10000)) $bool }
  }
}

function Send-Thumb($s, $id, $key) {
  try {
    $props = Await ($s.TryGetMediaPropertiesAsync()) $PropsT
    if (-not $props.Thumbnail) { return }
    $ras = Await ($props.Thumbnail.OpenReadAsync()) $StreamT
    $net = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($ras)
    $ms = New-Object System.IO.MemoryStream
    $net.CopyTo($ms)
    $net.Dispose()
    if ($ms.Length -le 0 -or $ms.Length -gt 1500000) { return }
    $mime = if ($ras.ContentType) { $ras.ContentType } else { 'image/png' }
    [Console]::Out.WriteLine((@{ t = 'thumb'; id = $id; key = $key; mime = $mime; data = [Convert]::ToBase64String($ms.ToArray()) } | ConvertTo-Json -Compress))
    [Console]::Out.Flush()
  } catch {}
}

$last = ''
$thumbKeys = @{}
$cmd = $null
$nextPoll = [DateTime]::MinValue
while ($true) {
  $acted = $false
  while ($queue.TryDequeue([ref]$cmd)) {
    if ($cmd -eq '__eof__') { exit 0 }
    try { Run-Command $cmd } catch {}
    $acted = $true
  }
  if ($acted) { Start-Sleep -Milliseconds 250; $nextPoll = [DateTime]::MinValue }
  if ([DateTime]::Now -ge $nextPoll) {
    $nextPoll = [DateTime]::Now.AddMilliseconds(1000)
    try {
      $list = @()
      foreach ($s in $mgr.GetSessions()) {
        try {
          $id = $s.SourceAppUserModelId
          $p = Await ($s.TryGetMediaPropertiesAsync()) $PropsT
          $pb = $s.GetPlaybackInfo()
          $tl = $s.GetTimelineProperties()
          $st = switch ([int]$pb.PlaybackStatus) { 4 { 'playing' } 5 { 'paused' } 3 { 'stopped' } 2 { 'changing' } default { 'closed' } }
          $key = "$($p.Title)|$($p.Artist)"
          $list += [ordered]@{
            id = $id; title = "$($p.Title)"; artist = "$($p.Artist)"; album = "$($p.AlbumTitle)"
            status = $st
            pos = [long]$tl.Position.TotalMilliseconds; dur = [long]($tl.EndTime - $tl.StartTime).TotalMilliseconds
            upd = [long]([DateTimeOffset]$tl.LastUpdatedTime).ToUnixTimeMilliseconds()
            next = [bool]$pb.Controls.IsNextEnabled; prev = [bool]$pb.Controls.IsPreviousEnabled
            seek = [bool]$pb.Controls.IsPlaybackPositionEnabled; key = $key
          }
          if ($thumbKeys[$id] -ne $key -and $p.Title) { $thumbKeys[$id] = $key; Send-Thumb $s $id $key }
        } catch {}
      }
      $cur = $mgr.GetCurrentSession()
      $state = [ordered]@{ t = 'state'; current = $(if ($cur) { $cur.SourceAppUserModelId } else { '' }); sessions = $list }
      # position moves every second; only report it when something else changed or it jumped
      $sig = ($list | ForEach-Object { "$($_.id)/$($_.key)/$($_.status)/$($_.upd)/$($_.next)/$($_.prev)" }) -join ';'
      $sig = "$($state.current)#$sig"
      if ($sig -ne $last) {
        $last = $sig
        [Console]::Out.WriteLine(($state | ConvertTo-Json -Compress -Depth 4))
        [Console]::Out.Flush()
      }
    } catch {}
  }
  Start-Sleep -Milliseconds 60
}
