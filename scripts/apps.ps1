# Ada - every app in the Start menu (desktop programs and Store apps), for the command bar.
# Prints a JSON array of { name, id } ; launch with explorer.exe shell:AppsFolder\<id>.
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$apps = Get-StartApps | Where-Object { $_.Name -and $_.AppID } | ForEach-Object { [ordered]@{ name = $_.Name; id = $_.AppID } }
[Console]::Out.WriteLine((@($apps) | ConvertTo-Json -Compress -Depth 2))
