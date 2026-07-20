[CmdletBinding()]
param(
  [string[]]$SourceRoots = @('E:\TÉCNICA'),
  [string]$OutputDirectory = '',
  [int]$PreviewRows = 12,
  [int]$PreviewColumns = 40,
  [switch]$IncludeHashes,
  [switch]$IncludeAllTabularFiles
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Convert-ToSafeFileName {
  param([string]$Value)
  return ($Value -replace '[^a-zA-Z0-9._-]', '_')
}

function Release-ComObject {
  param([object]$ComObject)
  if ($null -ne $ComObject -and [System.Runtime.InteropServices.Marshal]::IsComObject($ComObject)) {
    [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($ComObject)
  }
}

function Get-CellPreview {
  param(
    [object]$Worksheet,
    [int]$Rows,
    [int]$Columns
  )

  $preview = [System.Collections.Generic.List[object]]::new()
  for ($rowIndex = 1; $rowIndex -le $Rows; $rowIndex += 1) {
    $cells = [System.Collections.Generic.List[object]]::new()
    $hasValue = $false

    for ($columnIndex = 1; $columnIndex -le $Columns; $columnIndex += 1) {
      $cell = $null
      try {
        $cell = $Worksheet.Cells.Item($rowIndex, $columnIndex)
        $text = [string]$cell.Text
        $formula = [string]$cell.Formula
        if (-not [string]::IsNullOrWhiteSpace($text) -or ($formula -and $formula.StartsWith('='))) {
          $hasValue = $true
          $cells.Add([ordered]@{
            column = $columnIndex
            address = [string]$cell.Address($false, $false)
            text = if ($text.Length -gt 300) { $text.Substring(0, 300) } else { $text }
            formula = if ($formula.StartsWith('=')) { $formula } else { $null }
          })
        }
      } finally {
        Release-ComObject $cell
      }
    }

    if ($hasValue) {
      $preview.Add([ordered]@{
        row = $rowIndex
        cells = @($cells)
      })
    }
  }

  return @($preview)
}

function Get-WorkbookProfile {
  param(
    [object]$Excel,
    [System.IO.FileInfo]$File,
    [int]$MaxRows,
    [int]$MaxColumns
  )

  $workbook = $null
  $profiles = [System.Collections.Generic.List[object]]::new()
  try {
    $workbook = $Excel.Workbooks.Open($File.FullName, 0, $true)
    foreach ($worksheet in @($workbook.Worksheets)) {
      $usedRange = $null
      try {
        $usedRange = $worksheet.UsedRange
        $usedRows = [int]$usedRange.Rows.Count
        $usedColumns = [int]$usedRange.Columns.Count
        $previewRowCount = [Math]::Min([Math]::Max($usedRows, 0), $MaxRows)
        $previewColumnCount = [Math]::Min([Math]::Max($usedColumns, 0), $MaxColumns)

        $profiles.Add([ordered]@{
          sheet = [string]$worksheet.Name
          visible = ([int]$worksheet.Visible -eq -1)
          used_rows = $usedRows
          used_columns = $usedColumns
          preview_rows = if ($previewRowCount -gt 0 -and $previewColumnCount -gt 0) {
            Get-CellPreview -Worksheet $worksheet -Rows $previewRowCount -Columns $previewColumnCount
          } else {
            @()
          }
        })
      } finally {
        Release-ComObject $usedRange
        Release-ComObject $worksheet
      }
    }

    return [ordered]@{
      path = $File.FullName
      workbook_opened = $true
      sheets = @($profiles)
      error = $null
    }
  } catch {
    return [ordered]@{
      path = $File.FullName
      workbook_opened = $false
      sheets = @()
      error = $_.Exception.Message
    }
  } finally {
    if ($null -ne $workbook) {
      try { $workbook.Close($false) } catch { }
      Release-ComObject $workbook
    }
  }
}

$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
  $OutputDirectory = Join-Path ([Environment]::GetFolderPath('Desktop')) "VNA_Diagnostico_Perdas_$timestamp"
}

$sourceRootFullPaths = @($SourceRoots | ForEach-Object {
  [System.IO.Path]::GetFullPath($_).TrimEnd('\')
})
$outputFullPath = [System.IO.Path]::GetFullPath($OutputDirectory).TrimEnd('\')

foreach ($root in $sourceRootFullPaths) {
  if ($outputFullPath.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "O diretorio de saida nao pode ficar dentro da origem somente leitura: $root"
  }
}

New-Item -ItemType Directory -Path $outputFullPath -Force | Out-Null

$candidatePattern = '(?i)(balan|cqo|qualidade|estim|peso|cacho|invent|produc|colheita|cff)'
$allowedExtensions = @('.xlsx', '.xlsm', '.xls', '.xlsb', '.csv')
$manifest = [System.Collections.Generic.List[object]]::new()
$errors = [System.Collections.Generic.List[object]]::new()

foreach ($root in $sourceRootFullPaths) {
  if (-not (Test-Path -LiteralPath $root)) {
    $errors.Add([ordered]@{ stage = 'source_root'; path = $root; error = 'Origem nao encontrada ou sem acesso.' })
    continue
  }

  try {
    Get-ChildItem -LiteralPath $root -Recurse -File -ErrorAction Stop | ForEach-Object {
      if ($allowedExtensions -notcontains $_.Extension.ToLowerInvariant()) { return }
      if (-not $IncludeAllTabularFiles -and $_.FullName -notmatch $candidatePattern) { return }

      $hash = $null
      if ($IncludeHashes) {
        try { $hash = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash } catch {
          $errors.Add([ordered]@{ stage = 'hash'; path = $_.FullName; error = $_.Exception.Message })
        }
      }

      $manifest.Add([pscustomobject][ordered]@{
        source_root = $root
        path = $_.FullName
        directory = $_.DirectoryName
        file_name = $_.Name
        extension = $_.Extension.ToLowerInvariant()
        size_bytes = $_.Length
        last_write_utc = $_.LastWriteTimeUtc.ToString('o')
        sha256 = $hash
      })
    }
  } catch {
    $errors.Add([ordered]@{ stage = 'scan'; path = $root; error = $_.Exception.Message })
  }
}

$manifestPath = Join-Path $outputFullPath 'source_manifest.json'
$manifestCsvPath = Join-Path $outputFullPath 'source_manifest.csv'
@($manifest) | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
if ($manifest.Count -gt 0) {
  $manifest | Export-Csv -LiteralPath $manifestCsvPath -NoTypeInformation -Encoding UTF8
} else {
  'source_root,path,directory,file_name,extension,size_bytes,last_write_utc,sha256' |
    Set-Content -LiteralPath $manifestCsvPath -Encoding UTF8
}

$excel = $null
$workbookProfiles = [System.Collections.Generic.List[object]]::new()
try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $excel.AskToUpdateLinks = $false
  try { $excel.AutomationSecurity = 3 } catch { }

  foreach ($entry in @($manifest | Where-Object { $_.extension -ne '.csv' })) {
    $file = Get-Item -LiteralPath $entry.path
    $workbookProfiles.Add((Get-WorkbookProfile -Excel $excel -File $file -MaxRows $PreviewRows -MaxColumns $PreviewColumns))
  }
} catch {
  $errors.Add([ordered]@{
    stage = 'excel_com'
    path = ''
    error = "Excel COM indisponivel. O manifesto ainda foi gerado. Detalhe: $($_.Exception.Message)"
  })
} finally {
  if ($null -ne $excel) {
    try { $excel.Quit() } catch { }
    Release-ComObject $excel
  }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}

$profilePath = Join-Path $outputFullPath 'workbook_profiles.json'
$errorsPath = Join-Path $outputFullPath 'diagnostic_errors.json'
@($workbookProfiles) | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $profilePath -Encoding UTF8
@($errors) | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $errorsPath -Encoding UTF8

$summary = @"
VNA - Diagnostico somente leitura das fontes de Perdas

Gerado em: $(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')
Origens consultadas: $($sourceRootFullPaths -join '; ')
Arquivos candidatos: $($manifest.Count)
Workbooks perfilados: $($workbookProfiles.Count)
Erros registrados: $($errors.Count)

Arquivos de saida:
- source_manifest.csv/json: inventario de arquivos, datas, tamanhos e hash opcional.
- workbook_profiles.json: abas, dimensoes e primeiras linhas/celulas para mapear colunas e formulas.
- diagnostic_errors.json: origens inacessiveis, arquivos bloqueados ou erros do Excel.

Garantia operacional:
- Nenhum arquivo da origem foi criado, alterado, movido ou excluido.
- Os workbooks foram abertos em modo somente leitura.
- O pacote nao contem credenciais de Supabase.
"@
$summaryPath = Join-Path $outputFullPath 'README.txt'
$summary | Set-Content -LiteralPath $summaryPath -Encoding UTF8

$zipPath = Join-Path (Split-Path -Parent $outputFullPath) "$(Convert-ToSafeFileName (Split-Path -Leaf $outputFullPath)).zip"
if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
Compress-Archive -Path (Join-Path $outputFullPath '*') -DestinationPath $zipPath -CompressionLevel Optimal

Write-Host ''
Write-Host 'Diagnostico concluido.' -ForegroundColor Green
Write-Host "Pasta: $outputFullPath"
Write-Host "Pacote: $zipPath"
Write-Host 'Envie o ZIP para o PC do dashboard ou copie-o para uma pasta sincronizada do OneDrive.'
