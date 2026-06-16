param(
  [Parameter(Mandatory = $true)]
  [string]$WorkbookPath,
  [string]$OutputPath = 'public\bonificacaoSnapshot.json'
)

$ErrorActionPreference = 'Stop'

function Normalize-Text {
  param([string]$Text)
  if ($null -eq $Text) { return '' }
  return ($Text.Normalize([Text.NormalizationForm]::FormD) -replace '[\u0300-\u036f]', '').ToLowerInvariant()
}

function Normalize-Header {
  param([string]$Text)
  if ($null -eq $Text) { return '' }
  return $Text.Trim()
}

function Convert-ValueToText {
  param(
    [object]$Value,
    [string]$Header = ''
  )

  if ($null -eq $Value) { return '' }
  if ($Value -is [datetime]) {
    return $Value.ToString('dd/MM/yyyy HH:mm')
  }

  if ($Value -is [double] -or $Value -is [single] -or $Value -is [decimal]) {
    $numeric = [double]$Value
    if ($Header -match '(?i)(^data|data|hora)' -and $numeric -gt 20000 -and $numeric -lt 60000) {
      $base = [datetime]'1899-12-30'
      $days = [int][math]::Floor($numeric)
      $fraction = $numeric - $days
      $date = $base.AddDays($days).AddDays($fraction)
      if ($fraction -gt 0) {
        return $date.ToString('dd/MM/yyyy HH:mm')
      }
      return $date.ToString('dd/MM/yyyy')
    }

    return ([double]$Value).ToString([Globalization.CultureInfo]::InvariantCulture)
  }

  return ([string]$Value).Trim()
}

function Get-RowField {
  param(
    $Row,
    [string]$ExpectedName
  )

  $target = Normalize-Text $ExpectedName
  foreach ($prop in $Row.PSObject.Properties) {
    if ((Normalize-Text $prop.Name) -eq $target) {
      return $prop.Value
    }
  }
  return ''
}

function Get-WorksheetByNameLike {
  param(
    $Workbook,
    [string]$ExpectedName
  )

  $target = Normalize-Text $ExpectedName
  foreach ($worksheet in @($Workbook.Worksheets)) {
    if ((Normalize-Text $worksheet.Name) -eq $target) {
      return $worksheet
    }
  }
  throw "Worksheet not found: $ExpectedName"
}

function Read-SheetRows {
  param($Worksheet)

  $range = $Worksheet.UsedRange
  $rows = $range.Rows.Count
  $cols = $range.Columns.Count
  $values = $range.Value2

  $headers = @()
  for ($c = 1; $c -le $cols; $c++) {
    $headers += (Normalize-Header (Convert-ValueToText -Value $values[1, $c]))
  }

  $items = New-Object System.Collections.Generic.List[object]
  for ($r = 2; $r -le $rows; $r++) {
    $obj = [ordered]@{}
    $hasValue = $false

    for ($c = 1; $c -le $cols; $c++) {
      $key = $headers[$c - 1]
      if ([string]::IsNullOrWhiteSpace($key)) { continue }
      $text = Convert-ValueToText -Value $values[$r, $c] -Header $key
      if (-not [string]::IsNullOrWhiteSpace($text)) { $hasValue = $true }
      $obj[$key] = $text
    }

    if ($hasValue) {
      $items.Add([pscustomobject]$obj)
    }
  }

  return $items
}

function To-Number {
  param([object]$Value)
  if ($null -eq $Value) { return 0 }
  $text = [string]$Value
  if ([string]::IsNullOrWhiteSpace($text)) { return 0 }
  $text = $text.Replace(' ', '').Replace('.', '').Replace(',', '.')
  $result = 0.0
  if ([double]::TryParse($text, [Globalization.NumberStyles]::Any, [Globalization.CultureInfo]::InvariantCulture, [ref]$result)) {
    return $result
  }
  return 0
}

function Get-MonthKey {
  param([string]$Value)
  if ([string]::IsNullOrWhiteSpace($Value)) { return 'sem-data' }
  if ($Value -match '(\d{2})/(\d{2})/(\d{4})') {
    return "$($matches[3])-$($matches[2])"
  }
  if ($Value -match '(\d{4})-(\d{2})') {
    return "$($matches[1])-$($matches[2])"
  }
  return 'sem-data'
}

