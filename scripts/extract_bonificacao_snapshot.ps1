param(
  [Parameter(Mandatory = $true)]
  [string]$WorkbookPath,
  [string]$OutputPath = 'public\bonificacaoSnapshot.json'
)

$ErrorActionPreference = 'Stop'

function Normalize-Text {
  param([string]$Text)
  if ($null -eq $Text) { return '' }
  $value = $Text.Normalize([Text.NormalizationForm]::FormD) -replace '[\u0300-\u036f]', ''
  $value = $value -replace '[^a-zA-Z0-9]+', ' '
  return ($value.Trim() -replace '\s+', ' ').ToLowerInvariant()
}

function Get-WorksheetByNameMatching {
  param(
    $Workbook,
    [scriptblock]$Predicate,
    [string]$ErrorLabel
  )

  foreach ($sheet in @($Workbook.Worksheets)) {
    if (& $Predicate $sheet.Name) {
      return $sheet
    }
  }

  throw "Worksheet not found: $ErrorLabel"
}

function Get-RangeMatrix {
  param($Worksheet)
  $range = $Worksheet.UsedRange
  return [pscustomobject]@{
    Values = $range.Value2
    Rows = $range.Rows.Count
    Cols = $range.Columns.Count
  }
}

function Get-HeaderMap {
  param($Values, [int]$Cols)
  $map = @{}
  for ($c = 1; $c -le $Cols; $c++) {
    $header = [string]$Values[1, $c]
    $key = Normalize-Text $header
    if ($key) {
      $map[$key] = $c
    }
  }
  return $map
}

function Get-Value {
  param($Values, [int]$Row, [int]$Col)
  if ($Col -le 0) { return $null }
  return $Values[$Row, $Col]
}

function Convert-ToText {
  param(
    [object]$Value,
    [string]$HeaderKey = ''
  )

  if ($null -eq $Value) { return '' }
  if ($Value -is [datetime]) {
    return $Value.ToString('dd/MM/yyyy HH:mm')
  }

  if ($Value -is [double] -or $Value -is [single] -or $Value -is [decimal] -or $Value -is [int] -or $Value -is [long]) {
    $number = [double]$Value
    if ($HeaderKey -match '(^| )(data|hora)( |$)' -and $number -gt 20000 -and $number -lt 60000) {
      $base = [datetime]'1899-12-30'
      $days = [int][math]::Floor($number)
      $fraction = $number - $days
      $date = $base.AddDays($days).AddDays($fraction)
      if ($fraction -gt 0) {
        return $date.ToString('dd/MM/yyyy HH:mm')
      }
      return $date.ToString('dd/MM/yyyy')
    }

    return $number.ToString([Globalization.CultureInfo]::InvariantCulture)
  }

  return ([string]$Value).Trim()
}

function Convert-ToNumber {
  param([object]$Value)
  if ($null -eq $Value) { return 0 }
  if ($Value -is [double] -or $Value -is [single] -or $Value -is [decimal] -or $Value -is [int] -or $Value -is [long]) {
    return [double]$Value
  }
  $text = ([string]$Value).Trim()
  if (-not $text) { return 0 }
  $text = $text.Replace(' ', '').Replace('.', '').Replace(',', '.')
  $result = 0.0
  if ([double]::TryParse($text, [Globalization.NumberStyles]::Any, [Globalization.CultureInfo]::InvariantCulture, [ref]$result)) {
    return $result
  }
  return 0
}

