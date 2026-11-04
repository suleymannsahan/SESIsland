# Ada - Claude Desktop watcher (experimental)
# Reads every Claude Desktop window (titled or not) through Windows UI Automation and prints
# one JSON line whenever its state changes: gone | idle | working | question | permission.
param(
  [Parameter(Mandatory = $true)][string]$PatternsFile,
  [int]$IntervalMs = 700
)

$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Patterns come from a UTF-8 JSON file: regexes passed on the command line get mangled.
$pat = Get-Content -Raw -Encoding UTF8 -LiteralPath $PatternsFile | ConvertFrom-Json
$Working = [string]$pat.working
$Allow = [string]$pat.allow
$Deny = [string]$pat.deny
$Waiting = [string]$pat.waiting
$Prompt = [string]$pat.prompt
$Session = [string]$pat.session
$AllowNames = @($pat.allowNames)
$DenyNames = @($pat.denyNames)
if (-not $Working -or -not $Allow -or -not $Deny) { [Console]::Out.WriteLine('{"state":"error","title":"patterns"}'); exit 3 }

$AE = [System.Windows.Automation.AutomationElement]
$Scope = [System.Windows.Automation.TreeScope]
$True_ = [System.Windows.Automation.Condition]::TrueCondition

# Fetch Name + ControlType for the whole tree in one cross-process call instead of thousands.
$cr = New-Object System.Windows.Automation.CacheRequest
$cr.Add($AE::NameProperty)
$cr.Add($AE::ControlTypeProperty)
$cr.Add($AE::ProcessIdProperty)
$cr.AutomationElementMode = [System.Windows.Automation.AutomationElementMode]::None

# Live (uncached) search for real buttons with exactly these names. Chat text with the same
# words is a Text element, so it never matches.
function Find-Buttons($root, [string[]]$names) {
  if (-not $names -or $names.Count -eq 0) { return @() }
  $btn = New-Object System.Windows.Automation.PropertyCondition($AE::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button)
  [System.Windows.Automation.Condition[]]$nameConds = @($names | ForEach-Object { [System.Windows.Automation.PropertyCondition]::new($AE::NameProperty, [string]$_) })
  if ($nameConds.Count -eq 1) { $nc = $nameConds[0] } else { $nc = [System.Windows.Automation.OrCondition]::new($nameConds) }
  $cond = [System.Windows.Automation.AndCondition]::new([System.Windows.Automation.Condition[]]@($btn, $nc))
  $out = @()
  foreach ($e in $root.FindAll($Scope::Descendants, $cond)) { try { $out += $e.Current.Name } catch {} }
  return $out
}

function Emit($obj) {
  [Console]::Out.WriteLine(($obj | ConvertTo-Json -Compress))
  [Console]::Out.Flush()
}

$last = ''
$prevRaw = ''
$calm = 0
$pause = $IntervalMs
while ($true) {
  $t0 = Get-Date
  $state = 'gone'; $title = ''; $prompt = ''; $found = @(); $hints = @()
  $buttons = New-Object System.Collections.Generic.List[string]
  $texts = New-Object System.Collections.Generic.List[string]
  $winCount = 0
  $windows = @()

  $ids = @(Get-Process -Name 'claude' -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
  if ($ids.Count -gt 0) {
    $tops = $AE::RootElement.FindAll($Scope::Children, $True_)
    foreach ($w in $tops) {
      try { if (-not ($ids -contains $w.Current.ProcessId)) { continue } } catch { continue }
      $winCount++
      $windows += $w
      $h = $cr.Activate()
      try {
        $all = $w.FindAll($Scope::Descendants, $True_)
      } finally { $h.Dispose() }
      foreach ($e in $all) {
        try {
          $n = $e.Cached.Name
          if (-not $n) { continue }
          $n = ($n.Trim() -replace '\s+', ' ')
          if ($n.Length -gt 90) { continue }
          $ct = $e.Cached.ControlType.ProgrammaticName
          if ($ct -eq 'ControlType.Button') { $buttons.Add($n) }
          elseif ($ct -eq 'ControlType.Text' -or $ct -eq 'ControlType.Group') { $texts.Add($n) }
        } catch {}
      }
    }
  }

  if ($winCount -gt 0) {
    $state = 'idle'
    if ($Session) {
      foreach ($b in $buttons) { if ($b -match $Session) { $t = $Matches[1]; if ($t -and $t.Length -le 60) { $title = $t; break } } }
    }
    $allow = @($buttons | Where-Object { $_ -match $Allow })
    $deny = @($buttons | Where-Object { $_ -match $Deny })
    $everything = @($buttons) + @($texts)
    if ($allow.Count -gt 0 -and $deny.Count -gt 0) {
      $state = 'permission'
      $found = $allow + $deny
      if ($Prompt) { foreach ($x in $everything) { if ($x -match $Prompt) { $prompt = $Matches[1]; break } } }
    } elseif ($Waiting -and @($everything | Where-Object { $_ -match $Waiting }).Count -gt 0) {
      $state = 'question'
      foreach ($w in $windows) {
        $la = @(Find-Buttons $w $AllowNames)
        $ld = @(Find-Buttons $w $DenyNames)
        if ($la.Count -gt 0 -and $ld.Count -gt 0) {
          $state = 'permission'
          $found = $la + $ld
          if ($Prompt) { foreach ($x in $everything) { if ($x -match $Prompt) { $prompt = $Matches[1]; break } } }
          break
        }
      }
      # For the log: anything that looks like an approval button but did not match.
      if ($state -eq 'question') { $hints = @($everything | Where-Object { $_ -match '(?i)allow|decline|deny|izin|reddet|approve|reject' } | Select-Object -First 8) }
    } elseif (@($everything | Where-Object { $_ -match $Working }).Count -gt 0) {
      $state = 'working'
    }
  }

  # A permission card must be seen on two polls in a row before it is reported.
  if ($state -eq 'permission' -and $prevRaw -ne 'permission') { $prevRaw = $state; Start-Sleep -Milliseconds 250; continue }
  $prevRaw = $state

  $key = "$state|$title|$prompt|$($found -join ',')"
  if ($key -ne $last) {
    $ms = [int]((Get-Date) - $t0).TotalMilliseconds
    Emit @{ state = $state; title = $title; prompt = $prompt; buttons = @($found); hints = @($hints); windows = $winCount; elements = ($buttons.Count + $texts.Count); ms = $ms }
    $last = $key
  }
    # Adaptive pace: look often while Claude is busy, rarely while idle or closed.
  if ($state -eq 'working' -or $state -eq 'question' -or $state -eq 'permission') { $calm = 0; $pause = $IntervalMs }
  else {
    $calm = [Math]::Min($calm + 1, 1000)
    if ($state -eq 'gone') { $pause = 4000 }
    elseif ($calm -gt 8) { $pause = 2200 }     # idle for a while
    else { $pause = 1000 }
  }
  Start-Sleep -Milliseconds $pause
}
