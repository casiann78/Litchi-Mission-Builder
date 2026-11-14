# Startet den Litchi Mission Builder lokal auf diesem Rechner.
# Es wird nichts ins Internet gesendet und nichts hochgeladen. Der kleine Webserver hört nur auf "localhost".
param([switch]$NoBrowser)

$ErrorActionPreference = "Stop"
$rootFull = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "dist"))
if (-not (Test-Path (Join-Path $rootFull "index.html"))) {
  Write-Host "Der Ordner 'dist' wurde nicht gefunden. Bitte das ZIP vollständig entpacken und dann erneut starten."
  Read-Host "Zum Beenden Enter drücken"
  exit 1
}

$types = @{
  ".html" = "text/html; charset=utf-8"
  ".js"   = "text/javascript; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".svg"  = "image/svg+xml"
  ".woff2" = "font/woff2"
  ".woff" = "font/woff"
  ".json" = "application/json"
  ".gz"   = "application/gzip"
  ".png"  = "image/png"
  ".ico"  = "image/x-icon"
}

$listener = $null
$usedPort = 0
foreach ($port in 8080..8090) {
  try {
    $candidate = New-Object System.Net.HttpListener
    $candidate.Prefixes.Add("http://localhost:$port/")
    $candidate.Start()
    $listener = $candidate
    $usedPort = $port
    break
  } catch { }
}
if (-not $listener) {
  Write-Host "Kein freier Anschluss (Port 8080 bis 8090) gefunden. Bitte andere Programme schließen und erneut starten."
  Read-Host "Zum Beenden Enter drücken"
  exit 1
}

$url = "http://localhost:$usedPort/"
Write-Host ""
Write-Host "Litchi Mission Builder läuft auf $url"
Write-Host "Dieses Fenster bitte offen lassen. Zum Beenden das Fenster schließen."
if (-not $NoBrowser) { Start-Process $url }

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  try {
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart("/"))
    $path = [IO.Path]::GetFullPath((Join-Path $rootFull $rel))
    $inside = $path.StartsWith($rootFull + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)
    if (-not $inside -or -not (Test-Path $path -PathType Leaf)) { $path = Join-Path $rootFull "index.html" }
    $ext = [IO.Path]::GetExtension($path).ToLower()
    $ctx.Response.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { "application/octet-stream" }
    $bytes = [IO.File]::ReadAllBytes($path)
    $ctx.Response.ContentLength64 = $bytes.Length
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  } catch {
    $ctx.Response.StatusCode = 500
  } finally {
    $ctx.Response.OutputStream.Close()
  }
}
