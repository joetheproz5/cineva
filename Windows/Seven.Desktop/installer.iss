#define AppName "SEVEN"
#define AppVersion "1.0.0"
#define AppExecutable "SEVEN.exe"

[Setup]
AppId={{B826C31C-9670-4E97-9366-86CB2BEE01D3}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=SEVEN
DefaultDirName={localappdata}\Programs\SEVEN
DefaultGroupName=SEVEN
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=..\..\dist\installer
OutputBaseFilename=SEVEN-Setup-win-x64
SetupIconFile=Assets\seven.ico
UninstallDisplayIcon={app}\{#AppExecutable}
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
Compression=lzma2
SolidCompression=yes
WizardStyle=modern

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: unchecked

[Files]
Source: "..\..\dist\windows\{#AppExecutable}"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\dist\windows\Extensions\*"; DestDir: "{app}\Extensions"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "ThirdPartyNotices.txt"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\SEVEN"; Filename: "{app}\{#AppExecutable}"
Name: "{autodesktop}\SEVEN"; Filename: "{app}\{#AppExecutable}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExecutable}"; Description: "Launch SEVEN"; Flags: postinstall skipifsilent nowait
