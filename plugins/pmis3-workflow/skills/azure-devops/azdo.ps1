#Requires -Version 5.1
<#
.SYNOPSIS
    Helper Azure DevOps Server (on-prem) cho Claude Code.

.DESCRIPTION
    Xác thực bằng Windows Integrated Auth (Negotiate) qua curl.exe -> KHÔNG cần PAT,
    không lưu secret. Chạy bằng đúng quyền của tài khoản Windows đang đăng nhập.

    Mọi thao tác GHI (comment / đổi state) đều đòi cờ -Yes.

    ID work item là duy nhất trong cả collection, nên show/state/finish gọi ở cấp
    collection và tự lấy project từ chính work item -> dùng được cho mọi project
    (PMIS3-NGUON, CSDLMT, PMIS3-OMS...) từ bất kỳ repo nào.

.EXAMPLE
    .\azdo.ps1 whoami
    .\azdo.ps1 mine                    # việc trong project của repo hiện tại
    .\azdo.ps1 mine -All               # việc ở TẤT CẢ project trong collection
    .\azdo.ps1 show 12345
    .\azdo.ps1 states Bug -Project CSDLMT
    .\azdo.ps1 comment 12345 "Đã sửa ở commit abc123" -Yes
    .\azdo.ps1 state 12345 "Committed" -Yes
    .\azdo.ps1 finish 12345            # chạy khô, chỉ in ra dự định
    .\azdo.ps1 finish 12345 -Yes       # thực thi
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet('whoami', 'mine', 'show', 'states', 'comment', 'state', 'finish')]
    [string]$Command,

    [Parameter(Position = 1)]
    [string]$Arg1,

    [Parameter(Position = 2)]
    [string]$Arg2,

    [string]$Project,

    [switch]$All,

    [switch]$CrossProject,

    [switch]$Yes
)

$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------- hạ tầng ----

# ConvertFrom-Json của PowerShell 5.1 chết trên payload lớn / có key rỗng của
# Azure DevOps. JavaScriptSerializer xử lý được cả hai, trả về Dictionary lồng nhau.
function ConvertFrom-JsonSafe {
    param([string]$Json)
    if ([string]::IsNullOrWhiteSpace($Json)) { return $null }
    Add-Type -AssemblyName System.Web.Extensions -ErrorAction SilentlyContinue
    $ser = New-Object System.Web.Script.Serialization.JavaScriptSerializer
    $ser.MaxJsonLength = [int]::MaxValue
    $ser.RecursionLimit = 1000
    return $ser.DeserializeObject($Json)
}

function ConvertTo-JsonSafe {
    param($Value)
    Add-Type -AssemblyName System.Web.Extensions -ErrorAction SilentlyContinue
    $ser = New-Object System.Web.Script.Serialization.JavaScriptSerializer
    $ser.MaxJsonLength = [int]::MaxValue
    return $ser.Serialize($Value)
}

function Get-Val {
    param($Dict, [string]$Key, $Default = $null)
    if ($null -eq $Dict) { return $Default }
    # Dictionary<string,object> của JavaScriptSerializer: dùng ContainsKey,
    # KHÔNG dùng Contains (bản generic nhận KeyValuePair chứ không nhận string).
    if ($Dict -is [System.Collections.IDictionary] -and $Dict.ContainsKey($Key)) {
        $v = $Dict[$Key]
        if ($null -eq $v) { return $Default }
        return $v
    }
    return $Default
}

function Read-AdoConfig {
    $path = Join-Path $PSScriptRoot 'azdo.config.json'
    if (-not (Test-Path $path)) { throw "Không tìm thấy config: $path" }
    return ConvertFrom-JsonSafe ([System.IO.File]::ReadAllText($path))
}

