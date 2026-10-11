# Window-state helper for the dsh-extend Host half.
#
# The desktop shell always opens its primary window at a fixed 1280x820 with
# no memory of the user's last session. This helper watches the real window
# through Win32 WINDOWPLACEMENT (which carries both the maximized flag and
# the normal-position rectangle in one call) and keeps a JSON state file in
# sync; at boot the saved placement is re-applied with SetWindowPlacement.
#
# Modes:
#   restore  one-shot: poll up to 60s for the primary window, apply the
#            saved placement (maximized or normal bounds), then exit.
#   watch    long-lived: every $PollSeconds, read the placement of the
#            primary window and write the JSON when it changes; exits
#            when the Host or the app dies, or after the safety cap.
#
# The Host passes its OWN pid (-HostPid); the Electron main process is this
# process's parent. The primary window is picked by visible+titled-first
# ranking (see FindPrimaryWindow) — never by raw area, because hidden
# bound-mirroring companion windows can out-area the real one.

param(
  [Parameter(Mandatory = $true)][int]$HostPid,
  [Parameter(Mandatory = $true)][string]$StatePath,
  [Parameter(Mandatory = $true)][ValidateSet('restore', 'watch')][string]$Mode,
  [int]$PollSeconds = 2,
  # Safety net only (the Host kills the watcher on dispose and the loop also
  # exits the moment the parent processes die); long enough that tray-
  # background sessions spanning days keep their geometry current.
  [int]$CapMinutes = 10080
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Windows.Forms

$win32 = @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public class DshWindowState {
  public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct WINDOWPLACEMENT {
    public int length;
    public int flags;
    public int showCmd;
    public int ptMinPositionX;
    public int ptMinPositionY;
    public int ptMaxPositionX;
    public int ptMaxPositionY;
    public int rcNormalPositionLeft;
    public int rcNormalPositionTop;
    public int rcNormalPositionRight;
    public int rcNormalPositionBottom;
  }

  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [DllImport("user32.dll")] public static extern bool GetWindowPlacement(IntPtr hWnd, ref WINDOWPLACEMENT lpwndpl);
  [DllImport("user32.dll")] public static extern bool SetWindowPlacement(IntPtr hWnd, [In] ref WINDOWPLACEMENT lpwndpl);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr hWnd, int msg, IntPtr wParam, IntPtr lParam);

  public const int SW_SHOWNORMAL = 1;
  public const int SW_SHOWMAXIMIZED = 3;
  public const int PLACEMENT_LENGTH = 44;
  public const int WM_SYSCOMMAND = 0x0112;
  public const int SC_RESTORE = 0xF120;
  public const int SC_MAXIMIZE = 0xF030;
  public const uint SWP_NOSIZE = 0x0001;
  public const uint SWP_NOMOVE = 0x0002;
  public const uint SWP_NOZORDER = 0x0004;
  public const uint SWP_NOACTIVATE = 0x0010;

  // The whole enumeration stays inside C#: a PowerShell scriptblock
  // callback would be marshalled back onto the pipeline thread and
  // deadlock against the blocked EnumWindows call.
  //
  // Ranking — the main process owns more than one top-level window: the
  // primary BrowserWindow (visible, titled "DeepSeek Harness") plus
  // hidden bound-mirroring companions (WebContentsView surfaces that
  // copy the parent bounds and can briefly out-area the real window).
  // Pure "largest" picks the companion and both restore and watch then
  // target the wrong surface. Preference order:
  //   1. visible AND titled, largest  (the real window, steady state);
  //   2. titled, largest              (the hidden-at-boot primary);
  //   3. largest overall              (fallback for unknown shells).
  public static IntPtr FindPrimaryWindow(uint pid) {
    IntPtr bestVisible = IntPtr.Zero, bestTitled = IntPtr.Zero, bestAny = IntPtr.Zero;
    long areaVisible = -1, areaTitled = -1, areaAny = -1;
    EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) {
      uint wndPid;
      GetWindowThreadProcessId(hWnd, out wndPid);
      if (wndPid != pid) return true;
      RECT r;
      if (!GetWindowRect(hWnd, out r)) return true;
      long area = Area(r);
      if (area > areaAny) { areaAny = area; bestAny = hWnd; }
      var title = new StringBuilder(256);
      if (GetWindowText(hWnd, title, 256) <= 0) return true;
      if (area > areaTitled) { areaTitled = area; bestTitled = hWnd; }
      if (IsWindowVisible(hWnd) && area > areaVisible) { areaVisible = area; bestVisible = hWnd; }
      return true;
    }, IntPtr.Zero);
    if (bestVisible != IntPtr.Zero) return bestVisible;
    if (bestTitled != IntPtr.Zero) return bestTitled;
    return bestAny;
  }

  public static long Area(RECT r) {
    long w = r.Right - r.Left;
    long h = r.Bottom - r.Top;
    if (w < 0) w = 0;
    if (h < 0) h = 0;
    return w * h;
  }
}
'@
Add-Type -TypeDefinition $win32

