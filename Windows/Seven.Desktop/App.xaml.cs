using System.IO;
using System.IO.Pipes;
using System.Text;

namespace Seven.Desktop;

public partial class App : System.Windows.Application
{
    private const string OAuthActivationPipe = "SEVEN.OAuthActivation";
    private readonly CancellationTokenSource _activationStop = new();

    protected override void OnStartup(System.Windows.StartupEventArgs e)
    {
        base.OnStartup(e);
        var callback = e.Args.FirstOrDefault(Seven.Desktop.MainWindow.IsNativeOAuthCallback);
        if (callback is not null && TrySendOAuthCallback(callback))
        {
            Shutdown();
            return;
        }

        var window = new MainWindow(callback);
        MainWindow = window;
        window.Show();
        _ = Task.Run(() => ListenForOAuthCallbacks(window, _activationStop.Token));
    }

    protected override void OnExit(System.Windows.ExitEventArgs e)
    {
        _activationStop.Cancel();
        base.OnExit(e);
    }

    private static bool TrySendOAuthCallback(string callback)
    {
        try
        {
            using var client = new NamedPipeClientStream(".", OAuthActivationPipe, PipeDirection.Out);
            client.Connect(500);
            using var writer = new StreamWriter(client, new UTF8Encoding(false), 1024, leaveOpen: true) { AutoFlush = true };
            writer.WriteLine(callback);
            return true;
        }
        catch (Exception exception) when (exception is IOException or TimeoutException or UnauthorizedAccessException)
        {
            return false;
        }
    }

    private static async Task ListenForOAuthCallbacks(MainWindow window, CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                await using var server = new NamedPipeServerStream(
                    OAuthActivationPipe,
                    PipeDirection.In,
                    1,
                    PipeTransmissionMode.Byte,
                    PipeOptions.Asynchronous | PipeOptions.CurrentUserOnly);
                await server.WaitForConnectionAsync(cancellationToken);
                using var reader = new StreamReader(server, Encoding.UTF8, detectEncodingFromByteOrderMarks: true, bufferSize: 1024, leaveOpen: true);
                var callback = await reader.ReadLineAsync(cancellationToken);
                if (callback is not null && Seven.Desktop.MainWindow.IsNativeOAuthCallback(callback))
                    await window.Dispatcher.InvokeAsync(() => window.ReceiveNativeOAuthCallback(callback));
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                return;
            }
            catch (IOException)
            {
                await Task.Delay(250);
            }
        }
    }
}