function Invoke-Ado {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [string]$Method = 'GET',
        [string]$Body,
        [string]$ContentType = 'application/json'
    )
    $outFile = [System.IO.Path]::GetTempFileName()
    $bodyFile = $null
    $curlArgs = @(
        '-s', '--negotiate', '-u', ':',
        '-o', $outFile, '-w', '%{http_code}',
        '-X', $Method,
        '-H', 'Accept: application/json'
    )
    if ($PSBoundParameters.ContainsKey('Body') -and $Body) {
        $bodyFile = [System.IO.Path]::GetTempFileName()
        # UTF-8 KHÔNG BOM: BOM lọt vào body sẽ làm Azure DevOps từ chối JSON.
        [System.IO.File]::WriteAllText($bodyFile, $Body, (New-Object System.Text.UTF8Encoding($false)))
        $curlArgs += @('-H', "Content-Type: $ContentType", '--data-binary', "@$bodyFile")
    }
    $curlArgs += $Url

    try {
        $code = (& curl.exe @curlArgs) -join ''
        $raw = if (Test-Path $outFile) { [System.IO.File]::ReadAllText($outFile) } else { '' }
    }
    finally {
        Remove-Item $outFile -Force -ErrorAction SilentlyContinue
        if ($bodyFile) { Remove-Item $bodyFile -Force -ErrorAction SilentlyContinue }
    }

    if ($code -notmatch '^2\d\d$') {
        $msg = $raw
        $err = ConvertFrom-JsonSafe $raw
        if ($err) { $msg = Get-Val $err 'message' $raw }
        throw "Azure DevOps trả về HTTP $code : $msg"
    }
    return $raw
}

function ConvertFrom-Html {
    param([string]$Html)
    if ([string]::IsNullOrWhiteSpace($Html)) { return '' }
    $t = $Html
    $t = [regex]::Replace($t, '(?is)<(script|style).*?</\1>', '')
    $t = [regex]::Replace($t, '(?i)<br\s*/?>', "`n")
    $t = [regex]::Replace($t, '(?i)<li[^>]*>', "`n  - ")
    $t = [regex]::Replace($t, '(?i)</(p|div|tr|li|h[1-6]|ul|ol)>', "`n")
    $t = [regex]::Replace($t, '(?i)</t[dh]>', "  |  ")
    $t = [regex]::Replace($t, '<[^>]+>', '')
    $t = [System.Net.WebUtility]::HtmlDecode($t)
    $t = $t -replace "`r", ''
    $t = [regex]::Replace($t, "[ \t]+`n", "`n")
    $t = [regex]::Replace($t, "`n{3,}", "`n`n")
    return $t.Trim()
}

function Format-AdoDate {
    param([string]$Iso)
    if ([string]::IsNullOrWhiteSpace($Iso)) { return '—' }
    try { return ([datetime]$Iso).ToString('dd/MM/yyyy HH:mm') } catch { return $Iso }
}

function Format-Identity {
    param($Value)
    if ($null -eq $Value) { return '—' }
    if ($Value -is [System.Collections.IDictionary]) {
        # work item dùng displayName; connectionData của on-prem dùng providerDisplayName.
        foreach ($k in @('displayName', 'providerDisplayName', 'customDisplayName', 'uniqueName')) {
            $v = Get-Val $Value $k
            if ($v) { return [string]$v }
        }
        return '—'
    }
    return [string]$Value
}

# Project của repo hiện tại, lấy từ git remote: .../{Collection}/{Project}/_git/{Repo}
function Resolve-AdoProject {
    param($Cfg, [string]$Override)
    if ($Override) { return $Override }
    $remote = ''
    try { $remote = (& git config --get remote.origin.url) -join '' } catch { }
    if ($remote -match '/([^/]+)/_git/') {
        return [uri]::UnescapeDataString($Matches[1])
    }
    return (Get-Val $Cfg 'defaultProject')
}

function Test-BranchPushed {
    $result = @{ Ok = $false; Reason = ''; Branch = '' }
    try {
        $branch = ((& git rev-parse --abbrev-ref HEAD) -join '').Trim()
        $result.Branch = $branch
        $upstream = ((& git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>$null) -join '').Trim()
        if (-not $upstream) {
            $result.Reason = "nhánh '$branch' chưa có upstream (chưa push lần nào)"
            return $result
        }
        $ahead = ((& git rev-list --count "$upstream..HEAD") -join '').Trim()
        if ([int]$ahead -gt 0) {
            $result.Reason = "còn $ahead commit chưa push trên nhánh '$branch'"
            return $result
        }
        $result.Ok = $true
        $result.Reason = "nhánh '$branch' đã push đầy đủ lên $upstream"
    }
    catch {
        $result.Reason = "không kiểm tra được trạng thái git: $($_.Exception.Message)"
    }
    return $result
}