function Get-MainProcessId {
  try {
    $row = Get-CimInstance Win32_Process -Filter "ProcessId = $HostPid" -ErrorAction Stop
    return [int]$row.ParentProcessId
  } catch {
    return 0
  }
}

function Test-ProcessAlive([int]$PidToCheck) {
  if ($PidToCheck -le 0) { return $false }
  return $null -ne (Get-Process -Id $PidToCheck -ErrorAction SilentlyContinue)
}

# The primary window: the largest top-level window of the Electron main
# process. Hidden windows rank too (the primary is born hidden), so the
# restore pass can place it before the first show. Ranking happens in C# —
# a PowerShell callback on EnumWindows would deadlock the pipeline thread.
function Find-PrimaryWindowHandle([int]$MainPid) {
  if ($MainPid -le 0) { return [IntPtr]::Zero }
  return [DshWindowState]::FindPrimaryWindow([uint32]$MainPid)
}

function Read-Placement([IntPtr]$Handle) {
  $wp = New-Object DshWindowState+WINDOWPLACEMENT
  $wp.length = [DshWindowState]::PLACEMENT_LENGTH
  if (-not [DshWindowState]::GetWindowPlacement($Handle, [ref]$wp)) { return $null }
  return $wp
}

function Write-State([bool]$Maximized, [int]$X, [int]$Y, [int]$Width, [int]$Height) {
  # Degenerate rectangles (mid-creation windows) must not clobber good state.
  if ($Width -lt 200 -or $Height -lt 200) { return }
  $payload = @{ version = 1; maximized = $Maximized; bounds = @{ x = $X; y = $Y; width = $Width; height = $Height } }
  $json = ConvertTo-Json -InputObject $payload -Compress
  $tmp = "$StatePath.tmp"
  [System.IO.File]::WriteAllText($tmp, $json)
  Move-Item -LiteralPath $tmp -Destination $StatePath -Force
}

function Clamp-ToVirtualScreen([int]$X, [int]$Y, [int]$Width, [int]$Height) {
  $vs = [System.Windows.Forms.SystemInformation]::VirtualScreen
  $w = [Math]::Min($Width, $vs.Width)
  $h = [Math]::Min($Height, $vs.Height)
  if ($w -lt 400) { $w = 400 }
  if ($h -lt 300) { $h = 300 }
  $x = $X
  $y = $Y
  # Entirely outside every connected monitor (e.g. a laptop undocked from the
  # display that owned the saved rect): re-seat near the primary origin.
  if ($x + $w -le $vs.Left -or $x -ge $vs.Right -or $y + $h -le $vs.Top -or $y -ge $vs.Bottom) {
    $x = $vs.Left + 100
    $y = $vs.Top + 100
  }
  return @( $x, $y, $w, $h )
}

