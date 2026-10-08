# OCR de los recortes de etiqueta que guarda ac_driver.py → nombre real de cada preset de Animation Composer.
# Usa el OCR integrado de Windows (Windows.Media.Ocr), sin dependencias.
# Uso (Windows PowerShell 5.1):  powershell -ExecutionPolicy Bypass -File tools/ocr_labels.ps1
# Salida: research/harvest/station/labels.csv  (archivo, sección, código, nombre)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$dir = Join-Path $root "research\harvest\station\labels"
$out = Join-Path $root "research\harvest\station\labels.csv"

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime]
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($op, [Type]$t) { $task = $asTask.MakeGenericMethod($t).Invoke($null, @($op)); $task.Wait() | Out-Null; $task.Result }

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if (-not $engine) { throw "No hay motor OCR para el idioma del perfil de Windows." }

$rows = foreach ($f in Get-ChildItem $dir -Filter *.png) {
    $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($f.FullName)) ([Windows.Storage.StorageFile])
    $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    $dec = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bmp = Await ($dec.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $res = Await ($engine.RecognizeAsync($bmp)) ([Windows.Media.Ocr.OcrResult])
    $stream.Dispose()
    $parts = $f.BaseName -split "__"
    [pscustomobject]@{ file = $f.Name; section = $parts[0]; code = $parts[-1]; name = ($res.Text -replace '\s+', ' ').Trim() }
}
$rows | Export-Csv -Path $out -NoTypeInformation -Encoding UTF8
"OCR: $(@($rows).Count) etiquetas → $out"
