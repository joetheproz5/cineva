using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Shell;
using System.Windows.Threading;
using Microsoft.Web.WebView2.Core;

namespace Seven.Desktop;

public partial class MainWindow : Window
{
    private const string AppUrl = "https://seven-9fm.pages.dev/";
    private const string AppHost = "seven-9fm.pages.dev";
    private const string WebViewRuntimeUrl = "https://developer.microsoft.com/microsoft-edge/webview2/";
    private const uint MonitorDefaultToNearest = 2;
    private const uint SetWindowPosNoSize = 0x0001;
    private const uint SetWindowPosNoZOrder = 0x0004;
    private const uint SetWindowPosNoActivate = 0x0010;
    private const uint SetWindowPosFrameChanged = 0x0020;
    private const uint SetWindowPosShowWindow = 0x0040;
    private static readonly IntPtr HwndTopmost = new(-1);
    private static readonly string WindowPlacementPath = System.IO.Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "SEVEN",
        "window-placement.json");
    private static readonly string ContentBlockerExtensionIdPath = System.IO.Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "SEVEN",
        "ubol-extension-id.txt");
    private static readonly string ContentBlockerLogPath = System.IO.Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "SEVEN",
        "adblock-setup.log");
    private CoreWebView2BrowserExtension? _contentBlockerExtension;
    private CoreWebView2? _webViewCore;
    private string? _contentBlockerVersion;
    private string? _contentBlockerError;
    private bool _browserExtensionsAvailable;
    private readonly MenuItem _adBlockingMenuItem = new()
    {
        Header = "uBlock Origin Lite",
        IsCheckable = true,
        IsEnabled = false,
    };
    private readonly MenuItem _adBlockingStatusMenuItem = new()
    {
        Header = "uBlock Origin Lite: waiting for browser",
        IsEnabled = false,
    };
    private readonly MenuItem _adBlockingRetryMenuItem = new()
    {
        Header = "Retry uBlock installation",
        IsEnabled = false,
    };
    private readonly DispatcherTimer _placementSaveTimer;
    private bool _restoringPlacement = true;
    private bool _isPlayerFullscreen;
    private Rect? _fullscreenRestoreBounds;
    private WindowState _fullscreenRestoreState;
    private bool _fullscreenRestoreTopmost;

    public MainWindow()
    {
        InitializeComponent();
        _adBlockingMenuItem.Click += AdBlockingMenuItem_Click;
        _adBlockingRetryMenuItem.Click += AdBlockingRetryMenuItem_Click;
        var captionMenu = new ContextMenu();
        captionMenu.Items.Add(_adBlockingMenuItem);
        captionMenu.Items.Add(_adBlockingRetryMenuItem);
        captionMenu.Items.Add(new Separator());
        captionMenu.Items.Add(_adBlockingStatusMenuItem);
        CaptionBar.ContextMenu = captionMenu;
        _placementSaveTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(500) };
        _placementSaveTimer.Tick += PlacementSaveTimer_Tick;
        RestoreWindowPlacement();
        _restoringPlacement = false;
        LocationChanged += (_, _) => ScheduleWindowPlacementSave();
        SizeChanged += (_, _) => ScheduleWindowPlacementSave();
    }

    private void RestoreWindowPlacement()
    {
        var workArea = SystemParameters.WorkArea;
        if (workArea.IsEmpty || workArea.Width <= 0 || workArea.Height <= 0)
        {
            return;
        }

        MinWidth = Math.Min(820, workArea.Width);
        MinHeight = Math.Min(580, workArea.Height);
        Width = Math.Min(1440, Math.Max(MinWidth, workArea.Width - 48));
        Height = Math.Min(920, Math.Max(MinHeight, workArea.Height - 48));
        Left = workArea.Left + (workArea.Width - Width) / 2;
        Top = workArea.Top + (workArea.Height - Height) / 2;
        var virtualArea = new Rect(
            SystemParameters.VirtualScreenLeft,
            SystemParameters.VirtualScreenTop,
            SystemParameters.VirtualScreenWidth,
            SystemParameters.VirtualScreenHeight);
        if (virtualArea.IsEmpty || virtualArea.Width <= 0 || virtualArea.Height <= 0)
        {
            virtualArea = workArea;
        }

        try
        {
            var placement = JsonSerializer.Deserialize<WindowPlacement>(File.ReadAllText(WindowPlacementPath));
            if (placement is null
                || !double.IsFinite(placement.Left)
                || !double.IsFinite(placement.Top)
                || !double.IsFinite(placement.Width)
                || !double.IsFinite(placement.Height)
                || placement.Width <= 0
                || placement.Height <= 0)
            {
                return;
            }

            Width = Math.Clamp(placement.Width, MinWidth, Math.Max(MinWidth, virtualArea.Width));
            Height = Math.Clamp(placement.Height, MinHeight, Math.Max(MinHeight, virtualArea.Height));
            Left = Math.Clamp(placement.Left, virtualArea.Left, Math.Max(virtualArea.Left, virtualArea.Right - Width));
            Top = Math.Clamp(placement.Top, virtualArea.Top, Math.Max(virtualArea.Top, virtualArea.Bottom - Height));
            if (placement.WasMaximized)
            {
                WindowState = System.Windows.WindowState.Maximized;
            }
        }
        catch (Exception)
        {
            // Missing or malformed window preferences should never block startup.
        }
    }

    private async void Window_Loaded(object sender, RoutedEventArgs e)
    {
        Dispatcher.BeginInvoke(DispatcherPriority.Background, (Action)KeepRestoredWindowOnScreen);

        try
        {
            var dataFolder = System.IO.Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "SEVEN",
                "WebView2");
            CoreWebView2Environment environment;
            try
            {
                var environmentOptions = new CoreWebView2EnvironmentOptions
                {
                    AreBrowserExtensionsEnabled = true,
                };
                environment = await CoreWebView2Environment.CreateAsync(null, dataFolder, environmentOptions);
                _browserExtensionsAvailable = true;
            }
            catch (Exception exception)
            {
                // Keep the app usable with older or already-running WebView2
                // environments, but make the unavailable blocker visible.
                _contentBlockerError = $"WebView2 extensions unavailable ({exception.GetType().Name})";
                Trace.TraceError("SEVEN could not enable WebView2 extensions: {0}", exception);
                LogContentBlockerFailure("Enable WebView2 extensions", exception);
                environment = await CoreWebView2Environment.CreateAsync(null, dataFolder);
            }

            await Browser.EnsureCoreWebView2Async(environment);

            var core = Browser.CoreWebView2;
            _webViewCore = core;
            if (_browserExtensionsAvailable)
            {
                try
                {
                    await EnsureContentBlockerWithRetryAsync(core);
                }
                catch (Exception exception)
                {
                    _contentBlockerError = DescribeContentBlockerFailure(exception);
                }
            }
            UpdateAdBlockingMenu();
            core.Settings.AreDevToolsEnabled = false;
            core.Settings.IsZoomControlEnabled = true;
            core.Settings.IsStatusBarEnabled = false;
            core.NavigationStarting += Browser_NavigationStarting;
            core.NewWindowRequested += Browser_NewWindowRequested;
            core.ContainsFullScreenElementChanged += (_, _) =>
            {
                var containsFullscreenElement = core.ContainsFullScreenElement;
                Dispatcher.BeginInvoke(DispatcherPriority.Send,
                    (Action)(() => SetPlayerFullscreen(containsFullscreenElement)));
            };
            Browser.Source = new Uri(AppUrl);
        }
        catch (Exception)
        {
            Browser.Visibility = Visibility.Collapsed;
            RuntimeHelp.Visibility = Visibility.Visible;
        }
    }

    private void Browser_NavigationStarting(object? sender, CoreWebView2NavigationStartingEventArgs e)
    {
        if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out var target))
        {
            e.Cancel = true;
            return;
        }

        if (target.Scheme.Equals(Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase)
            && target.IdnHost.Equals(AppHost, StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        e.Cancel = true;
        OpenExternal(target);
    }

    private void Browser_NewWindowRequested(object? sender, CoreWebView2NewWindowRequestedEventArgs e)
    {
        e.Handled = true;
        if (Uri.TryCreate(e.Uri, UriKind.Absolute, out var target))
        {
            OpenExternal(target);
        }
    }

    private static void OpenExternal(Uri target)
    {
        if (target.Scheme is not ("http" or "https"))
        {
            return;
        }

        try
        {
            Process.Start(new ProcessStartInfo(target.AbsoluteUri) { UseShellExecute = true });
        }
        catch
        {
            // A missing browser association should not bring down the desktop shell.
        }
    }

    private async void AdBlockingMenuItem_Click(object sender, RoutedEventArgs e)
    {
        if (_contentBlockerExtension is not { } extension)
        {
            return;
        }

        _adBlockingMenuItem.IsEnabled = false;
        try
        {
            await extension.EnableAsync(_adBlockingMenuItem.IsChecked);
            _contentBlockerError = null;
        }
        catch (Exception exception)
        {
            _contentBlockerError = $"Could not update state ({exception.GetType().Name})";
            Trace.TraceError("SEVEN could not change uBlock Origin Lite state: {0}", exception);
        }

        UpdateAdBlockingMenu();
    }

    private async void AdBlockingRetryMenuItem_Click(object sender, RoutedEventArgs e)
    {
        if (!_browserExtensionsAvailable || _webViewCore is not { } core)
        {
            return;
        }

        _adBlockingRetryMenuItem.IsEnabled = false;
        _contentBlockerError = null;
        try
        {
            await EnsureContentBlockerWithRetryAsync(core);
        }
        catch (Exception exception)
        {
            _contentBlockerError = DescribeContentBlockerFailure(exception);
        }

        UpdateAdBlockingMenu();
    }

    private void UpdateAdBlockingMenu()
    {
        var extension = _contentBlockerExtension;
        _adBlockingMenuItem.IsEnabled = extension is not null;
        _adBlockingMenuItem.IsChecked = extension?.IsEnabled ?? false;
        _adBlockingRetryMenuItem.IsEnabled = _browserExtensionsAvailable && extension is null;
        _adBlockingStatusMenuItem.Header = _contentBlockerError is not null
            ? $"Unavailable · {_contentBlockerError}"
            : extension is null
                ? "Unavailable · extension not installed"
                : extension.IsEnabled
                ? $"Enabled · version {_contentBlockerVersion} · uBlock + EasyList + EasyPrivacy"
                    : $"Disabled · version {_contentBlockerVersion}";
    }

    private async Task EnsureContentBlockerWithRetryAsync(CoreWebView2 core)
    {
        const int maxAttempts = 3;
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                await EnsureContentBlockerAsync(core);
                return;
            }
            catch (Exception exception)
            {
                Trace.TraceError("SEVEN could not install uBlock Origin Lite (attempt {0}/{1}): {2}", attempt, maxAttempts, exception);
                LogContentBlockerFailure($"Install uBlock Origin Lite, attempt {attempt}/{maxAttempts}", exception);
                if (attempt >= maxAttempts)
                {
                    throw;
                }

                await Task.Delay(TimeSpan.FromMilliseconds(500 * attempt));
            }
        }
    }

    private async Task EnsureContentBlockerAsync(CoreWebView2 core)
    {
        var extensionPath = System.IO.Path.Combine(AppContext.BaseDirectory, "Extensions", "uBOLite");
        var manifestPath = System.IO.Path.Combine(extensionPath, "manifest.json");
        if (!File.Exists(manifestPath))
        {
            throw new FileNotFoundException("The bundled uBlock Origin Lite files are missing.", manifestPath);
        }

        using var manifest = JsonDocument.Parse(File.ReadAllText(manifestPath));
        _contentBlockerVersion = manifest.RootElement.GetProperty("version").GetString() ?? "unknown";

        var installedExtensions = await core.Profile.GetBrowserExtensionsAsync();
        var savedExtensionId = ReadContentBlockerExtensionId();
        _contentBlockerExtension = savedExtensionId is null
            ? null
            : installedExtensions.FirstOrDefault(extension =>
                extension.Id.Equals(savedExtensionId, StringComparison.OrdinalIgnoreCase));
        _contentBlockerExtension ??= installedExtensions.FirstOrDefault(extension =>
            extension.Name.Contains("uBlock Origin Lite", StringComparison.OrdinalIgnoreCase));
        if (_contentBlockerExtension is null)
        {
            _contentBlockerExtension = await core.Profile.AddBrowserExtensionAsync(extensionPath);
            if (!_contentBlockerExtension.IsEnabled)
            {
                await _contentBlockerExtension.EnableAsync(true);
            }
        }
        SaveContentBlockerExtensionId(_contentBlockerExtension.Id);
        _contentBlockerError = null;
    }

    private static string DescribeContentBlockerFailure(Exception exception)
    {
        var remedy = exception is FileNotFoundException
            ? "Blocker files missing; reinstall SEVEN"
            : "Setup failed";
        return $"{remedy} · {exception.GetType().Name} · 0x{exception.HResult:X8} · see adblock-setup.log";
    }

    private static void LogContentBlockerFailure(string action, Exception exception)
    {
        try
        {
            Directory.CreateDirectory(System.IO.Path.GetDirectoryName(ContentBlockerLogPath)!);
            File.AppendAllText(
                ContentBlockerLogPath,
                $"[{DateTimeOffset.Now:O}] {action}{Environment.NewLine}{exception}{Environment.NewLine}{Environment.NewLine}");
        }
        catch
        {
            // Diagnostic logging must never prevent the streaming app from opening.
        }
    }

    private static string? ReadContentBlockerExtensionId()
    {
        try
        {
            var extensionId = File.ReadAllText(ContentBlockerExtensionIdPath).Trim();
            return extensionId.Length == 0 ? null : extensionId;
        }
        catch (FileNotFoundException)
        {
            return null;
        }
        catch (DirectoryNotFoundException)
        {
            return null;
        }
        catch (Exception exception)
        {
            Trace.TraceError("SEVEN could not read the uBlock Origin Lite ID: {0}", exception);
            return null;
        }
    }

    private static void SaveContentBlockerExtensionId(string extensionId)
    {
        try
        {
            Directory.CreateDirectory(System.IO.Path.GetDirectoryName(ContentBlockerExtensionIdPath)!);
            File.WriteAllText(ContentBlockerExtensionIdPath, extensionId);
        }
        catch (Exception exception)
        {
            Trace.TraceError("SEVEN could not save the uBlock Origin Lite ID: {0}", exception);
        }
    }

    private void Minimize_Click(object sender, RoutedEventArgs e) => SystemCommands.MinimizeWindow(this);

    private void MaximizeRestore_Click(object sender, RoutedEventArgs e)
    {
        if (WindowState == System.Windows.WindowState.Maximized)
        {
            SystemCommands.RestoreWindow(this);
            return;
        }

        SystemCommands.MaximizeWindow(this);
    }

    private void Window_StateChanged(object? sender, EventArgs e)
    {
        if (_restoringPlacement || _isPlayerFullscreen)
        {
            return;
        }

        if (WindowState == System.Windows.WindowState.Normal)
        {
            Dispatcher.BeginInvoke(DispatcherPriority.Background, (Action)KeepRestoredWindowOnScreen);
        }

        ScheduleWindowPlacementSave();
    }

    private void KeepRestoredWindowOnScreen()
    {
        if (WindowState != System.Windows.WindowState.Normal)
        {
            return;
        }

        var windowHandle = new WindowInteropHelper(this).Handle;
        var monitorHandle = MonitorFromWindow(windowHandle, MonitorDefaultToNearest);
        var monitor = new NativeMonitorInfo { Size = Marshal.SizeOf<NativeMonitorInfo>() };
        if (monitorHandle == IntPtr.Zero || !GetMonitorInfo(monitorHandle, ref monitor) || !GetWindowRect(windowHandle, out var bounds))
        {
            return;
        }

        var width = bounds.Right - bounds.Left;
        var height = bounds.Bottom - bounds.Top;
        var maxLeft = Math.Max(monitor.Work.Right - width, monitor.Work.Left);
        var maxTop = Math.Max(monitor.Work.Bottom - height, monitor.Work.Top);
        var left = Math.Clamp(bounds.Left, monitor.Work.Left, maxLeft);
        var top = Math.Clamp(bounds.Top, monitor.Work.Top, maxTop);

        if (left != bounds.Left || top != bounds.Top)
        {
            SetWindowPos(windowHandle, IntPtr.Zero, left, top, 0, 0,
                SetWindowPosNoSize | SetWindowPosNoZOrder | SetWindowPosNoActivate);
        }
    }

    private void SetPlayerFullscreen(bool isFullscreen)
    {
        if (_isPlayerFullscreen == isFullscreen)
        {
            return;
        }

        if (isFullscreen)
        {
            EnterPlayerFullscreen();
        }
        else
        {
            ExitPlayerFullscreen();
        }
    }

    private void EnterPlayerFullscreen()
    {
        _fullscreenRestoreState = WindowState;
        _fullscreenRestoreBounds = WindowState == System.Windows.WindowState.Maximized
            ? RestoreBounds
            : new Rect(Left, Top, Width, Height);
        _fullscreenRestoreTopmost = Topmost;
        _isPlayerFullscreen = true;

        CaptionRow.Height = new GridLength(0);
        if (WindowState != System.Windows.WindowState.Normal)
        {
            WindowState = System.Windows.WindowState.Normal;
        }
        Topmost = true;
        Dispatcher.BeginInvoke(DispatcherPriority.Loaded, (Action)CoverCurrentMonitor);
    }

    private void CoverCurrentMonitor()
    {
        if (!_isPlayerFullscreen)
        {
            return;
        }

        var windowHandle = new WindowInteropHelper(this).Handle;
        var monitorHandle = MonitorFromWindow(windowHandle, MonitorDefaultToNearest);
        var monitor = new NativeMonitorInfo { Size = Marshal.SizeOf<NativeMonitorInfo>() };
        if (monitorHandle == IntPtr.Zero || !GetMonitorInfo(monitorHandle, ref monitor))
        {
            return;
        }

        var bounds = monitor.Monitor;
        SetWindowPos(windowHandle, HwndTopmost,
            bounds.Left, bounds.Top,
            bounds.Right - bounds.Left, bounds.Bottom - bounds.Top,
            SetWindowPosNoActivate | SetWindowPosFrameChanged | SetWindowPosShowWindow);
    }

    private void ExitPlayerFullscreen()
    {
        var restoreBounds = _fullscreenRestoreBounds;
        var restoreState = _fullscreenRestoreState;
        var restoreTopmost = _fullscreenRestoreTopmost;

        CaptionRow.Height = new GridLength(42);
        WindowState = System.Windows.WindowState.Normal;
        if (restoreBounds is { } bounds && !bounds.IsEmpty)
        {
            Left = bounds.Left;
            Top = bounds.Top;
            Width = bounds.Width;
            Height = bounds.Height;
        }
        Topmost = restoreTopmost;
        if (restoreState == System.Windows.WindowState.Maximized)
        {
            WindowState = System.Windows.WindowState.Maximized;
        }

        _isPlayerFullscreen = false;
        _fullscreenRestoreBounds = null;
        Dispatcher.BeginInvoke(DispatcherPriority.Background, (Action)KeepRestoredWindowOnScreen);
        ScheduleWindowPlacementSave();
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct NativeRect
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct NativeMonitorInfo
    {
        public int Size;
        public NativeRect Monitor;
        public NativeRect Work;
        public uint Flags;
    }

    [DllImport("user32.dll")]
    private static extern IntPtr MonitorFromWindow(IntPtr windowHandle, uint flags);

    [DllImport("user32.dll", EntryPoint = "GetMonitorInfoW", SetLastError = true, CharSet = CharSet.Unicode)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetMonitorInfo(IntPtr monitorHandle, ref NativeMonitorInfo monitorInfo);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetWindowRect(IntPtr windowHandle, out NativeRect bounds);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetWindowPos(IntPtr windowHandle, IntPtr insertAfter, int x, int y, int width, int height, uint flags);

    private void Close_Click(object sender, RoutedEventArgs e) => Close();

    private void Window_Closing(object? sender, System.ComponentModel.CancelEventArgs e)
    {
        _placementSaveTimer.Stop();
        SaveWindowPlacement();
    }

    private void PlacementSaveTimer_Tick(object? sender, EventArgs e)
    {
        _placementSaveTimer.Stop();
        SaveWindowPlacement();
    }

    private void ScheduleWindowPlacementSave()
    {
        if (_restoringPlacement || _isPlayerFullscreen)
        {
            return;
        }

        _placementSaveTimer.Stop();
        _placementSaveTimer.Start();
    }

    private void SaveWindowPlacement()
    {
        try
        {
            var bounds = _isPlayerFullscreen && _fullscreenRestoreBounds is { } fullscreenBounds
                ? fullscreenBounds
                : WindowState == System.Windows.WindowState.Normal
                    ? new Rect(Left, Top, Width, Height)
                    : RestoreBounds;
            if (bounds.IsEmpty || !double.IsFinite(bounds.Left) || !double.IsFinite(bounds.Top)
                || !double.IsFinite(bounds.Width) || !double.IsFinite(bounds.Height)
                || bounds.Width <= 0 || bounds.Height <= 0)
            {
                return;
            }

            Directory.CreateDirectory(System.IO.Path.GetDirectoryName(WindowPlacementPath)!);
            var wasMaximized = _isPlayerFullscreen
                ? _fullscreenRestoreState == System.Windows.WindowState.Maximized
                : WindowState == System.Windows.WindowState.Maximized;
            var placement = new WindowPlacement(bounds.Left, bounds.Top, bounds.Width, bounds.Height, wasMaximized);
            File.WriteAllText(WindowPlacementPath, JsonSerializer.Serialize(placement));
        }
        catch (Exception)
        {
            // Window geometry is a convenience; a read-only profile folder must not stop exit.
        }
    }

    private sealed record WindowPlacement(double Left, double Top, double Width, double Height, bool WasMaximized);

    private void InstallRuntime_Click(object sender, RoutedEventArgs e) => OpenExternal(new Uri(WebViewRuntimeUrl));

    private void Window_PreviewKeyDown(object sender, KeyEventArgs e)
    {
        if ((Keyboard.Modifiers & ModifierKeys.Alt) != 0 && e.Key == Key.Left && Browser.CoreWebView2?.CanGoBack == true)
        {
            Browser.CoreWebView2.GoBack();
            e.Handled = true;
        }
        else if ((Keyboard.Modifiers & ModifierKeys.Alt) != 0 && e.Key == Key.Right && Browser.CoreWebView2?.CanGoForward == true)
        {
            Browser.CoreWebView2.GoForward();
            e.Handled = true;
        }
    }
}
