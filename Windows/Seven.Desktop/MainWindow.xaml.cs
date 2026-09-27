using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows;
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

    public MainWindow()
    {
        InitializeComponent();
    }

    private async void Window_Loaded(object sender, RoutedEventArgs e)
    {
        try
        {
            var dataFolder = System.IO.Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "SEVEN",
                "WebView2");
            var environment = await CoreWebView2Environment.CreateAsync(null, dataFolder);
            await Browser.EnsureCoreWebView2Async(environment);

            var core = Browser.CoreWebView2;
            core.Settings.AreDevToolsEnabled = false;
            core.Settings.IsZoomControlEnabled = true;
            core.Settings.IsStatusBarEnabled = false;
            core.NavigationStarting += Browser_NavigationStarting;
            core.NewWindowRequested += Browser_NewWindowRequested;
            core.HistoryChanged += (_, _) => UpdateNavigationButtons();
            core.NavigationCompleted += (_, _) => UpdateNavigationButtons();

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

    private void UpdateNavigationButtons()
    {
        var core = Browser.CoreWebView2;
        if (core is null)
        {
            return;
        }

        BackButton.IsEnabled = core.CanGoBack;
        ForwardButton.IsEnabled = core.CanGoForward;
    }

    private void Back_Click(object sender, RoutedEventArgs e)
    {
        if (Browser.CoreWebView2?.CanGoBack == true)
        {
            Browser.CoreWebView2.GoBack();
        }
    }

    private void Forward_Click(object sender, RoutedEventArgs e)
    {
        if (Browser.CoreWebView2?.CanGoForward == true)
        {
            Browser.CoreWebView2.GoForward();
        }
    }

    private void Reload_Click(object sender, RoutedEventArgs e) => Browser.Reload();

    private void OpenInBrowser_Click(object sender, RoutedEventArgs e) => OpenExternal(new Uri(AppUrl));

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
        if (WindowState == System.Windows.WindowState.Normal)
        {
            Dispatcher.BeginInvoke(DispatcherPriority.Background, (Action)KeepRestoredWindowOnScreen);
        }
    }

    private void KeepRestoredWindowOnScreen()
    {
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