# ------------------------------------------------------------ ngữ cảnh ------

$cfg = Read-AdoConfig
$collection = (Get-Val $cfg 'collectionUrl').TrimEnd('/')
$apiVer = Get-Val $cfg 'apiVersion' '6.0'
$repoProject = Resolve-AdoProject $cfg $Project

function Get-ProjectUrl {
    param([string]$Name)
    return "$collection/$([uri]::EscapeDataString($Name))"
}

# Gọi ở cấp collection: ID work item là duy nhất toàn collection.
function Get-WorkItem {
    param([string]$Id, [switch]$WithRelations)
    $url = "$collection/_apis/wit/workitems/$Id" + '?api-version=' + $apiVer
    if ($WithRelations) {
        $url = "$collection/_apis/wit/workitems/$Id" + '?$expand=relations&api-version=' + $apiVer
    }
    return ConvertFrom-JsonSafe (Invoke-Ado -Url $url)
}

function Get-TypeStates {
    param([string]$ProjectName, [string]$TypeName)
    $url = (Get-ProjectUrl $ProjectName) +
    "/_apis/wit/workitemtypes/$([uri]::EscapeDataString($TypeName))/states?api-version=$apiVer"
    $res = ConvertFrom-JsonSafe (Invoke-Ado -Url $url)
    return (Get-Val $res 'value' @())
}

