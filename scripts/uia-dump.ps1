# Ada - writes the names of Claude Desktop's UI elements to a text file,
# so the button names the watcher looks for can be matched to your Claude version and language.
param([Parameter(Mandatory = $true)][string]$Out)

$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$AE = [System.Windows.Automation.AutomationElement]
$Scope = [System.Windows.Automation.TreeScope]
$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("Ada tanilama - $(Get-Date -Format s)")
$lines.Add('Claude Desktop acikken ve tercihen bir izin sorusu ekrandayken calistir.')
$lines.Add('')

$ids = @(Get-Process -Name 'claude' -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
if ($ids.Count -eq 0) { $lines.Add('Claude Desktop calismiyor.') }

$wins = $AE::RootElement.FindAll($Scope::Children, [System.Windows.Automation.Condition]::TrueCondition)
foreach ($w in $wins) {
  if (-not ($ids -contains $w.Current.ProcessId)) { continue }
  $lines.Add("=== Pencere: '$($w.Current.Name)' (pid $($w.Current.ProcessId))")
  $all = $w.FindAll($Scope::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
  $count = 0
  foreach ($e in $all) {
    $n = $e.Current.Name
    $t = $e.Current.ControlType.ProgrammaticName -replace 'ControlType\.', ''
    if ($n -and ($t -in @('Button', 'MenuItem', 'CheckBox', 'Hyperlink', 'Text', 'Group', 'Dialog'))) {
      $short = $n.Trim() -replace '\s+', ' '
      if ($short.Length -gt 140) { $short = $short.Substring(0, 140) + '...' }
      $lines.Add("[$t] $short")
      $count++
      if ($count -ge 1500) { $lines.Add('... (kesildi)'); break }
    }
  }
  $lines.Add('')
}

[System.IO.File]::WriteAllLines($Out, $lines, (New-Object System.Text.UTF8Encoding($true)))
Write-Output $Out
