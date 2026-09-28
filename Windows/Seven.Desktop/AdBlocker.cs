using System.Collections.Concurrent;
using System.Collections.Frozen;
using System.Diagnostics;
using System.IO;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;

namespace Seven.Desktop;

/// <summary>
/// Cancels requests to known ad, pop-under, and tracking domains before they reach
/// the network. Matching is a registrable-domain suffix match against a curated
/// list; request payloads are never inspected, rewritten, or stored.
/// </summary>
public sealed class AdBlocker
{
    private const string SettingsFolderName = "SEVEN";
    private const string SettingsFileName = "adblock.json";

    /// <summary>
    /// Curated domains commonly used by embedded-player ad chains: pop/redirect
    /// networks, ad exchanges, and tracking beacons. Matched by label suffix, so
    /// each registrable domain covers its subdomains.
    /// </summary>
    private static readonly string[] BlockedDomains =
    [
        // Pop/redirect and click networks frequently chained by embed players.
        "popads.net",
        "popcash.net",
        "popmyads.com",
        "propellerads.com",
        "propellerclick.com",
        "propeller-tracking.com",
        "onclickads.net",
        "onclckds.com",
        "push-mania.com",
        "pushwhy.com",
        "adcash.com",
        "exoclick.com",
        "exosrv.com",
        "exdynsrv.com",
        "juicyads.com",
        "trafficjunky.net",
        "trafficfactory.biz",
        "zeropark.com",
        "trafficshop.com",
        "clickadu.com",
        "bidvertiser.com",
        "hilltopads.net",
        "hilltopads.com",
        "adsterra.com",
        "adskeeper.com",
        "adskeeper.co.uk",
        "monetag.com",
        "mtag.pw",
        "onetag-sys.com",
        "tsyndicate.com",
        "coinzilla.com",
        "a-ads.com",
        "revenuehits.com",
        "madadsmedia.com",

        // Mainstream exchanges and RTB endpoints.
        "doubleclick.net",
        "googlesyndication.com",
        "googleadservices.com",
        "googletagservices.com",
        "adservice.google.com",
        "adnxs.com",
        "adsafeprotected.com",
        "amazon-adsystem.com",
        "criteo.com",
        "criteo.net",
        "casalemedia.com",
        "openx.net",
        "pubmatic.com",
        "rubiconproject.com",
        "smartadserver.com",
        "adform.net",
        "adroll.com",
        "bidswitch.net",
        "bidr.io",
        "sharethrough.com",
        "spotxchange.com",
        "spotx.tv",
        "teads.tv",
        "outbrain.com",
        "taboola.com",
        "mgid.com",
        "revcontent.com",
        "zergnet.com",
        "adblade.com",
        "media.net",
        "indexww.com",
        "indexexchange.com",
        "yieldmo.com",
        "sovrn.com",
        "lijit.com",
        "33across.com",
        "undertone.com",
        "gumgum.com",
        "playwire.com",
        "vidoomy.com",
        "moatads.com",
        "moatpixel.com",
        "adsco.re",
        "ad-delivery.net",
        "serving-sys.com",
        "zedo.com",
        "fastclick.net",
        "improvedigital.com",

        // Tracking, session-replay, and analytics beacons.
        "google-analytics.com",
        "googletagmanager.com",
        "analytics.google.com",
        "scorecardresearch.com",
        "quantserve.com",
        "quantcount.com",
        "newrelic.com",
        "nr-data.net",
        "hotjar.com",
        "mouseflow.com",
        "fullstory.com",
        "logrocket.com",
        "smartlook.com",
        "crazyegg.com",
        "chartbeat.com",
        "chartbeat.net",
        "mixpanel.com",
        "segment.io",
        "segment.com",
        "amplitude.com",
        "heapanalytics.com",
        "kissmetrics.com",
        "kissmetrics.io",
        "matomo.cloud",
        "statcounter.com",
        "histats.com",
        "mc.yandex.ru",
        "an.yandex.ru",
        "yadro.ru",
        "top-fwz1.mail.ru",
        "adriver.ru",
        "adfox.ru",
        "clarity.ms",
        "bat.bing.com",
        "ads.yahoo.com",
        "gemini.yahoo.com",
    ];

    private static readonly FrozenSet<string> BlockedDomainSet = BlockedDomains
        .Select(static domain => domain.Trim().ToLowerInvariant())
        .Where(static domain => domain.Length > 0)
        .ToFrozenSet();

    private readonly ConcurrentDictionary<string, byte> _hostCache = new(StringComparer.OrdinalIgnoreCase);
    private readonly string _settingsPath;
    private CoreWebView2Environment? _environment;
    private CoreWebView2? _core;
    private long _blockedRequestCount;
    private long _errorCount;
    private bool _isEnabled;
    private bool _isAttached;

    /// <summary>Raised when the enabled state changes or a request is blocked.</summary>
    public event EventHandler? StateChanged;

    /// <summary>Total requests cancelled since launch.</summary>
    public long BlockedRequestCount => Interlocked.Read(ref _blockedRequestCount);

    /// <summary>Non-fatal filter and settings errors since launch.</summary>
    public long ErrorCount => Interlocked.Read(ref _errorCount);

    /// <summary>Whether the request filter is active in the current WebView.</summary>
    public bool IsAttached => _isAttached;

    /// <summary>Whether request blocking is enabled. Persisted per install; on by default.</summary>
    public bool IsEnabled
    {
        get => _isEnabled;
        set
        {
            if (_isEnabled == value)
            {
                return;
            }

            _isEnabled = value;
            SaveState();
            StateChanged?.Invoke(this, EventArgs.Empty);
        }
    }

