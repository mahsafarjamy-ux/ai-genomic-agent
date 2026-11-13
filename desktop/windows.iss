[Setup]
AppId=BioVerse.PersonalDNA
AppName=BioVerse Personal DNA
AppVersion=0.1.0
DefaultDirName={localappdata}\Programs\BioVerse Personal DNA
DefaultGroupName=BioVerse
PrivilegesRequired=lowest
UninstallDisplayIcon={app}\BioVerse.exe
OutputDir=..\dist
OutputBaseFilename=BioVerse-Windows-x64-Setup
Compression=lzma2
SolidCompression=yes

[Files]
Source: "..\dist\BioVerse\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs

[Icons]
Name: "{group}\BioVerse Personal DNA"; Filename: "{app}\BioVerse.exe"