if ($Mode -eq 'restore') {
  if (-not (Test-Path -LiteralPath $StatePath)) { exit 0 }
  try {
    $state = Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json
  } catch {
    exit 0
  }
  if ($null -eq $state -or $null -eq $state.bounds) { exit 0 }
  try {
    $x = [int]$state.bounds.x
    $y = [int]$state.bounds.y
    $w = [int]$state.bounds.width
    $h = [int]$state.bounds.height
  } catch {
    exit 0
  }
  ($x, $y, $w, $h) = Clamp-ToVirtualScreen $x $y $w $h
  $maximized = $false
  try { $maximized = [bool]$state.maximized } catch { }

  $deadline = (Get-Date).AddSeconds(60)
  $handle = [IntPtr]::Zero
  while ((Get-Date) -lt $deadline) {
    if (-not (Test-ProcessAlive $HostPid)) { exit 0 }
    $handle = Find-PrimaryWindowHandle (Get-MainProcessId)
    if ($handle -ne [IntPtr]::Zero) { break }
    Start-Sleep -Milliseconds 500
  }
  if ($handle -eq [IntPtr]::Zero) { exit 0 }

  # A maximized window ignores SetWindowPos geometry; drop back to normal
  # first — but only while visible, so the hidden-at-boot case is never
  # force-shown (same visibility-sync trap as below). The restore goes
  # through WM_SYSCOMMAND so Chromium updates its own window state: a raw
  # ShowWindowAsync unmaximize is reverted at the next state sync.
  $current = Read-Placement $handle
  if ($current -ne $null -and $current.showCmd -eq [DshWindowState]::SW_SHOWMAXIMIZED -and [DshWindowState]::IsWindowVisible($handle)) {
    [void][DshWindowState]::SendMessage($handle, [DshWindowState]::WM_SYSCOMMAND, [IntPtr][DshWindowState]::SC_RESTORE, [IntPtr]::Zero)
    Start-Sleep -Milliseconds 300
  }

  # Set the normal bounds WITHOUT touching visibility: at boot the primary
  # window is still hidden (show:false until the shell's enterWorkspace),
  # and SetWindowPlacement with SW_SHOWNORMAL would show it prematurely —
  # Chromium then re-hides it at the next frame commit (its WebContents
  # visibility still says hidden), which the user sees as a flash followed
  # by a window that only reappears on tray click. SetWindowPos never shows
  # a hidden window, so the geometry is in place before the first real show.
  $posFlags = [DshWindowState]::SWP_NOZORDER -bor [DshWindowState]::SWP_NOACTIVATE
  [void][DshWindowState]::SetWindowPos($handle, [IntPtr]::Zero, $x, $y, $w, $h, $posFlags)

  if ($maximized) {
    # Maximize only once the shell shows the window (SW_SHOW would fight the
    # same visibility sync); the 200ms poll lands within the first frames.
    # WM_SYSCOMMAND keeps Chromium's own state consistent with the HWND.
    $showDeadline = (Get-Date).AddSeconds(60)
    while ((Get-Date) -lt $showDeadline) {
      if (-not (Test-ProcessAlive $HostPid)) { exit 0 }
      if ([DshWindowState]::IsWindowVisible($handle)) {
        [void][DshWindowState]::SendMessage($handle, [DshWindowState]::WM_SYSCOMMAND, [IntPtr][DshWindowState]::SC_MAXIMIZE, [IntPtr]::Zero)
        exit 0
      }
      Start-Sleep -Milliseconds 200
    }
  }
  exit 0
}

# watch mode
$lastJson = $null
$deadline = (Get-Date).AddMinutes($CapMinutes)
while ((Get-Date) -lt $deadline) {
  if (-not (Test-ProcessAlive $HostPid)) { break }
  $mainPid = Get-MainProcessId
  if (-not (Test-ProcessAlive $mainPid)) { break }
  $handle = Find-PrimaryWindowHandle $mainPid
  if ($handle -ne [IntPtr]::Zero) {
    $wp = Read-Placement $handle
    if ($null -ne $wp) {
      $maximized = ($wp.showCmd -eq [DshWindowState]::SW_SHOWMAXIMIZED)
      $x = $wp.rcNormalPositionLeft
      $y = $wp.rcNormalPositionTop
      $w = $wp.rcNormalPositionRight - $wp.rcNormalPositionLeft
      $h = $wp.rcNormalPositionBottom - $wp.rcNormalPositionTop
      if ($w -ge 200 -and $h -ge 200) {
        $payload = @{ version = 1; maximized = $maximized; bounds = @{ x = $x; y = $y; width = $w; height = $h } }
        $json = ConvertTo-Json -InputObject $payload -Compress
        if ($json -ne $lastJson) {
          try { Write-State $maximized $x $y $w $h } catch { }
          $lastJson = $json
        }
      }
    }
  }
  Start-Sleep -Seconds $PollSeconds
}
exit 0