function Month-Label {
  param([string]$MonthKey)
  if ($MonthKey -eq 'sem-data') { return 'Sem data' }
  $parts = $MonthKey.Split('-')
  return "$($parts[1])/$($parts[0])"
}

function Group-By {
  param(
    [object[]]$Rows,
    [scriptblock]$KeySelector,
    [scriptblock]$Accumulator
  )

  $map = @{}
  foreach ($row in $Rows) {
    $key = & $KeySelector $row
    if (-not $map.ContainsKey($key)) {
      $map[$key] = [ordered]@{ key = $key; count = 0 }
    }
    & $Accumulator $map[$key] $row
  }

  return $map.Values
}

function Add-NumberProp {
  param([hashtable]$Bucket, [string]$Name, [double]$Value)
  if (-not $Bucket.Contains($Name) -or $null -eq $Bucket[$Name]) {
    $Bucket[$Name] = 0
  }
  $Bucket[$Name] = [double]$Bucket[$Name] + $Value
}

function Get-PropValue {
  param([hashtable]$Bucket, [string]$Name)
  if (-not $Bucket.Contains($Name) -or $null -eq $Bucket[$Name]) { return 0 }
  return $Bucket[$Name]
}

if (-not (Test-Path -LiteralPath $WorkbookPath)) {
  throw "Workbook not found: $WorkbookPath"
}

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

