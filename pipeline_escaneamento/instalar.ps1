# Instalador do Pipeline de Escaneamento (Windows 10/11, sem administrador sempre que possível)
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"   # download muito mais rápido no PowerShell 5
$Raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Raiz
$Log = Join-Path $Raiz "instalacao_log.txt"
Start-Transcript -Path $Log -Force | Out-Null

function Passo($t) { Write-Host ""; Write-Host ">>> $t" -ForegroundColor Cyan }
function Baixar($url, $destino) {
    Write-Host "    baixando: $url"
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $url -OutFile $destino -UseBasicParsing
    if (-not (Test-Path $destino) -or (Get-Item $destino).Length -lt 100000) { throw "Download incompleto: $url" }
}
function VerificarAssinatura($arquivo, $nomeEsperado) {
    $a = Get-AuthenticodeSignature $arquivo
    if ($a.Status -ne "Valid" -or $a.SignerCertificate.Subject -notmatch $nomeEsperado) {
        throw "Assinatura digital inválida em $arquivo (status: $($a.Status)). Não vou instalar por segurança."
    }
    Write-Host "    assinatura digital conferida: $($a.SignerCertificate.Subject)"
}

try {
    # ---------------------------------------------------------------- 1. Python
    Passo "1/5  Procurando o Python"
    $py = $null
    $local = Join-Path $Raiz "tools\python\python.exe"
    if (Test-Path $local) { $py = $local }
    if (-not $py) {
        foreach ($c in @("py -3", "python")) {
            try {
                $v = & cmd /c "$c --version 2>&1"
                if ($v -match "Python 3\.(\d+)" -and [int]$Matches[1] -ge 10 -and [int]$Matches[1] -le 13) {
                    $exe = & cmd /c "$c -c ""import sys;print(sys.executable)"""
                    if ($exe -and (Test-Path $exe.Trim())) { $py = $exe.Trim(); break }
                }
            } catch { }
        }
    }
    if (-not $py) {
        Passo "Python não encontrado. Baixando o Python 3.12 oficial (instala só para você, sem administrador)"
        New-Item -ItemType Directory -Force -Path (Join-Path $Raiz "tools") | Out-Null
        $inst = Join-Path $Raiz "tools\python-instalador.exe"
        Baixar "https://www.python.org/ftp/python/3.12.10/python-3.12.10-amd64.exe" $inst
        VerificarAssinatura $inst "Python Software Foundation"
        $alvo = Join-Path $Raiz "tools\python"
        $p = Start-Process -FilePath $inst -ArgumentList "/quiet InstallAllUsers=0 PrependPath=0 Include_launcher=0 Include_test=0 Include_doc=0 Shortcuts=0 TargetDir=`"$alvo`"" -Wait -PassThru
        if ($p.ExitCode -ne 0 -or -not (Test-Path (Join-Path $alvo "python.exe"))) { throw "A instalação do Python falhou (código $($p.ExitCode))." }
        Remove-Item $inst -Force
        $py = Join-Path $alvo "python.exe"
    }
    Write-Host "    usando: $py"

    # ---------------------------------------------------------------- 2. ambiente virtual e pacotes
    Passo "2/5  Criando o ambiente e instalando os pacotes (pode demorar uns minutos)"
    $venv = Join-Path $Raiz ".venv"
    if (-not (Test-Path (Join-Path $venv "Scripts\python.exe"))) { & $py -m venv $venv; if ($LASTEXITCODE -ne 0) { throw "Não consegui criar o ambiente virtual." } }
    $vpy = Join-Path $venv "Scripts\python.exe"
    & $vpy -m pip install --upgrade pip --quiet
    & $vpy -m pip install -r (Join-Path $Raiz "requirements.txt")
    if ($LASTEXITCODE -ne 0) { throw "Falha ao instalar os pacotes Python." }

    # ---------------------------------------------------------------- 3. Tesseract (motor de OCR principal)
    Passo "3/5  Procurando/instalando o Tesseract (leitor de texto - OCR)"
    $tess = $null
    $cands = @((Join-Path $Raiz "tools\tesseract\tesseract.exe"),
               "$env:ProgramFiles\Tesseract-OCR\tesseract.exe",
               "${env:ProgramFiles(x86)}\Tesseract-OCR\tesseract.exe",
               "$env:LOCALAPPDATA\Programs\Tesseract-OCR\tesseract.exe")
    foreach ($c in $cands) { if (Test-Path $c) { $tess = $c; break } }
    if (-not $tess) {
        try {
            New-Item -ItemType Directory -Force -Path (Join-Path $Raiz "tools") | Out-Null
            $ti = Join-Path $Raiz "tools\tesseract-instalador.exe"
            Baixar "https://github.com/UB-Mannheim/tesseract/releases/download/v5.5.0.20241111/tesseract-ocr-w64-setup-5.5.0.20241111.exe" $ti
            $alvoT = Join-Path $Raiz "tools\tesseract"
            Write-Host "    Se o Windows pedir permissão, clique em SIM."
            $p = Start-Process -FilePath $ti -ArgumentList "/S /D=$alvoT" -Wait -PassThru
            Remove-Item $ti -Force -ErrorAction SilentlyContinue
            if (Test-Path (Join-Path $alvoT "tesseract.exe")) { $tess = Join-Path $alvoT "tesseract.exe" }
        } catch { Write-Host "    Não consegui instalar o Tesseract pelo instalador direto: $($_.Exception.Message)" -ForegroundColor Yellow }
    }
    if (-not $tess) {
        try {
            Write-Host "    Tentando pelo winget (gerenciador de pacotes do Windows)..."
            & winget install --id UB-Mannheim.TesseractOCR -e --silent --accept-package-agreements --accept-source-agreements
            foreach ($c in $cands) { if (Test-Path $c) { $tess = $c; break } }
        } catch { Write-Host "    winget indisponível." -ForegroundColor Yellow }
    }
    if ($tess) {
        $tessdir = Join-Path $Raiz "tools\tessdata"
        New-Item -ItemType Directory -Force -Path $tessdir | Out-Null
        $porLocal = Join-Path $tessdir "por.traineddata"
        $dirTess = Split-Path -Parent $tess
        $porInst = Join-Path $dirTess "tessdata\por.traineddata"
        if (-not (Test-Path $porLocal)) {
            if (Test-Path $porInst) { Copy-Item $porInst $porLocal }
            else {
                try { Baixar "https://github.com/tesseract-ocr/tessdata_fast/raw/main/por.traineddata" $porLocal } catch { Write-Host "    Não consegui baixar o idioma português: $($_.Exception.Message)" -ForegroundColor Yellow }
            }
        }
        foreach ($extra in @("osd.traineddata")) {
            $o = Join-Path $dirTess "tessdata\$extra"
            if ((Test-Path $o) -and -not (Test-Path (Join-Path $tessdir $extra))) { Copy-Item $o (Join-Path $tessdir $extra) }
        }
        if (-not (Test-Path $porLocal)) { Write-Host "    Sem o idioma português no Tesseract: usarei o motor reserva (RapidOCR)." -ForegroundColor Yellow; $tess = $null }
    }
    if ($tess) { Write-Host "    Tesseract pronto: $tess" } else { Write-Host "    Tesseract indisponível: o motor reserva RapidOCR será usado (funciona, mas é mais lento e perde acentos no texto pesquisável)." -ForegroundColor Yellow }

    # ---------------------------------------------------------------- 4. pastas
    Passo "4/5  Criando as pastas de trabalho"
    $cfgTxt = Get-Content (Join-Path $Raiz "config\config.yaml") -Raw -Encoding UTF8
    $ent = [regex]::Match($cfgTxt, '(?m)^entrada:\s*"([^"]+)"').Groups[1].Value -replace '\\\\', '\'
    $sai = [regex]::Match($cfgTxt, '(?m)^saida:\s*"([^"]+)"').Groups[1].Value -replace '\\\\', '\'
    foreach ($d in @($ent, $sai)) { if ($d) { try { New-Item -ItemType Directory -Force -Path $d | Out-Null; Write-Host "    pasta: $d" } catch { Write-Host "    não consegui criar $d (ajuste em config\config.yaml)" -ForegroundColor Yellow } } }

    # ---------------------------------------------------------------- 5. autoteste
    Passo "5/5  Testando se tudo funciona (documentos fictícios)"
    $env:PYTHONPATH = Join-Path $Raiz "src"
    & $vpy -m pipeline --autoteste
    if ($LASTEXITCODE -ne 0) { throw "O autoteste não passou. Veja instalacao_log.txt." }
    Set-Content -Path (Join-Path $Raiz "INSTALACAO_OK.txt") -Value "Instalado em $(Get-Date)" -Encoding UTF8
    Write-Host ""
    Write-Host "TUDO PRONTO." -ForegroundColor Green
    Stop-Transcript | Out-Null
    exit 0
} catch {
    Write-Host ""
    Write-Host "ERRO: $($_.Exception.Message)" -ForegroundColor Red
    Stop-Transcript | Out-Null
    exit 1
}
