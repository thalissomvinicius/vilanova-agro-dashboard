[CmdletBinding()]
param(
    [string[]]$Path,
    [string]$SupabaseUrl = $(if ($env:VNA_SUPABASE_URL) { $env:VNA_SUPABASE_URL } else { $env:SUPABASE_URL }),
    [string]$ServiceRoleKey = $(if ($env:VNA_SUPABASE_SERVICE_ROLE_KEY) { $env:VNA_SUPABASE_SERVICE_ROLE_KEY } else { $env:SUPABASE_SERVICE_ROLE_KEY }),
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$CompanyFarms = @('FE EM DEUS', 'NOVA CONCEICAO', 'VILA NOVA')

function Convert-ToAsciiKey([object]$Value) {
    if ($null -eq $Value) { return '' }
    $text = ([string]$Value).Trim().ToUpperInvariant().Normalize([Text.NormalizationForm]::FormD)
    $builder = [Text.StringBuilder]::new()
    foreach ($character in $text.ToCharArray()) {
        if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($character) -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
            [void]$builder.Append($character)
        }
    }
    return (($builder.ToString().Normalize([Text.NormalizationForm]::FormC) -replace [char]0x00A0, ' ') -replace '\s+', ' ').Trim()
}

function Convert-ToNumber([object]$Value) {
    if ($null -eq $Value -or $Value -eq '') { return 0.0 }
    if ($Value -is [double] -or $Value -is [int] -or $Value -is [decimal] -or $Value -is [long]) {
        return [double]$Value
    }
    $number = 0.0
    if ([double]::TryParse([string]$Value, [Globalization.NumberStyles]::Any, [Globalization.CultureInfo]::GetCultureInfo('pt-BR'), [ref]$number)) {
        return $number
    }
    if ([double]::TryParse([string]$Value, [Globalization.NumberStyles]::Any, [Globalization.CultureInfo]::InvariantCulture, [ref]$number)) {
        return $number
    }
    return 0.0
}

function Convert-ExcelDate([object]$Value) {
    if ($null -eq $Value -or $Value -eq '') { return $null }
    if ($Value -is [double] -or $Value -is [int] -or $Value -is [decimal]) {
        return [datetime]::FromOADate([double]$Value)
    }
    $parsed = [datetime]::MinValue
    if ([datetime]::TryParse([string]$Value, [ref]$parsed)) { return $parsed }
    return $null
}

function New-Aggregate {
    return [ordered]@{
        rows = 0
        pesoLiquidoKg = 0.0
        cachos = 0.0
        rowsWithoutBunches = 0
        minDate = $null
        maxDate = $null
    }
}

function Add-Aggregate([hashtable]$Map, [string]$Key, [double]$WeightKg, [double]$Bunches, [datetime]$Date) {
    if (-not $Map.ContainsKey($Key)) { $Map[$Key] = New-Aggregate }
    $aggregate = $Map[$Key]
    $aggregate.rows++
    $aggregate.pesoLiquidoKg += $WeightKg
    $aggregate.cachos += $Bunches
    if ($Bunches -le 0) { $aggregate.rowsWithoutBunches++ }
    if ($Date) {
        if (-not $aggregate.minDate -or $Date -lt $aggregate.minDate) { $aggregate.minDate = $Date }
        if (-not $aggregate.maxDate -or $Date -gt $aggregate.maxDate) { $aggregate.maxDate = $Date }
    }
}

