# Ada - presses a Claude Desktop approval button, found by exact name (live UI Automation search).
param(
  [Parameter(Mandatory = $true)][string]$PatternsFile,
  [Parameter(Mandatory = $true)][ValidateSet('allow', 'deny')][string]$Which
)

$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$pat = Get-Content -Raw -Encoding UTF8 -LiteralPath $PatternsFile | ConvertFrom-Json
if ($Which -eq 'allow') { $names = @($pat.allowNames) } else { $names = @($pat.denyNames) }
if ($names.Count -eq 0) { Write-Output 'no-names'; exit 3 }

$AE = [System.Windows.Automation.AutomationElement]
$Scope = [System.Windows.Automation.TreeScope]
$btn = New-Object System.Windows.Automation.PropertyCondition($AE::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button)

$ids = @(Get-Process -Name 'claude' -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
if ($ids.Count -eq 0) { Write-Output 'no-window'; exit 1 }
$wins = @($AE::RootElement.FindAll($Scope::Children, [System.Windows.Automation.Condition]::TrueCondition) | Where-Object { $ids -contains $_.Current.ProcessId })

# Try names in order of preference ("Allow once" before "Allow for this session" before "Allow").
foreach ($name in $names) {
  $nameCond = [System.Windows.Automation.PropertyCondition]::new($AE::NameProperty, [string]$name)
  $cond = [System.Windows.Automation.AndCondition]::new([System.Windows.Automation.Condition[]]@($btn, $nameCond))
  foreach ($w in $wins) {
    $b = $w.FindFirst($Scope::Descendants, $cond)
    if (-not $b) { continue }
    $p = $null
    if ($b.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$p)) {
      $p.Invoke(); Write-Output "clicked: $name (invoke)"; exit 0
    }
    if ($b.TryGetCurrentPattern([System.Windows.Automation.LegacyIAccessiblePattern]::Pattern, [ref]$p)) {
      $p.DoDefaultAction(); Write-Output "clicked: $name (legacy)"; exit 0
    }
    try { $b.SetFocus(); Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(' '); Write-Output "clicked: $name (focus+space)"; exit 0 } catch {}
  }
}
Write-Output 'not-found'
exit 2