function Set-WorkItemField {
    param([string]$Id, [string]$Field, [string]$Value)
    $patch = @(@{ op = 'add'; path = "/fields/$Field"; value = $Value })
    $url = "$collection/_apis/wit/workitems/$Id" + '?api-version=' + $apiVer
    return ConvertFrom-JsonSafe (Invoke-Ado -Url $url -Method 'PATCH' `
            -Body (ConvertTo-JsonSafe $patch) -ContentType 'application/json-patch+json')
}

function Show-StateMenu {
    param([string]$ProjectName, [string]$TypeName, [string]$Current = '')
    Write-Output ""
    Write-Output "Các state hợp lệ của '$TypeName' (project $ProjectName):"
    $i = 1
    foreach ($s in (Get-TypeStates -ProjectName $ProjectName -TypeName $TypeName)) {
        $name = Get-Val $s 'name'
        $cat = Get-Val $s 'category'
        $mark = if ($name -eq $Current) { '   <-- hiện tại' } else { '' }
        Write-Output ("  {0,2}. {1,-16} [{2}]{3}" -f $i, $name, $cat, $mark)
        $i++
    }
    Write-Output ""
}

# Repo nào thì làm việc với project của repo đó. Work item của project khác:
# đọc thì cảnh báo, GHI thì chặn (trừ khi có -CrossProject).
function Test-ProjectScope {
    param(
        [string]$ItemProject,
        [string]$Id,
        [switch]$IsWrite
    )
    # Thông báo BẮT BUỘC đi qua Write-Warning, KHÔNG dùng Write-Output: output của hàm
    # bị gộp vào giá trị trả về, khiến `if (-not (Test-ProjectScope ...))` nhận về mảng
    # (luôn truthy) và guard mất tác dụng.
    if ($ItemProject -eq $repoProject) { return $true }
    Write-Warning "#$Id thuộc project '$ItemProject', nhưng repo hiện tại thuộc '$repoProject'."
    if ($CrossProject) {
        Write-Warning "Bỏ qua kiểm tra vì có cờ -CrossProject."
        return $true
    }
    if ($IsWrite) {
        Write-Warning "DỪNG: không ghi sang project khác từ repo này."
        Write-Warning "Mở repo thuộc project '$ItemProject' rồi chạy lại. Nếu chắc chắn đúng thì thêm cờ -CrossProject."
        return $false
    }
    Write-Warning "Chỉ đọc nên vẫn hiển thị — nhưng kiểm tra lại xem có đang mở nhầm repo không."
    return $true
}

function Invoke-Wiql {
    param([string]$Query, [string]$ProjectName)
    $url = if ($ProjectName) { (Get-ProjectUrl $ProjectName) + "/_apis/wit/wiql?api-version=$apiVer" }
    else { "$collection/_apis/wit/wiql?api-version=$apiVer" }
    $res = ConvertFrom-JsonSafe (Invoke-Ado -Url $url -Method 'POST' -Body (ConvertTo-JsonSafe @{ query = $Query }))
    $ids = @()
    foreach ($w in (Get-Val $res 'workItems' @())) { $ids += (Get-Val $w 'id') }
    return $ids
}

# ----------------------------------------------------------------- lệnh -----

switch ($Command) {

    'whoami' {
        # connectionData là resource preview -> phải dùng api-version riêng.
        $cdApi = Get-Val $cfg 'connectionDataApiVersion' '6.0-preview'
        $res = ConvertFrom-JsonSafe (Invoke-Ado -Url "$collection/_apis/connectionData?api-version=$cdApi")
        Write-Output "Collection    : $collection"
        Write-Output "Project (repo): $repoProject"
        Write-Output "Đăng nhập     : $(Format-Identity (Get-Val $res 'authenticatedUser'))"
    }

    'mine' {
        $closed = (Get-Val $cfg 'closedStates' @()) | ForEach-Object { "'$_'" }
        $where = "[System.AssignedTo] = @Me AND [System.State] NOT IN ($($closed -join ','))"
        if ($All) {
            $wiql = "SELECT [System.Id] FROM WorkItems WHERE $where ORDER BY [System.ChangedDate] DESC"
            $ids = Invoke-Wiql -Query $wiql
            $scope = "TẤT CẢ project trong collection"
        }
        else {
            $wiql = "SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project AND $where ORDER BY [System.ChangedDate] DESC"
            $ids = Invoke-Wiql -Query $wiql -ProjectName $repoProject
            $scope = "project '$repoProject'"
        }

        if ($ids.Count -eq 0) {
            Write-Output "Không có work item nào đang gán cho bạn ở $scope."
            break
        }
        $total = $ids.Count
        $ids = $ids | Select-Object -First 200

        Write-Output "Work item đang gán cho bạn — $scope (hiện $($ids.Count)/$total):"
        Write-Output ""
        Write-Output ("{0,-8} {1,-14} {2,-22} {3,-14} {4}" -f 'ID', 'PROJECT', 'TYPE', 'STATE', 'TITLE')
        Write-Output ("-" * 118)

        $fields = 'System.Id,System.TeamProject,System.WorkItemType,System.Title,System.State'
        # API giới hạn 200 id mỗi lần gọi.
        for ($i = 0; $i -lt $ids.Count; $i += 200) {
            $chunk = $ids[$i..([Math]::Min($i + 199, $ids.Count - 1))]
            $url = "$collection/_apis/wit/workitems?ids=$($chunk -join ',')&fields=$fields&api-version=$apiVer"
            $items = ConvertFrom-JsonSafe (Invoke-Ado -Url $url)
            foreach ($it in (Get-Val $items 'value' @())) {
                $f = Get-Val $it 'fields'
                Write-Output ("{0,-8} {1,-14} {2,-22} {3,-14} {4}" -f `
                    (Get-Val $it 'id'),
                    (Get-Val $f 'System.TeamProject'),
                    (Get-Val $f 'System.WorkItemType'),
                    (Get-Val $f 'System.State'),
                    (Get-Val $f 'System.Title'))
            }
        }
        if (-not $All) {
            Write-Output ""
            Write-Output "(chỉ project của repo này — thêm -All để xem mọi project)"
        }
    }

    'show' {
        if (-not $Arg1) { throw "Thiếu ID work item. Ví dụ: .\azdo.ps1 show 12345" }
        $wi = Get-WorkItem -Id $Arg1 -WithRelations
        $f = Get-Val $wi 'fields'
        $type = Get-Val $f 'System.WorkItemType'
        $itemProject = Get-Val $f 'System.TeamProject' $repoProject
        [void](Test-ProjectScope -ItemProject $itemProject -Id $Arg1)

        Write-Output "=============================================================="
        Write-Output "#$(Get-Val $wi 'id')  [$type]  $(Get-Val $f 'System.Title')"
        Write-Output "=============================================================="
        Write-Output "Project     : $itemProject"
        Write-Output "State       : $(Get-Val $f 'System.State')"
        Write-Output "Assigned    : $(Format-Identity (Get-Val $f 'System.AssignedTo'))"
        Write-Output "Tạo bởi     : $(Format-Identity (Get-Val $f 'System.CreatedBy'))  lúc $(Format-AdoDate (Get-Val $f 'System.CreatedDate'))"
        Write-Output "Sửa lần cuối: $(Format-AdoDate (Get-Val $f 'System.ChangedDate'))"
        Write-Output "Iteration   : $(Get-Val $f 'System.IterationPath' '—')"
        Write-Output "Area        : $(Get-Val $f 'System.AreaPath' '—')"
        $tags = Get-Val $f 'System.Tags'
        if ($tags) { Write-Output "Tags        : $tags" }
        Write-Output "Link        : $(Get-ProjectUrl $itemProject)/_workitems/edit/$(Get-Val $wi 'id')"

        foreach ($pair in @(
                @('System.Description', 'MÔ TẢ'),
                @('Microsoft.VSTS.TCM.ReproSteps', 'REPRO STEPS'),
                @('Microsoft.VSTS.TCM.SystemInfo', 'SYSTEM INFO'),
                @('Microsoft.VSTS.Common.AcceptanceCriteria', 'ACCEPTANCE CRITERIA'))) {
            $text = ConvertFrom-Html (Get-Val $f $pair[0])
            if ($text) {
                Write-Output ""
                Write-Output "--- $($pair[1]) ---"
                Write-Output $text
            }
        }

        $rels = Get-Val $wi 'relations' @()
        if ($rels.Count -gt 0) {
            Write-Output ""
            Write-Output "--- LIÊN KẾT / ĐÍNH KÈM ---"
            foreach ($r in $rels) {
                $attrs = Get-Val $r 'attributes'
                $name = Get-Val $attrs 'name' ''
                Write-Output ("  [{0}] {1} {2}" -f (Get-Val $r 'rel'), $name, (Get-Val $r 'url'))
            }
        }

        try {
            $cApi = Get-Val $cfg 'commentsApiVersion' '6.0-preview.3'
            $cUrl = (Get-ProjectUrl $itemProject) + "/_apis/wit/workItems/$Arg1/comments?api-version=$cApi"
            $cRes = ConvertFrom-JsonSafe (Invoke-Ado -Url $cUrl)
            $comments = Get-Val $cRes 'comments' @()
            if ($comments.Count -gt 0) {
                Write-Output ""
                Write-Output "--- THẢO LUẬN ($($comments.Count)) ---"
                foreach ($c in $comments) {
                    Write-Output ""
                    Write-Output ("  [{0}] {1}:" -f (Format-AdoDate (Get-Val $c 'createdDate')), (Format-Identity (Get-Val $c 'createdBy')))
                    Write-Output ((ConvertFrom-Html (Get-Val $c 'text')) -replace '(?m)^', '  ')
                }
            }
        }
        catch {
            Write-Output ""
            Write-Output "(không đọc được thảo luận: $($_.Exception.Message))"
        }
    }

    'states' {
        if (-not $Arg1) { throw "Thiếu tên type. Ví dụ: .\azdo.ps1 states Bug -Project CSDLMT" }
        Show-StateMenu -ProjectName $repoProject -TypeName $Arg1
    }

    'comment' {
        if (-not $Arg1) { throw "Thiếu ID work item." }
        if (-not $Arg2) { throw "Thiếu nội dung comment." }
        $wi = Get-WorkItem -Id $Arg1
        $f = Get-Val $wi 'fields'
        $itemProject = Get-Val $f 'System.TeamProject' $repoProject
        Write-Output "#$Arg1 [$(Get-Val $f 'System.WorkItemType')] @ $itemProject — $(Get-Val $f 'System.Title')"
        if (-not (Test-ProjectScope -ItemProject $itemProject -Id $Arg1 -IsWrite)) { exit 4 }
        if (-not $Yes) {
            Write-Output "CHẠY KHÔ. Sẽ thêm comment vào work item #$Arg1 :"
            Write-Output "  $Arg2"
            Write-Output "Thêm cờ -Yes để thực thi."
            break
        }
        [void](Set-WorkItemField -Id $Arg1 -Field 'System.History' -Value $Arg2)
        Write-Output "Đã thêm comment vào #$Arg1."
    }

    'state' {
        if (-not $Arg1) { throw "Thiếu ID work item." }
        if (-not $Arg2) { throw "Thiếu state đích." }
        $wi = Get-WorkItem -Id $Arg1
        $f = Get-Val $wi 'fields'
        $type = Get-Val $f 'System.WorkItemType'
        $cur = Get-Val $f 'System.State'
        $itemProject = Get-Val $f 'System.TeamProject' $repoProject

        if (-not (Test-ProjectScope -ItemProject $itemProject -Id $Arg1 -IsWrite)) { exit 4 }

        $valid = (Get-TypeStates -ProjectName $itemProject -TypeName $type) | ForEach-Object { Get-Val $_ 'name' }
        if ($valid -notcontains $Arg2) {
            Write-Output "'$Arg2' không phải state hợp lệ của '$type'."
            Show-StateMenu -ProjectName $itemProject -TypeName $type -Current $cur
            exit 1
        }
        if (-not $Yes) {
            Write-Output "CHẠY KHÔ. #$Arg1 [$type] @ $itemProject : '$cur' -> '$Arg2'"
            Write-Output "Thêm cờ -Yes để thực thi."
            break
        }
        [void](Set-WorkItemField -Id $Arg1 -Field 'System.State' -Value $Arg2)
        Write-Output "#$Arg1 [$type] : '$cur' -> '$Arg2'. Xong."
    }

    'finish' {
        if (-not $Arg1) { throw "Thiếu ID work item." }
        $wi = Get-WorkItem -Id $Arg1
        $f = Get-Val $wi 'fields'
        $type = Get-Val $f 'System.WorkItemType'
        $cur = Get-Val $f 'System.State'
        $itemProject = Get-Val $f 'System.TeamProject' $repoProject

        Write-Output "#$Arg1 [$type] @ $itemProject — $(Get-Val $f 'System.Title')"
        Write-Output "State hiện tại: $cur"
        if (-not (Test-ProjectScope -ItemProject $itemProject -Id $Arg1 -IsWrite)) { exit 4 }

        $rule = Get-Val (Get-Val $cfg 'workflow') $type
        if (-not $rule) {
            Write-Output ""
            Write-Output "DỪNG: type '$type' không có quy ước tự động. Phải hỏi người dùng chọn state."
            Show-StateMenu -ProjectName $itemProject -TypeName $type -Current $cur
            exit 2
        }

        $allowed = Get-Val $rule 'allowedFrom' @()
        if ($allowed -notcontains $cur) {
            Write-Output ""
            Write-Output "DỪNG: '$cur' nằm ngoài danh sách tự xử lý của '$type' ($($allowed -join ', '))."
            Write-Output "Phải hỏi người dùng chọn state."
            Show-StateMenu -ProjectName $itemProject -TypeName $type -Current $cur
            exit 2
        }

        $target = Get-Val $rule 'doneState'

        if (Get-Val $rule 'requirePush' $false) {
            $push = Test-BranchPushed
            if (-not $push.Ok) {
                Write-Output ""
                Write-Output "DỪNG: '$type' yêu cầu push code trước khi chuyển sang '$target'."
                Write-Output "Lý do: $($push.Reason)"
                exit 3
            }
            Write-Output "Kiểm tra push: $($push.Reason)"
        }

        if (-not $Yes) {
            Write-Output ""
            Write-Output "CHẠY KHÔ. Sẽ chuyển: '$cur' -> '$target'"
            Write-Output "Thêm cờ -Yes để thực thi."
            break
        }
        [void](Set-WorkItemField -Id $Arg1 -Field 'System.State' -Value $target)
        Write-Output ""
        Write-Output "#$Arg1 [$type] : '$cur' -> '$target'. Xong."
    }
}