function Get-WorkbookPaths {
    if ($Path -and $Path.Count -gt 0) {
        return @($Path | ForEach-Object { (Resolve-Path -LiteralPath $_).Path } | Sort-Object -Unique)
    }
    if (-not (Test-Path -LiteralPath 'E:\')) {
        throw 'Disco E: nao encontrado. Informe -Path com o arquivo .XLS/.XLSX.'
    }

    $defaultFolder = Get-ChildItem -LiteralPath 'E:\' -Directory -Recurse -ErrorAction SilentlyContinue |
        Where-Object { (Convert-ToAsciiKey $_.Name) -eq 'BALANCA - PESAGEM TUDO' } |
        Select-Object -First 1
    if (-not $defaultFolder) {
        throw 'Pasta BALANCA - PESAGEM TUDO nao encontrada no disco E:. Informe -Path manualmente.'
    }

    $files = @(Get-ChildItem -LiteralPath $defaultFolder.FullName -File | Where-Object { $_.Extension -match '^\.xlsx?$' } | Sort-Object Name)
    if ($files.Count -eq 0) { throw "Nenhum arquivo .XLS ou .XLSX encontrado em $($defaultFolder.FullName)." }
    return @($files.FullName)
}

function Convert-AggregateToRow([string]$Key, [System.Collections.IDictionary]$Aggregate) {
    $average = if ($Aggregate.cachos -gt 0) { $Aggregate.pesoLiquidoKg / $Aggregate.cachos } else { 0.0 }
    return [pscustomobject][ordered]@{
        key = $Key
        rows = $Aggregate.rows
        pesoLiquidoKg = [math]::Round($Aggregate.pesoLiquidoKg, 3)
        pesoT = [math]::Round($Aggregate.pesoLiquidoKg / 1000, 6)
        cachos = [math]::Round($Aggregate.cachos, 0)
        averageBunchKg = [math]::Round($average, 6)
        rowsWithoutBunches = $Aggregate.rowsWithoutBunches
        minDate = if ($Aggregate.minDate) { $Aggregate.minDate.ToString('yyyy-MM-dd') } else { $null }
        maxDate = if ($Aggregate.maxDate) { $Aggregate.maxDate.ToString('yyyy-MM-dd') } else { $null }
    }
}

function Convert-MapToRows([hashtable]$Map) {
    return @($Map.Keys | Sort-Object | ForEach-Object { Convert-AggregateToRow $_ $Map[$_] })
}

function Read-BalanceWorkbook([string]$WorkbookPath, [hashtable]$State) {
    $excel = $null
    $book = $null
    try {
        Write-Host "Lendo $WorkbookPath ..."
        $excel = New-Object -ComObject Excel.Application
        $excel.Visible = $false
        $excel.DisplayAlerts = $false
        $excel.AskToUpdateLinks = $false
        $excel.AutomationSecurity = 3
        $book = $excel.Workbooks.Open($WorkbookPath, 0, $true)
        $sheet = $book.Worksheets.Item('Entrada')
        $lastRow = $sheet.UsedRange.Row + $sheet.UsedRange.Rows.Count - 1
        if ($lastRow -lt 5) { return }
        $data = $sheet.Range("B4:AB$lastRow").Value2

        $headers = @{}
        for ($column = 1; $column -le $data.GetLength(1); $column++) {
            $headers[(Convert-ToAsciiKey $data[1, $column])] = $column
        }
        foreach ($required in @('PRODUTO', 'DATA ENTRADA', 'CACHOS', 'LIQUIDO', 'ORIGEM')) {
            if (-not $headers.ContainsKey($required)) { throw "Coluna obrigatoria ausente em ${WorkbookPath}: $required" }
        }

        for ($row = 2; $row -le $data.GetLength(0); $row++) {
            $product = Convert-ToAsciiKey $data[$row, $headers['PRODUTO']]
            if (-not $product.StartsWith('CFF')) { continue }
            $entryDate = Convert-ExcelDate $data[$row, $headers['DATA ENTRADA']]
            if (-not $entryDate) { continue }
            $farm = Convert-ToAsciiKey $data[$row, $headers['ORIGEM']]
            $weightKg = Convert-ToNumber $data[$row, $headers['LIQUIDO']]
            $bunches = Convert-ToNumber $data[$row, $headers['CACHOS']]
            $monthKey = $entryDate.ToString('yyyy-MM')
            $dayKey = $entryDate.ToString('yyyy-MM-dd')
            $cycle = if ($entryDate.Day -le 15) { 1 } else { 2 }

            Add-Aggregate $State.weightByMonth $monthKey $weightKg $bunches $entryDate
            if ($CompanyFarms -notcontains $farm) { continue }

            Add-Aggregate $State.productionByMonth $monthKey $weightKg $bunches $entryDate
            Add-Aggregate $State.productionByFarm $farm $weightKg $bunches $entryDate
            Add-Aggregate $State.productionByFarmMonth "$farm|$monthKey" $weightKg $bunches $entryDate
            Add-Aggregate $State.productionByFarmDay "$farm|$dayKey" $weightKg $bunches $entryDate
            Add-Aggregate $State.productionByFarmCycle "$farm|$monthKey|C$cycle" $weightKg $bunches $entryDate
            $State.totalRows++
        }
    }
    finally {
        if ($book) { $book.Close($false) }
        if ($excel) { $excel.Quit() }
        if ($book) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($book) }
        if ($excel) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($excel) }
        [GC]::Collect()
        [GC]::WaitForPendingFinalizers()
    }
}

$workbooks = @(Get-WorkbookPaths)
$state = @{
    weightByMonth = @{}
    productionByMonth = @{}
    productionByFarm = @{}
    productionByFarmMonth = @{}
    productionByFarmDay = @{}
    productionByFarmCycle = @{}
    totalRows = 0
}

foreach ($workbook in $workbooks) { Read-BalanceWorkbook $workbook $state }
if ($state.totalRows -le 0) { throw 'Nenhuma pesagem CFF das fazendas da empresa foi encontrada.' }

$now = Get-Date
$weightRows = @(Convert-MapToRows $state.weightByMonth | ForEach-Object {
    [pscustomobject][ordered]@{
        monthKey = $_.key
        monthLabel = [datetime]::ParseExact("$($_.key)-01", 'yyyy-MM-dd', $null).ToString('MM/yyyy')
        rows = $_.rows
        pesoLiquidoKg = $_.pesoLiquidoKg
        pesoT = $_.pesoT
        cachos = $_.cachos
        averageBunchKg = $_.averageBunchKg
        rowsWithoutBunches = $_.rowsWithoutBunches
        minDate = $_.minDate
        maxDate = $_.maxDate
        complete = $_.key -lt $now.ToString('yyyy-MM')
    }
})