try {
  $wb = $excel.Workbooks.Open($WorkbookPath, 0, $true)

  $entradaRows = @(Read-SheetRows (Get-WorksheetByNameLike $wb 'Entrada de CFF'))
  $rampaRows = @(Read-SheetRows (Get-WorksheetByNameLike $wb 'CQO - Rampa'))
  $faturamentoRows = @(Read-SheetRows (Get-WorksheetByNameLike $wb 'Faturamento'))
  $tipoRows = @(Read-SheetRows (Get-WorksheetByNameLike $wb 'Tipo Fornecedor'))
  $precoRows = @(Read-SheetRows (Get-WorksheetByNameLike $wb 'Preco Fornecedor'))

  $entradaByMonth = Group-By -Rows $entradaRows -KeySelector {
    param($row) (Get-MonthKey (Get-RowField $row 'Data'))
  } -Accumulator {
    param($bucket, $row)
    $bucket.count++
    Add-NumberProp $bucket 'totalPesoBrutoKg' (To-Number (Get-RowField $row 'Peso Bruto'))
    Add-NumberProp $bucket 'totalPesoLiquidoKg' (To-Number (Get-RowField $row 'Peso Liquido'))
    Add-NumberProp $bucket 'totalTaraKg' (To-Number (Get-RowField $row 'Tara'))
    Add-NumberProp $bucket 'totalCachos' (To-Number (Get-RowField $row 'N Cachos'))
    Add-NumberProp $bucket 'ticketCount' 1
  } | ForEach-Object {
    [ordered]@{
      monthKey = $_.key
      monthLabel = Month-Label $_.key
      tickets = Get-PropValue $_ 'ticketCount'
      pesoBrutoKg = [Math]::Round((Get-PropValue $_ 'totalPesoBrutoKg'), 2)
      pesoLiquidoKg = [Math]::Round((Get-PropValue $_ 'totalPesoLiquidoKg'), 2)
      taraKg = [Math]::Round((Get-PropValue $_ 'totalTaraKg'), 2)
      cachos = [Math]::Round((Get-PropValue $_ 'totalCachos'), 2)
    }
  } | Sort-Object monthKey

  $entradaByProduct = Group-By -Rows $entradaRows -KeySelector {
    param($row) (Get-RowField $row 'Produto')
  } -Accumulator {
    param($bucket, $row)
    $bucket.count++
    Add-NumberProp $bucket 'totalPesoLiquidoKg' (To-Number (Get-RowField $row 'Peso Liquido'))
  } | ForEach-Object {
    [ordered]@{
      produto = $_.key
      registros = $_.count
      pesoLiquidoKg = [Math]::Round((Get-PropValue $_ 'totalPesoLiquidoKg'), 2)
    }
  } | Sort-Object pesoLiquidoKg -Descending

  $rampaByMonth = Group-By -Rows $rampaRows -KeySelector {
    param($row) (Get-MonthKey (Get-RowField $row 'Data'))
  } -Accumulator {
    param($bucket, $row)
    $bucket.count++
    foreach ($field in @('TCA', 'CV', 'CM', 'CP', 'TC')) {
      $sumName = "sum$field"
      Add-NumberProp $bucket $sumName (To-Number (Get-RowField $row $field))
    }
  } | ForEach-Object {
    $count = [Math]::Max($_.count, 1)
    [ordered]@{
      monthKey = $_.key
      monthLabel = Month-Label $_.key
      registros = $_.count
      tcaMedia = [Math]::Round(((Get-PropValue $_ 'sumTCA') / $count), 2)
      cvMedia = [Math]::Round(((Get-PropValue $_ 'sumCV') / $count), 2)
      cmMedia = [Math]::Round(((Get-PropValue $_ 'sumCM') / $count), 2)
      cpMedia = [Math]::Round(((Get-PropValue $_ 'sumCP') / $count), 2)
      tcMedia = [Math]::Round(((Get-PropValue $_ 'sumTC') / $count), 2)
    }
  } | Sort-Object monthKey

  $rampaByFarm = Group-By -Rows $rampaRows -KeySelector {
    param($row) (Get-RowField $row 'Fazenda')
  } -Accumulator {
    param($bucket, $row)
    $bucket.count++
    Add-NumberProp $bucket 'totalTca' (To-Number (Get-RowField $row 'TCA'))
    Add-NumberProp $bucket 'totalCv' (To-Number (Get-RowField $row 'CV'))
    Add-NumberProp $bucket 'totalCm' (To-Number (Get-RowField $row 'CM'))
    Add-NumberProp $bucket 'totalCp' (To-Number (Get-RowField $row 'CP'))
    Add-NumberProp $bucket 'totalTc' (To-Number (Get-RowField $row 'TC'))
  } | ForEach-Object {
    $count = [Math]::Max($_.count, 1)
    [ordered]@{
      fazenda = $_.key
      registros = $_.count
      tcaMedia = [Math]::Round(((Get-PropValue $_ 'totalTca') / $count), 2)
      cvMedia = [Math]::Round(((Get-PropValue $_ 'totalCv') / $count), 2)
      cmMedia = [Math]::Round(((Get-PropValue $_ 'totalCm') / $count), 2)
      cpMedia = [Math]::Round(((Get-PropValue $_ 'totalCp') / $count), 2)
      tcMedia = [Math]::Round(((Get-PropValue $_ 'totalTc') / $count), 2)
    }
  } | Sort-Object tcaMedia -Descending

  $faturamentoByMonth = Group-By -Rows $faturamentoRows -KeySelector {
    param($row) (Get-MonthKey (Get-RowField $row 'Data Faturamento'))
  } -Accumulator {
    param($bucket, $row)
    $bucket.count++
    Add-NumberProp $bucket 'totalPesoLiquidoKg' (To-Number (Get-RowField $row 'Peso Liquido'))
    Add-NumberProp $bucket 'totalPesoBrutoKg' (To-Number (Get-RowField $row 'Peso Bruto'))
    Add-NumberProp $bucket 'totalTaraKg' (To-Number (Get-RowField $row 'Tara'))
  } | ForEach-Object {
    [ordered]@{
      monthKey = $_.key
      monthLabel = Month-Label $_.key
      registros = $_.count
      pesoLiquidoKg = [Math]::Round((Get-PropValue $_ 'totalPesoLiquidoKg'), 2)
      pesoBrutoKg = [Math]::Round((Get-PropValue $_ 'totalPesoBrutoKg'), 2)
      taraKg = [Math]::Round((Get-PropValue $_ 'totalTaraKg'), 2)
    }
  } | Sort-Object monthKey

  $faturamentoByProduct = Group-By -Rows $faturamentoRows -KeySelector {
    param($row) (Get-RowField $row 'Produto')
  } -Accumulator {
    param($bucket, $row)
    $bucket.count++
    Add-NumberProp $bucket 'totalPesoLiquidoKg' (To-Number (Get-RowField $row 'Peso Liquido'))
  } | ForEach-Object {
    [ordered]@{
      produto = $_.key
      registros = $_.count
      pesoLiquidoKg = [Math]::Round((Get-PropValue $_ 'totalPesoLiquidoKg'), 2)
    }
  } | Sort-Object pesoLiquidoKg -Descending

  $tipoFornecedor = $tipoRows | ForEach-Object {
    [ordered]@{
      fornecedor = Get-RowField $_ 'FORNECEDOR'
      tipo = Get-RowField $_ 'TIPO'
      representante = Get-RowField $_ 'REPRESENTANTE'
      classificacao = Get-RowField $_ 'CLASSIFICACAO'
      origem = Get-RowField $_ 'ORIGEM'
    }
  }

  $precoFornecedor = $precoRows | ForEach-Object {
    $prices = @()
    for ($i = 1; $i -le 19; $i++) {
      $field = "Preco Unit $i"
      $num = To-Number (Get-RowField $_ $field)
      if ($num -gt 0) { $prices += $num }
    }
    $avg = if ($prices.Count) { ($prices | Measure-Object -Average).Average } else { 0 }
    [ordered]@{
      fornecedor = Get-RowField $_ 'FORNECEDOR'
      precoMedio = [Math]::Round($avg, 2)
      precoMin = if ($prices.Count) { [Math]::Round(($prices | Measure-Object -Minimum).Minimum, 2) } else { 0 }
      precoMax = if ($prices.Count) { [Math]::Round(($prices | Measure-Object -Maximum).Maximum, 2) } else { 0 }
      unidades = $prices.Count
    }
  } | Sort-Object precoMedio -Descending

  $snapshot = [ordered]@{
    generatedAt = (Get-Date).ToString('o')
    sourcePath = $WorkbookPath
    entradaDeCff = [ordered]@{
      totalRegistros = $entradaRows.Count
      totalPesoBrutoKg = [Math]::Round((($entradaRows | ForEach-Object { To-Number (Get-RowField $_ 'Peso Bruto') } | Measure-Object -Sum).Sum), 2)
      totalPesoLiquidoKg = [Math]::Round((($entradaRows | ForEach-Object { To-Number (Get-RowField $_ 'Peso Liquido') } | Measure-Object -Sum).Sum), 2)
      totalTaraKg = [Math]::Round((($entradaRows | ForEach-Object { To-Number (Get-RowField $_ 'Tara') } | Measure-Object -Sum).Sum), 2)
      totalCachos = [Math]::Round((($entradaRows | ForEach-Object { To-Number (Get-RowField $_ 'N Cachos') } | Measure-Object -Sum).Sum), 2)
      byMonth = $entradaByMonth
      byProduct = $entradaByProduct
    }
    cqoRampa = [ordered]@{
      totalRegistros = $rampaRows.Count
      byMonth = $rampaByMonth
      byFarm = $rampaByFarm
    }
    faturamento = [ordered]@{
      totalRegistros = $faturamentoRows.Count
      totalPesoLiquidoKg = [Math]::Round((($faturamentoRows | ForEach-Object { To-Number (Get-RowField $_ 'Peso Liquido') } | Measure-Object -Sum).Sum), 2)
      totalPesoBrutoKg = [Math]::Round((($faturamentoRows | ForEach-Object { To-Number (Get-RowField $_ 'Peso Bruto') } | Measure-Object -Sum).Sum), 2)
      totalTaraKg = [Math]::Round((($faturamentoRows | ForEach-Object { To-Number (Get-RowField $_ 'Tara') } | Measure-Object -Sum).Sum), 2)
      byMonth = $faturamentoByMonth
      byProduct = $faturamentoByProduct
    }
    fornecedores = [ordered]@{
      tipo = $tipoFornecedor
      preco = $precoFornecedor
    }
  }

  $outputDir = Split-Path -Parent $OutputPath
  if ($outputDir -and -not (Test-Path -LiteralPath $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
  }

  $snapshot | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
}
finally {
  if ($wb) { $wb.Close($false) }
  if ($excel) { $excel.Quit() }
}
