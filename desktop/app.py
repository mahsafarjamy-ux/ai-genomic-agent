"""BioVerse's local desktop entry point."""

import csv
import tkinter as tk
import zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from tkinter import filedialog, messagebox, ttk
from tkinter.scrolledtext import ScrolledText
from zlib import error as CompressionError

from analysis import analyze

SAMPLE = """BioVerse Personal DNA
Educational report · Synthetic example

Caffeine metabolism · CYP1A2 (rs762551)
Genotype AC
One A allele was observed. Studies associate the A allele with higher
CYP1A2 activity under some conditions. This marker alone cannot predict
caffeine sensitivity.

Select your raw DNA export to generate your own report.
"""


def main() -> None:
    root = tk.Tk()
    root.title("BioVerse Personal DNA")
    root.geometry("850x620")
    root.minsize(580, 430)
    root.configure(padx=24, pady=20)
    executor = ThreadPoolExecutor(max_workers=1)

    ttk.Label(root, text="Personal DNA", font=("TkDefaultFont", 24, "bold")).pack(anchor="w")
    ttk.Label(root, text="BioVerse  ·  Your DNA is analyzed on this computer.").pack(
        anchor="w", pady=(4, 18)
    )
    actions = ttk.Frame(root)
    actions.pack(fill="x", pady=(0, 12))
    status = tk.StringVar(value="Choose a raw DNA export or view a synthetic example.")
    ttk.Label(root, textvariable=status, wraplength=520).pack(side="bottom", anchor="w", pady=(12, 0))
    report = ScrolledText(root, wrap="word", padx=16, pady=14, font="TkDefaultFont")
    report.pack(expand=True, fill="both")

    def show_report(text: str, exportable: bool) -> None:
        report.configure(state="normal")
        report.delete("1.0", "end")
        report.insert("1.0", text)
        report.configure(state="disabled")
        save.configure(state="normal" if exportable else "disabled")

    def open_export() -> None:
        selected = filedialog.askopenfilename(
            title="Choose a raw DNA export",
            filetypes=[("Raw DNA export", "*.txt *.csv *.tsv *.zip *.gz")],
        )
        if not selected:
            return
        show_report("", False)
        status.set("Analyzing locally…")
        choose.configure(state="disabled")
        sample.configure(state="disabled")
        pending = executor.submit(analyze, Path(selected))

        def finish() -> None:
            if not pending.done():
                root.after(100, finish)
                return
            choose.configure(state="normal")
            sample.configure(state="normal")
            try:
                result = pending.result()
            except (OSError, ValueError, EOFError, RuntimeError, NotImplementedError,
                    csv.Error, zipfile.BadZipFile, CompressionError) as error:
                status.set("The export could not be analyzed.")
                messagebox.showerror("Unable to read DNA export", str(error))
                return
            show_report(result, True)
            status.set("Report ready. Save a copy only if you want to keep it.")

        root.after(100, finish)

    def save_report() -> None:
        selected = filedialog.asksaveasfilename(
            title="Save your report", defaultextension=".txt",
            initialfile="BioVerse-DNA-report.txt", filetypes=[("Text report", "*.txt")],
        )
        if not selected:
            return
        try:
            Path(selected).write_text(report.get("1.0", "end-1c"), encoding="utf-8")
        except OSError as error:
            messagebox.showerror("Unable to save report", str(error))
        else:
            status.set("Report saved.")

    def show_sample() -> None:
        show_report(SAMPLE, False)
        status.set("Viewing a synthetic example.")

    choose = ttk.Button(actions, text="Open DNA file", command=open_export)
    choose.pack(side="left")
    sample = ttk.Button(actions, text="View example", command=show_sample)
    sample.pack(side="left", padx=8)
    save = ttk.Button(actions, text="Save report", command=save_report)
    save.pack(side="right")
    show_report("Supported file formats: TXT, CSV, TSV, ZIP, and GZ.", False)
    root.mainloop()
    executor.shutdown(wait=False, cancel_futures=True)


if __name__ == "__main__":
    main()
