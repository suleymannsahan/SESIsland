# Ada - records Claude Desktop's short button and status texts for a while,
# writing each new one with the second it first appeared. Used to learn the real
# names of the Stop / Allow / Deny buttons on this Claude version.
param(
  [Parameter(Mandatory = $true)][string]$Out,
  [int]$Seconds = 60
)

$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$AE = [System.Windows.Automation.AutomationElement]
$Scope = [System.Windows.Automation.TreeScope]
$enc = New-Object System.Text.UTF8Encoding($true)
$seen = New-Object 'System.Collections.Generic.HashSet[string]'
$start = Get-Date
[System.IO.File]::WriteAllText($Out, "Ada kayit - $(Get-Date -Format s) - $Seconds sn`r`n`r`n", $enc)

# Everything visible at the start is the baseline; only what appears later is interesting.
$baseline = $true
while (((Get-Date) - $start).TotalSeconds -lt $Seconds) {
  $ids = @(Get-Process -Name 'claude' -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
  $new = New-Object System.Collections.Generic.List[string]
  $wins = $AE::RootElement.FindAll($Scope::Children, [System.Windows.Automation.Condition]::TrueCondition)
  foreach ($w in $wins) {
    if (-not ($ids -contains $w.Current.ProcessId)) { continue }
    $all = $w.FindAll($Scope::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
    foreach ($e in $all) {
      $n = $e.Current.Name
      if (-not $n) { continue }
      $n = ($n.Trim() -replace '\s+', ' ')
      if ($n.Length -gt 80) { continue }
      $t = $e.Current.ControlType.ProgrammaticName -replace 'ControlType\.', ''
      if ($t -notin @('Button', 'Text', 'Dialog', 'Group', 'MenuItem', 'CheckBox', 'RadioButton')) { continue }
      $key = "[$t] $n"
      if ($seen.Add($key) -and -not $baseline) { $new.Add($key) }
    }
  }
  if ($baseline) {
    $baseline = $false
    [System.IO.File]::AppendAllText($Out, "(baslangicta $($seen.Count) oge vardi, sadece sonradan cikanlar yaziliyor)`r`n`r`n", $enc)
  } elseif ($new.Count -gt 0) {
    $sec = [int]((Get-Date) - $start).TotalSeconds
    $block = ($new | ForEach-Object { "+${sec}s $_" }) -join "`r`n"
    [System.IO.File]::AppendAllText($Out, $block + "`r`n", $enc)
  }
  Start-Sleep -Milliseconds 700
}
[System.IO.File]::AppendAllText($Out, "`r`nKayit bitti.`r`n", $enc)
Write-Output $Out