function Add-ProductionDimensions([object[]]$Rows, [string[]]$Parts) {
    return @($Rows | ForEach-Object {
        $values = $_.key -split '\|'
        $result = [ordered]@{}
        for ($index = 0; $index -lt $Parts.Count; $index++) { $result[$Parts[$index]] = $values[$index] }
        foreach ($property in $_.PSObject.Properties) {
            if ($property.Name -ne 'key') { $result[$property.Name] = $property.Value }
        }
        [pscustomobject]$result
    })
}

$productionByMonth = @(Add-ProductionDimensions @(Convert-MapToRows $state.productionByMonth) @('monthKey'))
$productionByFarm = @(Add-ProductionDimensions @(Convert-MapToRows $state.productionByFarm) @('fazenda'))
$productionByFarmMonth = @(Add-ProductionDimensions @(Convert-MapToRows $state.productionByFarmMonth) @('fazenda', 'monthKey'))
$productionByFarmDay = @(Add-ProductionDimensions @(Convert-MapToRows $state.productionByFarmDay) @('fazenda', 'dateKey'))
$productionByFarmCycle = @(Add-ProductionDimensions @(Convert-MapToRows $state.productionByFarmCycle) @('fazenda', 'monthKey', 'cycle'))

$fileInfo = @($workbooks | ForEach-Object {
    $item = Get-Item -LiteralPath $_
    [ordered]@{
        name = $item.Name
        path = $item.FullName
        hash = (Get-FileHash -LiteralPath $item.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        lastWriteTime = $item.LastWriteTimeUtc.ToString('o')
        sizeBytes = $item.Length
    }
})
$combinedHashInput = ($fileInfo | ForEach-Object { $_.hash }) -join '|'
$sha = [Security.Cryptography.SHA256]::Create()
$combinedHash = ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($combinedHashInput))) -replace '-', '').ToLowerInvariant()
$sha.Dispose()

$snapshot = [ordered]@{
    metadata = [ordered]@{
        formulaVersion = 'perdas-v2'
        importedAt = [datetime]::UtcNow.ToString('o')
        sourceFiles = @($fileInfo.name)
        sourceHashes = @($fileInfo.hash)
        productScope = 'CFF*'
        companyFarms = $CompanyFarms
        weightRule = 'peso medio do mes completo anterior'
    }
    pesoMedioCacho = [ordered]@{ byMonth = $weightRows }
    producao = [ordered]@{
        byMonth = $productionByMonth
        byFarm = $productionByFarm
        byFarmMonth = $productionByFarmMonth
        byFarmDay = $productionByFarmDay
        byFarmCycle = $productionByFarmCycle
    }
}

$validation = [ordered]@{
    sourceFiles = $fileInfo.Count
    companyCffRows = $state.totalRows
    weightMonths = $weightRows.Count
    productionMonths = $productionByMonth.Count
    farms = $productionByFarm.Count
    rowsWithoutBunches = [int](($state.weightByMonth.Values | ForEach-Object { $_.rowsWithoutBunches } | Measure-Object -Sum).Sum)
}

$payload = @([ordered]@{
    import_key = 'balanca_perdas_agricolas'
    source_file = ($fileInfo.name -join '; ')
    source_path = ($fileInfo.path -join '; ')
    source_hash = $combinedHash
    file_last_write_time = ($fileInfo | Sort-Object lastWriteTime -Descending | Select-Object -First 1).lastWriteTime
    total_rows = $state.totalRows
    snapshot_json = $snapshot
    validation_json = $validation
    imported_at = [datetime]::UtcNow.ToString('o')
    updated_at = [datetime]::UtcNow.ToString('o')
})

Write-Host ("Consolidado: {0} arquivo(s), {1} pesagens da empresa, {2} mes(es) de peso." -f $fileInfo.Count, $state.totalRows, $weightRows.Count)
if ($DryRun) {
    ConvertTo-Json -InputObject $payload -Depth 20
    exit 0
}

if (-not $SupabaseUrl) { throw 'Defina VNA_SUPABASE_URL ou SUPABASE_URL antes de executar.' }
if (-not $ServiceRoleKey) { throw 'Defina VNA_SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_SERVICE_ROLE_KEY antes de executar.' }

$headers = @{
    apikey = $ServiceRoleKey
    Authorization = "Bearer $ServiceRoleKey"
    Prefer = 'resolution=merge-duplicates,return=minimal'
    'Content-Type' = 'application/json; charset=utf-8'
}
$endpoint = "$($SupabaseUrl.TrimEnd('/'))/rest/v1/balanca_import_snapshots?on_conflict=import_key"
$body = ConvertTo-Json -InputObject $payload -Depth 20 -Compress
Invoke-RestMethod -Method Post -Uri $endpoint -Headers $headers -Body ([Text.Encoding]::UTF8.GetBytes($body)) | Out-Null
Write-Host 'Snapshot da balanca publicado no Supabase com sucesso.' -ForegroundColor Green