    public AdBlocker()
    {
        _settingsPath = System.IO.Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            SettingsFolderName,
            SettingsFileName);
        _isEnabled = LoadState();
    }

    /// <summary>
    /// Registers an iframe- and worker-aware filter for every resource type.
    /// Call after <see cref="CoreWebView2"/> is available and before navigation.
    /// </summary>
    public void Attach(CoreWebView2 core, CoreWebView2Environment environment)
    {
        ArgumentNullException.ThrowIfNull(core);
        ArgumentNullException.ThrowIfNull(environment);

        if (_isAttached && ReferenceEquals(_core, core))
        {
            return;
        }

        try
        {
            // The two-argument overload is deprecated and misses requests from
            // iframes. Use all request sources and contexts so player ad calls,
            // including CSS, fonts, XHR, and service-worker traffic are covered.
            core.AddWebResourceRequestedFilter(
                "*",
                CoreWebView2WebResourceContext.All,
                CoreWebView2WebResourceRequestSourceKinds.All);
            core.WebResourceRequested += OnWebResourceRequested;
            _core = core;
            _environment = environment;
            _isAttached = true;
        }
        catch (Exception exception)
        {
            RecordError("registering request filters", exception);
        }

        StateChanged?.Invoke(this, EventArgs.Empty);
    }

    /// <summary>Detaches the blocking handler and removes its request filter.</summary>
    public void Detach(CoreWebView2 core)
    {
        ArgumentNullException.ThrowIfNull(core);
        core.WebResourceRequested -= OnWebResourceRequested;
        if (_isAttached && ReferenceEquals(_core, core))
        {
            try
            {
                core.RemoveWebResourceRequestedFilter(
                    "*",
                    CoreWebView2WebResourceContext.All,
                    CoreWebView2WebResourceRequestSourceKinds.All);
            }
            catch (Exception exception)
            {
                RecordError("removing request filters", exception);
            }
        }

        _core = null;
        _environment = null;
        _isAttached = false;
        StateChanged?.Invoke(this, EventArgs.Empty);
    }

    /// <summary>Resets the launch-scoped blocked-request counter.</summary>
    public void ResetCounters() => Interlocked.Exchange(ref _blockedRequestCount, 0);

    private void OnWebResourceRequested(object? sender, CoreWebView2WebResourceRequestedEventArgs e)
    {
        if (!_isEnabled)
        {
            return;
        }

        try
        {
            var uriString = e.Request?.Uri;
            if (string.IsNullOrEmpty(uriString)
                || !Uri.TryCreate(uriString, UriKind.Absolute, out var uri)
                || uri.Scheme is not ("http" or "https")
                || !ShouldBlockHost(uri.IdnHost))
            {
                return;
            }

            var environment = _environment;
            if (environment is null)
            {
                return;
            }

            e.Response = environment.CreateWebResourceResponse(
                Stream.Null, 200, "OK", "Content-Type: text/plain\r\nContent-Length: 0\r\n");
            var blockedCount = Interlocked.Increment(ref _blockedRequestCount);
            if (ShouldReportCount(blockedCount))
            {
                StateChanged?.Invoke(this, EventArgs.Empty);
            }
        }
        catch (Exception exception)
        {
            // A failed decision must never break navigation; surface it in the
            // shield tooltip and trace log so failures are diagnosable.
            RecordError("handling a web request", exception);
        }
    }

    /// <summary>
    /// Suffix match by label, so "ads.example.popads.net" matches "popads.net".
    /// Recent host decisions are cached because player embeds repeat requests.
    /// Suffix matching avoids unrelated matches such as notexample.com.
    /// </summary>
    private bool ShouldBlockHost(string host)
    {
        if (host.Length == 0)
        {
            return false;
        }

        if (_hostCache.TryGetValue(host, out var cached))
        {
            return cached == 1;
        }

        var result = MatchesBlockList(host);
        _hostCache[host] = result ? (byte)1 : (byte)0;
        return result;
    }

    private bool MatchesBlockList(string host)
    {
        var candidate = host;
        while (candidate.Length > 0)
        {
            if (BlockedDomainSet.Contains(candidate))
            {
                return true;
            }

            var dotIndex = candidate.IndexOf('.');
            if (dotIndex < 0)
            {
                return false;
            }

            candidate = candidate[(dotIndex + 1)..];
        }

        return false;
    }

    private bool LoadState()
    {
        try
        {
            var json = File.ReadAllText(_settingsPath);
            return JsonSerializer.Deserialize<AdBlockerState>(json) is { } state && state.Enabled;
        }
        catch (FileNotFoundException)
        {
            return true;
        }
        catch (DirectoryNotFoundException)
        {
            return true;
        }
        catch (Exception exception)
        {
            RecordError("loading settings", exception);
            return true;
        }
    }

    private void SaveState()
    {
        try
        {
            Directory.CreateDirectory(System.IO.Path.GetDirectoryName(_settingsPath)!);
            File.WriteAllText(_settingsPath, JsonSerializer.Serialize(new AdBlockerState(_isEnabled)));
        }
        catch (Exception exception)
        {
            RecordError("saving settings", exception);
        }
    }

    private void RecordError(string operation, Exception exception)
    {
        var errorCount = Interlocked.Increment(ref _errorCount);
        Trace.TraceError("SEVEN ad blocker error while {0} (total: {1}): {2}", operation, errorCount, exception);
        if (ShouldReportCount(errorCount))
        {
            StateChanged?.Invoke(this, EventArgs.Empty);
        }
    }

    private static bool ShouldReportCount(long count) =>
        count == 1 || (count & (count - 1)) == 0;

    private sealed record AdBlockerState(bool Enabled);
}
