# BioVerse Personal DNA for desktop

Open a forward-strand consumer genotype export in TXT, TSV, CSV, ZIP, or
GZ format. The app shows findings for two markers from the BioVerse web panel
and lets you save a plain-text report. The report includes the observed genotype,
coverage for both markers, limitations, and references. The app has no accounts,
network requests, or automatic file or report storage.

The pilot covers CYP1A2 rs762551 and ACTN3 rs1815739 for education. The web
report's other markers and clinical interpretations need evidence and input
validation before inclusion. Whole-genome sequence reads and VCF files are
outside the supported formats.

## Run from source

Use Python 3.10 or newer with Tk installed. From the repository root, run
`python desktop/app.py`. You can view a synthetic report without selecting
a DNA export.

## Build installers

The BioVerse desktop GitHub Actions workflow packages separate macOS
Apple Silicon and Intel DMGs and a Windows x64 setup executable. Download the
appropriate artifact from a successful workflow run and extract its outer ZIP.
On Mac, open the DMG and drag BioVerse into Applications. On Windows, run the
setup executable. The current builds use no production signing certificate
or Apple notarization and are intended for internal testing.