function Month-Key {
  param([object]$Value)
  if ($Value -is [double] -or $Value -is [single] -or $Value -is [decimal] -or $Value -is [int] -or $Value -is [long]) {
    $serial = [double]$Value
    if ($serial -gt 20000 -and $serial -lt 60000) {
      $base = [datetime]'1899-12-30'
      $date = $base.AddDays([int][math]::Floor($serial))
      return '{0}-{1:00}' -f $date.Year, $date.Month
    }
  }
  $text = Convert-ToText $Value
  if (-not $text) { return 'sem-data' }
  if ($text -match '(\d{2})/(\d{2})/(\d{4})') {
    return "$($matches[3])-$($matches[2])"
  }
  if ($text -match '(\d{4})-(\d{2})') {
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

function New-Bucket {
  param([string]$Key)
  return @{
    key = $Key
    count = 0
  }
}

function Ensure-Bucket {
  param(
    [hashtable]$Map,
    [string]$Key
  )

  if (-not $Map.ContainsKey($Key)) {
    $Map[$Key] = New-Bucket -Key $Key
  }

  return $Map[$Key]
}

function Add-Value {
  param(
    [object]$Bucket,
    [string]$Name,
    [double]$Value
  )

  if (-not $Bucket.Contains($Name) -or $null -eq $Bucket[$Name]) {
    $Bucket[$Name] = 0
  }

  $Bucket[$Name] = [double]$Bucket[$Name] + $Value
}

function Get-Index {
  param(
    [hashtable]$Headers,
    [string[]]$Candidates
  )

  foreach ($candidate in $Candidates) {
    $key = Normalize-Text $candidate
    if ($Headers.ContainsKey($key)) {
      return [int]$Headers[$key]
    }
  }

  return 0
}

if (-not (Test-Path -LiteralPath $WorkbookPath)) {
  throw "Workbook not found: $WorkbookPath"
}

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

try {
  $wb = $excel.Workbooks.Open($WorkbookPath, 0, $true)

  $entradaWs = Get-WorksheetByNameMatching $wb { param($name) ($name -eq 'Entrada de CFF') } 'Entrada de CFF'
  $rampaWs = Get-WorksheetByNameMatching $wb { param($name) ($name -eq 'CQO - Rampa') } 'CQO - Rampa'
  $faturamentoWs = Get-WorksheetByNameMatching $wb { param($name) ($name -eq 'Faturamento') } 'Faturamento'
  $tipoWs = Get-WorksheetByNameMatching $wb { param($name) ($name -eq 'Tipo Fornecedor') } 'Tipo Fornecedor'
  $precoWs = Get-WorksheetByNameMatching $wb { param($name) ($name -like '*Fornecedor' -and $name -ne 'Tipo Fornecedor') } 'Preco Fornecedor'

  $entrada = Get-RangeMatrix $entradaWs
  $rampa = Get-RangeMatrix $rampaWs
  $faturamento = Get-RangeMatrix $faturamentoWs
  $tipo = Get-RangeMatrix $tipoWs
  $preco = Get-RangeMatrix $precoWs

  $entradaHeaders = Get-HeaderMap $entrada.Values $entrada.Cols
  $rampaHeaders = Get-HeaderMap $rampa.Values $rampa.Cols
  $faturamentoHeaders = Get-HeaderMap $faturamento.Values $faturamento.Cols
  $tipoHeaders = Get-HeaderMap $tipo.Values $tipo.Cols
  $precoHeaders = Get-HeaderMap $preco.Values $preco.Cols

  $entradaDataIdx = Get-Index $entradaHeaders @('Data')
  $entradaProdutoIdx = Get-Index $entradaHeaders @('Produto')
  $entradaPesoBrutoIdx = Get-Index $entradaHeaders @('Peso Bruto')
  $entradaPesoLiquidoIdx = Get-Index $entradaHeaders @('Peso Liquido')
  $entradaTaraIdx = Get-Index $entradaHeaders @('Tara')
  $entradaCachosIdx = Get-Index $entradaHeaders @('N Cachos')

  $entradaMonthMap = @{}
  $entradaProductMap = @{}
  for ($r = 2; $r -le $entrada.Rows; $r++) {
    $monthKey = Month-Key (Get-Value $entrada.Values $r $entradaDataIdx)
    $monthBucket = Ensure-Bucket $entradaMonthMap $monthKey
    $monthBucket['count'] = [double]$monthBucket['count'] + 1
    Add-Value $monthBucket 'tickets' 1
    Add-Value $monthBucket 'pesoBrutoKg' (Convert-ToNumber (Get-Value $entrada.Values $r $entradaPesoBrutoIdx))
    Add-Value $monthBucket 'pesoLiquidoKg' (Convert-ToNumber (Get-Value $entrada.Values $r $entradaPesoLiquidoIdx))
    Add-Value $monthBucket 'taraKg' (Convert-ToNumber (Get-Value $entrada.Values $r $entradaTaraIdx))
    Add-Value $monthBucket 'cachos' (Convert-ToNumber (Get-Value $entrada.Values $r $entradaCachosIdx))

    $productKey = Convert-ToText (Get-Value $entrada.Values $r $entradaProdutoIdx)
    $productBucket = Ensure-Bucket $entradaProductMap $productKey
    $productBucket['count'] = [double]$productBucket['count'] + 1
    Add-Value $productBucket 'pesoLiquidoKg' (Convert-ToNumber (Get-Value $entrada.Values $r $entradaPesoLiquidoIdx))
  }

  $entradaByMonth = $entradaMonthMap.GetEnumerator() | ForEach-Object {
    $bucket = $_.Value
    [ordered]@{
      monthKey = $_.Key
      monthLabel = Month-Label $_.Key
      tickets = [Math]::Round([double]$bucket['tickets'], 2)
      pesoBrutoKg = [Math]::Round([double]$bucket['pesoBrutoKg'], 2)
      pesoLiquidoKg = [Math]::Round([double]$bucket['pesoLiquidoKg'], 2)
      taraKg = [Math]::Round([double]$bucket['taraKg'], 2)
      cachos = [Math]::Round([double]$bucket['cachos'], 2)
    }
  } | Sort-Object { $_['monthKey'] }

  $entradaByProduct = $entradaProductMap.GetEnumerator() | ForEach-Object {
    $bucket = $_.Value
    [ordered]@{
      produto = $_.Key
      registros = [Math]::Round([double]$bucket['count'], 2)
      pesoLiquidoKg = [Math]::Round([double]$bucket['pesoLiquidoKg'], 2)
    }
  } | Sort-Object { $_['pesoLiquidoKg'] } -Descending

  $rampaDataIdx = Get-Index $rampaHeaders @('Data')
  $rampaFazendaIdx = Get-Index $rampaHeaders @('Fazenda')
  $rampaTcaIdx = Get-Index $rampaHeaders @('TCA')
  $rampaCvIdx = Get-Index $rampaHeaders @('CV')
  $rampaCmIdx = Get-Index $rampaHeaders @('CM')
  $rampaCpIdx = Get-Index $rampaHeaders @('CP')
  $rampaTcIdx = Get-Index $rampaHeaders @('TC')

  $rampaMonthMap = @{}
  $rampaFarmMap = @{}
  for ($r = 2; $r -le $rampa.Rows; $r++) {
    $monthKey = Month-Key (Get-Value $rampa.Values $r $rampaDataIdx)
    $monthBucket = Ensure-Bucket $rampaMonthMap $monthKey
    $monthBucket['count'] = [double]$monthBucket['count'] + 1
    Add-Value $monthBucket 'sumTCA' (Convert-ToNumber (Get-Value $rampa.Values $r $rampaTcaIdx))
    Add-Value $monthBucket 'sumCV' (Convert-ToNumber (Get-Value $rampa.Values $r $rampaCvIdx))
    Add-Value $monthBucket 'sumCM' (Convert-ToNumber (Get-Value $rampa.Values $r $rampaCmIdx))
    Add-Value $monthBucket 'sumCP' (Convert-ToNumber (Get-Value $rampa.Values $r $rampaCpIdx))
    Add-Value $monthBucket 'sumTC' (Convert-ToNumber (Get-Value $rampa.Values $r $rampaTcIdx))

    $farmKey = Convert-ToText (Get-Value $rampa.Values $r $rampaFazendaIdx)
    $farmBucket = Ensure-Bucket $rampaFarmMap $farmKey
    $farmBucket['count'] = [double]$farmBucket['count'] + 1
    Add-Value $farmBucket 'sumTCA' (Convert-ToNumber (Get-Value $rampa.Values $r $rampaTcaIdx))
    Add-Value $farmBucket 'sumCV' (Convert-ToNumber (Get-Value $rampa.Values $r $rampaCvIdx))
    Add-Value $farmBucket 'sumCM' (Convert-ToNumber (Get-Value $rampa.Values $r $rampaCmIdx))
    Add-Value $farmBucket 'sumCP' (Convert-ToNumber (Get-Value $rampa.Values $r $rampaCpIdx))
    Add-Value $farmBucket 'sumTC' (Convert-ToNumber (Get-Value $rampa.Values $r $rampaTcIdx))
  }

  $rampaByMonth = $rampaMonthMap.GetEnumerator() | ForEach-Object {
    $bucket = $_.Value
    $count = [Math]::Max([double]$bucket['count'], 1)
    [ordered]@{
      monthKey = $_.Key
      monthLabel = Month-Label $_.Key
      registros = [Math]::Round([double]$bucket['count'], 2)
      tcaMedia = [Math]::Round(([double]$bucket['sumTCA'] / $count), 2)
      cvMedia = [Math]::Round(([double]$bucket['sumCV'] / $count), 2)
      cmMedia = [Math]::Round(([double]$bucket['sumCM'] / $count), 2)
      cpMedia = [Math]::Round(([double]$bucket['sumCP'] / $count), 2)
      tcMedia = [Math]::Round(([double]$bucket['sumTC'] / $count), 2)
    }
  } | Sort-Object { $_['monthKey'] }

  $rampaByFarm = $rampaFarmMap.GetEnumerator() | ForEach-Object {
    $bucket = $_.Value
    $count = [Math]::Max([double]$bucket['count'], 1)
    [ordered]@{
      fazenda = $_.Key
      registros = [Math]::Round([double]$bucket['count'], 2)
      tcaMedia = [Math]::Round(([double]$bucket['sumTCA'] / $count), 2)
      cvMedia = [Math]::Round(([double]$bucket['sumCV'] / $count), 2)
      cmMedia = [Math]::Round(([double]$bucket['sumCM'] / $count), 2)
      cpMedia = [Math]::Round(([double]$bucket['sumCP'] / $count), 2)
      tcMedia = [Math]::Round(([double]$bucket['sumTC'] / $count), 2)
    }
  } | Sort-Object { $_['registros'] } -Descending

  $fatDataIdx = Get-Index $faturamentoHeaders @('Data Faturamento')
  $fatProdutoIdx = Get-Index $faturamentoHeaders @('Produto')
  $fatPesoBrutoIdx = Get-Index $faturamentoHeaders @('Peso Bruto')
  $fatPesoLiquidoIdx = Get-Index $faturamentoHeaders @('Peso Liquido')
  $fatTaraIdx = Get-Index $faturamentoHeaders @('Tara')

  $faturamentoMonthMap = @{}
  $faturamentoProductMap = @{}
  for ($r = 2; $r -le $faturamento.Rows; $r++) {
    $monthKey = Month-Key (Get-Value $faturamento.Values $r $fatDataIdx)
    $monthBucket = Ensure-Bucket $faturamentoMonthMap $monthKey
    $monthBucket['count'] = [double]$monthBucket['count'] + 1
    Add-Value $monthBucket 'pesoBrutoKg' (Convert-ToNumber (Get-Value $faturamento.Values $r $fatPesoBrutoIdx))
    Add-Value $monthBucket 'pesoLiquidoKg' (Convert-ToNumber (Get-Value $faturamento.Values $r $fatPesoLiquidoIdx))
    Add-Value $monthBucket 'taraKg' (Convert-ToNumber (Get-Value $faturamento.Values $r $fatTaraIdx))

    $productKey = Convert-ToText (Get-Value $faturamento.Values $r $fatProdutoIdx)
    $productBucket = Ensure-Bucket $faturamentoProductMap $productKey
    $productBucket['count'] = [double]$productBucket['count'] + 1
    Add-Value $productBucket 'pesoLiquidoKg' (Convert-ToNumber (Get-Value $faturamento.Values $r $fatPesoLiquidoIdx))
  }

  $faturamentoByMonth = $faturamentoMonthMap.GetEnumerator() | ForEach-Object {
    $bucket = $_.Value
    [ordered]@{
      monthKey = $_.Key
      monthLabel = Month-Label $_.Key
      registros = [Math]::Round([double]$bucket['count'], 2)
      pesoLiquidoKg = [Math]::Round([double]$bucket['pesoLiquidoKg'], 2)
      pesoBrutoKg = [Math]::Round([double]$bucket['pesoBrutoKg'], 2)
      taraKg = [Math]::Round([double]$bucket['taraKg'], 2)
    }
  } | Sort-Object { $_['monthKey'] }

  $faturamentoByProduct = $faturamentoProductMap.GetEnumerator() | ForEach-Object {
    $bucket = $_.Value
    [ordered]@{
      produto = $_.Key
      registros = [Math]::Round([double]$bucket['count'], 2)
      pesoLiquidoKg = [Math]::Round([double]$bucket['pesoLiquidoKg'], 2)
    }
  } | Sort-Object { $_['pesoLiquidoKg'] } -Descending

  $tipoFornecedor = @()
  for ($r = 2; $r -le $tipo.Rows; $r++) {
    $tipoFornecedor += [ordered]@{
      fornecedor = Convert-ToText (Get-Value $tipo.Values $r (Get-Index $tipoHeaders @('FORNECEDOR')))
      tipo = Convert-ToText (Get-Value $tipo.Values $r (Get-Index $tipoHeaders @('TIPO')))
      representante = Convert-ToText (Get-Value $tipo.Values $r (Get-Index $tipoHeaders @('REPRESENTANTE')))
      classificacao = Convert-ToText (Get-Value $tipo.Values $r (Get-Index $tipoHeaders @('CLASSIFICACAO')))
      origem = Convert-ToText (Get-Value $tipo.Values $r (Get-Index $tipoHeaders @('ORIGEM')))
    }
  }

  $precoFornecedor = @()
  $precoFornecedorIdx = Get-Index $precoHeaders @('FORNECEDOR')
  for ($r = 2; $r -le $preco.Rows; $r++) {
    $prices = @()
    for ($i = 1; $i -le 19; $i++) {
      $col = Get-Index $precoHeaders @("Preco Unit $i")
      $num = Convert-ToNumber (Get-Value $preco.Values $r $col)
      if ($num -gt 0) { $prices += $num }
    }
    $avg = if ($prices.Count) { ($prices | Measure-Object -Average).Average } else { 0 }
    $precoFornecedor += [ordered]@{
      fornecedor = Convert-ToText (Get-Value $preco.Values $r $precoFornecedorIdx)
      precoMedio = [Math]::Round($avg, 2)
      precoMin = if ($prices.Count) { [Math]::Round(($prices | Measure-Object -Minimum).Minimum, 2) } else { 0 }
      precoMax = if ($prices.Count) { [Math]::Round(($prices | Measure-Object -Maximum).Maximum, 2) } else { 0 }
      unidades = $prices.Count
    }
  }
  $precoFornecedor = $precoFornecedor | Sort-Object { $_['precoMedio'] } -Descending

  $entradaTotalPesoBruto = 0
  $entradaTotalPesoLiquido = 0
  $entradaTotalTara = 0
  $entradaTotalCachos = 0
  for ($r = 2; $r -le $entrada.Rows; $r++) {
    $entradaTotalPesoBruto += Convert-ToNumber (Get-Value $entrada.Values $r $entradaPesoBrutoIdx)
    $entradaTotalPesoLiquido += Convert-ToNumber (Get-Value $entrada.Values $r $entradaPesoLiquidoIdx)
    $entradaTotalTara += Convert-ToNumber (Get-Value $entrada.Values $r $entradaTaraIdx)
    $entradaTotalCachos += Convert-ToNumber (Get-Value $entrada.Values $r $entradaCachosIdx)
  }

  $faturamentoTotalPesoLiquido = 0
  $faturamentoTotalPesoBruto = 0
  $faturamentoTotalTara = 0
  for ($r = 2; $r -le $faturamento.Rows; $r++) {
    $faturamentoTotalPesoLiquido += Convert-ToNumber (Get-Value $faturamento.Values $r $fatPesoLiquidoIdx)
    $faturamentoTotalPesoBruto += Convert-ToNumber (Get-Value $faturamento.Values $r $fatPesoBrutoIdx)
    $faturamentoTotalTara += Convert-ToNumber (Get-Value $faturamento.Values $r $fatTaraIdx)
  }

  $snapshot = [ordered]@{
    generatedAt = (Get-Date).ToString('o')
    sourcePath = $WorkbookPath
    entradaDeCff = [ordered]@{
      totalRegistros = $entrada.Rows - 1
      totalPesoBrutoKg = [Math]::Round($entradaTotalPesoBruto, 2)
      totalPesoLiquidoKg = [Math]::Round($entradaTotalPesoLiquido, 2)
      totalTaraKg = [Math]::Round($entradaTotalTara, 2)
      totalCachos = [Math]::Round($entradaTotalCachos, 2)
      byMonth = $entradaByMonth
      byProduct = $entradaByProduct
    }
    cqoRampa = [ordered]@{
      totalRegistros = $rampa.Rows - 1
      byMonth = $rampaByMonth
      byFarm = $rampaByFarm
    }
    faturamento = [ordered]@{
      totalRegistros = $faturamento.Rows - 1
      totalPesoLiquidoKg = [Math]::Round($faturamentoTotalPesoLiquido, 2)
      totalPesoBrutoKg = [Math]::Round($faturamentoTotalPesoBruto, 2)
      totalTaraKg = [Math]::Round($faturamentoTotalTara, 2)
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

  $json = $snapshot | ConvertTo-Json -Depth 10
  [IO.File]::WriteAllText([IO.Path]::GetFullPath($OutputPath), $json, [Text.UTF8Encoding]::new($false))
}
finally {
  if ($wb) { $wb.Close($false) }
  if ($excel) { $excel.Quit() }
}
