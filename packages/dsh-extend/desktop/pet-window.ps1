<#
    Desktop pet window for the @local/dsh-pet plugin.

    A borderless, transparent, always-on-top WPF window that renders frames
    cropped out of the PNG spritesheet the browser exported. It lives in its own
    powershell.exe process, so the pet can be dragged anywhere on the desktop —
    including outside the DSH window — without DSH itself being modified.

    The Host owns everything else: this script only
      - reads the sheet + layout handed to it by the Host,
      - polls `<BaseUrl>/dsh-pet/api/desktop/state` for the animation state,
      - reports the window position back when the user drags it.

    Closing behaviour: right-click opens the size/hide menu (hiding clears
    `petVisible`, so the page's supervisor does not start the window right
    back), and the Host ending the process (stop / app shutdown) simply kills
    this window.
#>
param(
    [Parameter(Mandatory = $true)][string]$BaseUrl,
    [Parameter(Mandatory = $true)][string]$SheetPath,
    [Parameter(Mandatory = $true)][string]$LayoutPath
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase

# Per-pixel click-through: the sprite frame is a rectangle, so without this every
# transparent pixel of the pet still swallows clicks meant for whatever is behind
# it. The window toggles WS_EX_TRANSPARENT whenever the cursor sits on a
# transparent pixel of the current frame.
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class PetNative {
    [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }
    [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
    [DllImport("user32.dll", EntryPoint = "GetWindowLongW")] public static extern int GetWindowLong(IntPtr hWnd, int index);
    [DllImport("user32.dll", EntryPoint = "SetWindowLongW")] public static extern int SetWindowLong(IntPtr hWnd, int index, int value);
}
"@

$api = "$BaseUrl/dsh-pet/api/desktop"
$configApi = "$BaseUrl/dsh-pet/api/config"

# ─── Spritesheet + layout ───────────────────────────────────────────────────

$layout = Get-Content -LiteralPath $LayoutPath -Raw -Encoding UTF8 | ConvertFrom-Json
# `scale` is the factor the window currently draws the sprite at; the sheet
# itself always holds source-resolution frames, so a size change is a local
# resize (instant) instead of a re-export plus a window restart.
$exportScale = if ($layout.scale) { [double]$layout.scale } else { 1.0 }
$scale = $exportScale
$script:scaleFactor = $exportScale
$frameW = [int]$layout.frameWidth
$frameH = [int]$layout.frameHeight
$winW = [double]$frameW * $scale
$winH = [double]$frameH * $scale

$sheetUri = New-Object System.Uri((Resolve-Path -LiteralPath $SheetPath).Path)
$bitmap = New-Object System.Windows.Media.Imaging.BitmapImage
$bitmap.BeginInit()
$bitmap.UriSource = $sheetUri
$bitmap.CacheOption = [System.Windows.Media.Imaging.BitmapCacheOption]::OnLoad
$bitmap.EndInit()
$bitmap.Freeze()

$states = @{}
foreach ($prop in $layout.states.PSObject.Properties) {
    $row = [int]$prop.Value.row
    $durations = @($prop.Value.durations | ForEach-Object { [int]$_ })
    $frames = New-Object System.Collections.ArrayList
    for ($col = 0; $col -lt $durations.Count; $col++) {
        $rect = New-Object System.Windows.Int32Rect(($col * $frameW), ($row * $frameH), $frameW, $frameH)
        $crop = New-Object System.Windows.Media.Imaging.CroppedBitmap($bitmap, $rect)
        $crop.Freeze()
        [void]$frames.Add($crop)
    }
    $states[$prop.Name] = @{ frames = $frames; durations = $durations }
}
if (-not $states.ContainsKey('idle')) {
    throw "layout.json has no idle state"
}

# ─── Window ─────────────────────────────────────────────────────────────────

$window = New-Object System.Windows.Window
$window.WindowStyle = [System.Windows.WindowStyle]::None
$window.AllowsTransparency = $true
$window.Background = [System.Windows.Media.Brushes]::Transparent
$window.Topmost = $true
$window.ShowInTaskbar = $false
$window.ShowActivated = $false
$window.ResizeMode = [System.Windows.ResizeMode]::NoResize
$window.Width = $winW
$window.Height = $winH
$work = [System.Windows.SystemParameters]::WorkArea
$window.Left = [Math]::Max($work.Left, $work.Right - $winW - 40)
$window.Top = [Math]::Max($work.Top, $work.Bottom - $winH - 60)

$image = New-Object System.Windows.Controls.Image
$image.Width = $winW
$image.Height = $winH
$image.Stretch = [System.Windows.Media.Stretch]::Fill
$image.Source = $states['idle'].frames[0]

# ─── Right-click menu ───────────────────────────────────────────────────────
#
# The menu lives inside the pet window instead of a WPF ContextMenu: this window
# never activates (`ShowActivated = $false`), and a popup owned by an inactive
# window closes itself immediately. Opening the menu grows the window around the
# sprite and puts it back exactly where it was when the menu closes.

$menuW = 212.0
$menuH = 184.0
$script:menuOpen = $false

$menuPanel = New-Object System.Windows.Controls.Border
$menuPanel.Width = $menuW
$menuPanel.Height = $menuH
$menuPanel.CornerRadius = New-Object System.Windows.CornerRadius(10)
$menuPanel.Padding = New-Object System.Windows.Thickness(10)
$menuPanel.Background = New-Object System.Windows.Media.SolidColorBrush(
    [System.Windows.Media.Color]::FromArgb(242, 32, 33, 38))
$menuPanel.BorderBrush = New-Object System.Windows.Media.SolidColorBrush(
    [System.Windows.Media.Color]::FromArgb(255, 74, 76, 84))
$menuPanel.BorderThickness = New-Object System.Windows.Thickness(1)
$menuPanel.Visibility = [System.Windows.Visibility]::Collapsed

$menuStack = New-Object System.Windows.Controls.StackPanel
$menuFont = New-Object System.Windows.Media.FontFamily('Microsoft YaHei UI, Segoe UI')

$menuTitle = New-Object System.Windows.Controls.TextBlock
$menuTitle.Text = '桌宠大小'
$menuTitle.FontSize = 11
$menuTitle.FontFamily = $menuFont
$menuTitle.Margin = New-Object System.Windows.Thickness(2, 0, 0, 6)
$menuTitle.Foreground = New-Object System.Windows.Media.SolidColorBrush(
    [System.Windows.Media.Color]::FromArgb(255, 168, 172, 180))
[void]$menuStack.Children.Add($menuTitle)

$sizeRow = New-Object System.Windows.Controls.Primitives.UniformGrid
$sizeRow.Columns = 3
$sizeRow.Rows = 2
$sizeRow.Margin = New-Object System.Windows.Thickness(0, 0, 0, 8)
foreach ($size in @(0.5, 0.75, 1, 1.25, 1.5, 2)) {
    $sizeButton = New-Object System.Windows.Controls.Button
    $sizeButton.Content = "$size×"
    $sizeButton.Tag = $size
    $sizeButton.Height = 26
    $sizeButton.Margin = New-Object System.Windows.Thickness(2)
    $sizeButton.FontSize = 11
    $sizeButton.FontFamily = $menuFont
    $sizeButton.Add_Click({
            $button = $args[0]
            Set-PetScale ([double]$button.Tag)
        })
    [void]$sizeRow.Children.Add($sizeButton)
}
[void]$menuStack.Children.Add($sizeRow)

$manageButton = New-Object System.Windows.Controls.Button
$manageButton.Content = '管理桌宠'
$manageButton.Height = 28
$manageButton.Margin = New-Object System.Windows.Thickness(0, 0, 0, 6)
$manageButton.FontSize = 11
$manageButton.FontFamily = $menuFont
$manageButton.Add_Click({ Open-PetSettings })
[void]$menuStack.Children.Add($manageButton)

$hideButton = New-Object System.Windows.Controls.Button
$hideButton.Content = '隐藏桌宠'
$hideButton.Height = 28
$hideButton.FontSize = 11
$hideButton.FontFamily = $menuFont
$hideButton.Add_Click({ Hide-Pet })
[void]$menuStack.Children.Add($hideButton)

$menuPanel.Child = $menuStack

# ─── Running-session badge ──────────────────────────────────────────────────
#
# Sits in the sprite's top-right corner and shows how many DSH sessions are
# running; the page reports the number with the mood push. Zero keeps it hidden.

$badgeW = 24.0
$badgeH = 18.0
$badge = New-Object System.Windows.Controls.Border
$badge.Width = $badgeW
$badge.Height = $badgeH
$badge.CornerRadius = New-Object System.Windows.CornerRadius(9)
$badge.Background = New-Object System.Windows.Media.SolidColorBrush(
    [System.Windows.Media.Color]::FromArgb(255, 46, 160, 67))
$badge.Visibility = [System.Windows.Visibility]::Collapsed
$badgeText = New-Object System.Windows.Controls.TextBlock
$badgeText.FontSize = 11
$badgeText.FontWeight = [System.Windows.FontWeights]::SemiBold
$badgeText.FontFamily = $menuFont
$badgeText.Foreground = [System.Windows.Media.Brushes]::White
$badgeText.HorizontalAlignment = [System.Windows.HorizontalAlignment]::Center
$badgeText.VerticalAlignment = [System.Windows.VerticalAlignment]::Center
$badge.Child = $badgeText

$canvas = New-Object System.Windows.Controls.Canvas
[void]$canvas.Children.Add($image)
[void]$canvas.Children.Add($menuPanel)
[void]$canvas.Children.Add($badge)
[System.Windows.Controls.Canvas]::SetLeft($image, 0)
[System.Windows.Controls.Canvas]::SetTop($image, 0)
$window.Content = $canvas

# The collapsed geometry, so closing the menu can restore the sprite exactly.
$script:petRect = @{ L = $window.Left; T = $window.Top; W = $winW; H = $winH }
$script:baseW = $winW
$script:baseH = $winH

function Update-BadgePosition {
    $left = [System.Windows.Controls.Canvas]::GetLeft($image)
    $top = [System.Windows.Controls.Canvas]::GetTop($image)
    if ([double]::IsNaN($left)) { $left = 0 }
    if ([double]::IsNaN($top)) { $top = 0 }
    [System.Windows.Controls.Canvas]::SetLeft($badge, $left + $script:baseW - $badgeW - 3)
    [System.Windows.Controls.Canvas]::SetTop($badge, $top + 3)
}

function Update-Badge([int]$count, [string]$state) {
    if ($count -le 0) {
        $badge.Visibility = [System.Windows.Visibility]::Collapsed
        return
    }
    $badgeText.Text = if ($count -gt 99) { '99+' } else { [string]$count }
    # Green while work is running, amber while an approval waits, red on error —
    # the same reading as the in-page badge.
    $colour = if ($state -eq 'failed') { '#d13438' } elseif ($state -eq 'waiting') { '#c9861a' } else { '#2ea043' }
    $badge.Background = New-Object System.Windows.Media.SolidColorBrush(
        [System.Windows.Media.ColorConverter]::ConvertFromString($colour))
    Update-BadgePosition
    $badge.Visibility = [System.Windows.Visibility]::Visible
}

function Sync-PetRect {
    if ($script:menuOpen) { return }
    $script:petRect = @{ L = $window.Left; T = $window.Top; W = $script:baseW; H = $script:baseH }
}

function Open-Menu {
    if ($script:menuOpen) { return }
    Sync-PetRect
    $l = $script:petRect.L
    $t = $script:petRect.T
    $w = $script:petRect.W
    $h = $script:petRect.H
    $roomRight = $work.Right - ($l + $w)
    $roomBelow = $work.Bottom - ($t + $h)
    if ($roomRight -ge $menuW -and $roomBelow -ge $menuH) {
        $window.Left = $l
        $window.Top = $t
        [System.Windows.Controls.Canvas]::SetLeft($image, 0)
        [System.Windows.Controls.Canvas]::SetTop($image, 0)
        [System.Windows.Controls.Canvas]::SetLeft($menuPanel, $w)
        [System.Windows.Controls.Canvas]::SetTop($menuPanel, $h)
    } else {
        # No room to the right/below (the pet usually sits in that corner):
        # grow left/up and move the sprite with the window so it stays put.
        $nl = [Math]::Max($work.Left, $l - $menuW)
        $nt = [Math]::Max($work.Top, $t - $menuH)
        $dx = $l - $nl
        $dy = $t - $nt
        $window.Left = $nl
        $window.Top = $nt
        [System.Windows.Controls.Canvas]::SetLeft($image, $dx)
        [System.Windows.Controls.Canvas]::SetTop($image, $dy)
        [System.Windows.Controls.Canvas]::SetLeft($menuPanel, 0)
        [System.Windows.Controls.Canvas]::SetTop($menuPanel, 0)
    }
    $window.Width = $w + $menuW
    $window.Height = $h + $menuH
    $menuPanel.Visibility = [System.Windows.Visibility]::Visible
    Update-BadgePosition
    $script:menuOpen = $true
    $script:menuTimer.Stop()
    $script:menuTimer.Start()
}

function Close-Menu {
    if (-not $script:menuOpen) { return }
    $menuPanel.Visibility = [System.Windows.Visibility]::Collapsed
    $window.Width = $script:petRect.W
    $window.Height = $script:petRect.H
    $window.Left = $script:petRect.L
    $window.Top = $script:petRect.T
    [System.Windows.Controls.Canvas]::SetLeft($image, 0)
    [System.Windows.Controls.Canvas]::SetTop($image, 0)
    Update-BadgePosition
    $script:menuOpen = $false
    $script:menuTimer.Stop()
}

function Set-PetScale([double]$value) {
    Close-Menu
    # Apply locally first: the config round trip plus the page's 4 s supervisor
    # tick made a size click feel broken. The Host write only persists it.
    Set-DisplayScale $value
    try {
        Invoke-RestMethod -Uri $configApi -Method Put -ContentType 'application/json' `
            -Body (@{ petScale = $value } | ConvertTo-Json -Compress) -TimeoutSec 3 | Out-Null
    } catch { }
}

# Resize in place: no asset re-export, no window restart. `$scale` is the
# sprite-pixel -> DIP factor the hit test and drag code already use. The sheet
# always holds source-resolution frames, so the factor *is* the pet scale.
function Set-DisplayScale([double]$target) {
    if ($target -le 0) { return }
    $factor = $target
    if ([Math]::Abs($factor - $script:scaleFactor) -lt 0.001) { return }
    $script:scaleFactor = $factor
    $script:scale = $factor
    $script:winW = [double]$frameW * $factor
    $script:winH = [double]$frameH * $factor
    $script:baseW = $script:winW
    $script:baseH = $script:winH
    $image.Width = $script:winW
    $image.Height = $script:winH
    if ($script:menuOpen) {
        # Keep the sprite's on-screen box in step; Close-Menu restores from it.
        $script:petRect = @{ L = $window.Left; T = $window.Top; W = $script:winW; H = $script:winH }
    } else {
        $window.Width = $script:winW
        $window.Height = $script:winH
        Sync-PetRect
    }
    Update-BadgePosition
}

# Ask the page to open DSH Settings on the pet page. The helper is a separate
# process and cannot reach the webview, so it raises a flag on the Host that
# the pet's client picks up on its next status poll.
function Open-PetSettings {
    Close-Menu
    try {
        Invoke-RestMethod -Uri "$api/reveal" -Method Post -ContentType 'application/json' `
            -Body '{}' -TimeoutSec 3 | Out-Null
    } catch { }
}

function Hide-Pet {
    Close-Menu
    # Hiding is a config change, not just "stop this process": the page keeps
    # the window in step with the config and would relaunch a window that was
    # merely stopped.
    try {
        Invoke-RestMethod -Uri $configApi -Method Put -ContentType 'application/json' `
            -Body '{"petVisible":false}' -TimeoutSec 3 | Out-Null
    } catch { }
    $script:alive = $false
    $window.Close()
}

# A menu with no outside-click dismissal needs its own timeout.
$script:menuTimer = New-Object System.Windows.Threading.DispatcherTimer
$script:menuTimer.Interval = [TimeSpan]::FromSeconds(12)
$script:menuTimer.Add_Tick({
        $script:menuTimer.Stop()
        Close-Menu
    })

# ─── Animation state machine ────────────────────────────────────────────────

$script:ambient = 'idle'      # from the Host (running / waiting / failed / idle)
$script:oneShot = $null       # transient kind played before returning to ambient
$script:oneShotLeft = 0
$script:override = $null      # sustained kind that outranks ambient (drag)
$script:frame = 0
$script:nextAt = [DateTime]::UtcNow
$script:alive = $true
$script:positionSeeded = $false
$script:misses = 0

function Set-State([string]$name) {
    if ($name -eq $script:current) { return }
    $script:current = $name
    $script:frame = 0
    $script:nextAt = [DateTime]::UtcNow
}

$script:current = 'idle'

function Play-OneShot([string]$name, [int]$loops) {
    if (-not $states.ContainsKey($name)) { return }
    $script:oneShot = $name
    $script:oneShotLeft = $loops
    Set-State $name
}

$anim = New-Object System.Windows.Threading.DispatcherTimer
$anim.Interval = [TimeSpan]::FromMilliseconds(60)
$anim.Add_Tick({
        $now = [DateTime]::UtcNow
        if ($now -lt $script:nextAt) { return }
        # Priority: an in-progress interaction (being dragged) beats a transient
        # flourish, which beats whatever the Host reports.
        $name = if ($script:override) { $script:override } elseif ($script:oneShot) { $script:oneShot } else { $script:ambient }
        if (-not $states.ContainsKey($name)) { $name = 'idle' }
        if ($name -ne $script:current) { Set-State $name }
        $state = $states[$name]
        $count = $state.frames.Count
        if ($count -le 0) { return }
        $script:frame = ($script:frame + 1) % $count
        $image.Source = $state.frames[$script:frame]
        Update-FrameAlpha
        $script:nextAt = $now.AddMilliseconds([Math]::Max(40, $state.durations[$script:frame]))
        if ($script:frame -eq 0 -and $script:oneShot) {
            $script:oneShotLeft = $script:oneShotLeft - 1
            if ($script:oneShotLeft -le 0) {
                $script:oneShot = $null
                Set-State $script:ambient
            }
        }
    })

# ─── Click-through on transparent pixels ────────────────────────────────────
#
# A WPF window still hit-tests its whole rectangle unless the OS is told
# otherwise, so the pet used to swallow every click inside its 192x208 frame —
# including the pixels where nothing is drawn. Windows decides per-pixel input
# routing from WS_EX_TRANSPARENT, so this timer keeps that style in step with
# the pixel under the cursor: transparent pixel -> clicks fall through to the
# window behind, drawn pixel -> the pet stays draggable/clickable.
# Pixels within $grabMargin screen pixels of a drawn pixel count as the pet too,
# so the silhouette is comfortable to grab instead of pixel-perfect.

$grabMargin = 4
$script:clickThrough = $false
$script:frameAlpha = $null
$script:alphaW = 0
$script:alphaH = 0
$script:dragging = $false
$script:dragSampleX = 0.0
$script:dragSampleY = 0.0
$clickHandle = [IntPtr]::Zero

function Update-FrameAlpha {
    $frame = $image.Source
    if ($null -eq $frame) { return }
    try {
        $w = [int]$frame.PixelWidth
        $h = [int]$frame.PixelHeight
        if ($w -le 0 -or $h -le 0) { return }
        $stride = $w * 4
        $buffer = New-Object byte[] ($stride * $h)
        $frame.CopyPixels((New-Object System.Windows.Int32Rect(0, 0, $w, $h)), $buffer, $stride, 0)
        $script:frameAlpha = $buffer
        $script:alphaW = $w
        $script:alphaH = $h
    } catch {
        $script:frameAlpha = $null
    }
}

function Set-ClickThrough([bool]$on) {
    if ($clickHandle -eq [IntPtr]::Zero) { return }
    try {
        # Reconcile against the live style every time: the framework rewrites
        # the extended style for its own reasons, and a cached "already set"
        # flag would then leave the window permanently click-through.
        $style = [PetNative]::GetWindowLong($clickHandle, -20)   # GWL_EXSTYLE
        $has = ($style -band 0x20) -ne 0                          # WS_EX_TRANSPARENT
        if ($has -ne $on) {
            if ($on) {
                [void][PetNative]::SetWindowLong($clickHandle, -20, $style -bor 0x20)
            } else {
                [void][PetNative]::SetWindowLong($clickHandle, -20, $style -band (-bnot 0x20))
            }
        }
        $script:clickThrough = $on
    } catch { }
}

function Test-LocalPixel([double]$localX, [double]$localY) {
    if ($null -eq $script:frameAlpha) { Update-FrameAlpha }
    if ($null -eq $script:frameAlpha) { return $true }
    # The badge is part of the pet even where the sprite has no pixels.
    if ($badge.Visibility -eq [System.Windows.Visibility]::Visible) {
        $badgeLeft = [System.Windows.Controls.Canvas]::GetLeft($badge)
        $badgeTop = [System.Windows.Controls.Canvas]::GetTop($badge)
        if ($localX -ge $badgeLeft -and $localX -le ($badgeLeft + $badgeW) -and
            $localY -ge $badgeTop -and $localY -le ($badgeTop + $badgeH)) {
            return $true
        }
    }
    $left = [System.Windows.Controls.Canvas]::GetLeft($image)
    $top = [System.Windows.Controls.Canvas]::GetTop($image)
    if ([double]::IsNaN($left)) { $left = 0 }
    if ([double]::IsNaN($top)) { $top = 0 }
    $sx = [int][Math]::Floor(($localX - $left) / $scale)
    $sy = [int][Math]::Floor(($localY - $top) / $scale)
    # $grabMargin is in screen pixels, so it stays the same physical slack at
    # every pet size; convert it to sprite pixels for the scan. The scan is not
    # clamped to the frame: a few transparent pixels just outside the sprite
    # still belong to the pet.
    $margin = [int][Math]::Ceiling($grabMargin / $scale)
    # Slack around every drawn pixel, so the pet is easy to grab and thin parts
    # (a tail, an ear) never slip out from under the cursor. 0 = exact shape.
    for ($dy = -$margin; $dy -le $margin; $dy++) {
        $py = $sy + $dy
        if ($py -lt 0 -or $py -ge $script:alphaH) { continue }
        for ($dx = -$margin; $dx -le $margin; $dx++) {
            $px = $sx + $dx
            if ($px -lt 0 -or $px -ge $script:alphaW) { continue }
            if ($script:frameAlpha[($py * $script:alphaW + $px) * 4 + 3] -ge 24) { return $true }
        }
    }
    return $false
}

function Test-CursorPixel {
    if ($null -eq $script:frameAlpha) { Update-FrameAlpha }
    if ($null -eq $script:frameAlpha) { return $true }
    $point = New-Object PetNative+POINT
    if (-not [PetNative]::GetCursorPos([ref]$point)) { return $true }
    $source = [System.Windows.PresentationSource]::FromVisual($window)
    if ($null -eq $source) { return $true }
    # GetCursorPos is in device pixels; the window and canvas work in DIPs.
    # (::new rather than New-Object: the argument-list form binds the two
    # numbers as one array here and throws.)
    $devicePoint = [System.Windows.Point]::new([double]$point.X, [double]$point.Y)
    $dip = $source.CompositionTarget.TransformFromDevice.Transform($devicePoint)
    return (Test-LocalPixel ($dip.X - $window.Left) ($dip.Y - $window.Top))
}

# Carry animation: the same reading as the in-page pet - carried sideways means
# running left/right, a purely vertical carry has no direction so it uses the
# plain run cycle. Called from the tick loop while DragMove pumps messages.
function Update-DragState {
    $dx = [double]$window.Left - $script:dragSampleX
    $dy = [double]$window.Top - $script:dragSampleY
    if ([Math]::Abs($dx) -lt 0.75 -and [Math]::Abs($dy) -lt 0.75) { return }
    $script:dragSampleX = [double]$window.Left
    $script:dragSampleY = [double]$window.Top
    $name = 'running'
    if ([Math]::Abs($dx) -ge 0.75) {
        $name = if ($dx -lt 0) { 'running_left' } else { 'running_right' }
    }
    if (-not $states.ContainsKey($name)) { return }
    $changed = $script:override -ne $name
    $script:override = $name
    # Switch on the spot: the frame timer can be parked on a long idle frame
    # (up to ~1.9 s), which made the first drag feel unresponsive.
    if ($changed) { Set-State $name }
}

$clickTimer = New-Object System.Windows.Threading.DispatcherTimer
$clickTimer.Interval = [TimeSpan]::FromMilliseconds(45)
$clickTimer.Add_Tick({
        # The menu and an in-flight drag own the whole window. DragMove runs a
        # nested message loop, so ticks keep firing while the pet is carried:
        # this is where the carry animation gets picked from the movement.
        if ($script:menuOpen -or $script:dragging) {
            Set-ClickThrough $false
            if ($script:dragging) { Update-DragState }
            if ($script:menuOpen) {
                # Clicking anywhere outside dismisses the menu, the way an OS
                # menu behaves — the pet window is tiny, so its own bounds are
                # exactly the menu's bounds.
                $point = New-Object PetNative+POINT
                if ([PetNative]::GetCursorPos([ref]$point)) {
                    $source = [System.Windows.PresentationSource]::FromVisual($window)
                    if ($null -ne $source) {
                        $devicePoint = [System.Windows.Point]::new([double]$point.X, [double]$point.Y)
                        $dip = $source.CompositionTarget.TransformFromDevice.Transform($devicePoint)
                        $margin = 6.0
                        if ($dip.X -lt ($window.Left - $margin) -or $dip.X -gt ($window.Left + $window.ActualWidth + $margin) -or
                            $dip.Y -lt ($window.Top - $margin) -or $dip.Y -gt ($window.Top + $window.ActualHeight + $margin)) {
                            Close-Menu
                        }
                    }
                }
            }
            return
        }
        try {
            Set-ClickThrough (-not (Test-CursorPixel))
        } catch {
            # Hit testing must never take the window down; stay interactive.
            Set-ClickThrough $false
        }
    })

# ─── Host polling ───────────────────────────────────────────────────────────

$poll = New-Object System.Windows.Threading.DispatcherTimer
$poll.Interval = [TimeSpan]::FromMilliseconds(500)
$poll.Add_Tick({
        try {
            $state = Invoke-RestMethod -Uri "$api/state" -TimeoutSec 2
            $script:misses = 0
            if ($state.ok -ne $true -or $state.alive -ne $true) {
                $script:alive = $false
                $window.Close()
                return
            }
            if ($state.state) {
                $next = [string]$state.state
                if ($next -ne $script:ambient) {
                    $script:ambient = $next
                    # React now, not at the next frame boundary: an idle frame
                    # can hold the timer for ~1.9 s.
                    if (-not $script:override -and -not $script:oneShot -and $states.ContainsKey($next)) {
                        Set-State $next
                    }
                }
            }
            # The Host reports the configured size: follow it locally so the
            # window never has to be restarted to change size.
            if ($state.scale) { Set-DisplayScale ([double]$state.scale) }
            if ($null -ne $state.sessions) {
                Update-Badge ([int]$state.sessions) ([string]$state.state)
            }
            if (-not $script:positionSeeded -and $state.position) {
                $window.Left = [double]$state.position.x
                $window.Top = [double]$state.position.y
                $script:positionSeeded = $true
                Sync-PetRect
            }
        } catch {
            # A short Host restart must not kill the pet; an orphaned window
            # (Host gone for ~30 s) closes itself instead of lingering forever.
            $script:misses = $script:misses + 1
            if ($script:misses -gt 60) {
                $script:alive = $false
                $window.Close()
            }
        }
    })

# ─── Interaction ────────────────────────────────────────────────────────────

$script:dragStart = $null

$window.Add_MouseLeftButtonDown({
        # While the menu is open a click anywhere on the sprite just dismisses
        # it, so a stray click never drags or hides the pet by accident.
        if ($script:menuOpen) {
            Close-Menu
            return
        }
        $script:dragStart = @{ x = [double]$window.Left; y = [double]$window.Top }
        $script:dragSampleX = [double]$window.Left
        $script:dragSampleY = [double]$window.Top
        $script:dragging = $true
        try { $window.DragMove() } catch { }
        $script:dragging = $false
        $script:override = $null
        $moved = $false
        if ($script:dragStart) {
            $moved = ([Math]::Abs([double]$window.Left - $script:dragStart.x) -gt 3) -or
            ([Math]::Abs([double]$window.Top - $script:dragStart.y) -gt 3)
        }
        if ($moved) {
            Sync-PetRect
            try {
                $body = @{ x = [int][Math]::Round($window.Left); y = [int][Math]::Round($window.Top) } |
                    ConvertTo-Json -Compress
                Invoke-RestMethod -Uri "$api/position" -Method Post -ContentType 'application/json' `
                    -Body $body -TimeoutSec 3 | Out-Null
            } catch { }
            # Landed: one hop back to whatever the Host reports.
            Play-OneShot 'jumping' 1
        } else {
            Play-OneShot 'jumping' 2
        }
    })

$window.Add_MouseRightButtonUp({
        # Right-click opens the size/hide menu; it must not hide the pet on the
        # spot (that made an accidental right-click look like a crash).
        if ($script:menuOpen) { Close-Menu } else { Open-Menu }
    })

$window.Add_Closed({
        try { $anim.Stop(); $poll.Stop(); $clickTimer.Stop() } catch { }
    })

# The handle must exist before the style toggling can start.
$clickHandle = (New-Object System.Windows.Interop.WindowInteropHelper($window)).EnsureHandle()
Update-FrameAlpha

# Greet once when the pet appears; the Host's ambient state takes over after.
Play-OneShot 'waving' 1

$anim.Start()
$poll.Start()
$clickTimer.Start()
[void]$window.ShowDialog()
