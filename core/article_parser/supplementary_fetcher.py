"""
Fetches supplementary materials linked from scientific papers.
Handles journal-specific supplementary pages, figshare, zenodo, OSF, Dryad.
"""

import re
import asyncio
import httpx
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin, urlparse


JOURNAL_SUPPLEMENTARY_PATTERNS = {
    "nature.com": _fetch_nature_supplementary,
    "cell.com": _fetch_cell_supplementary,
    "science.org": _fetch_science_supplementary,
    "biorxiv.org": _fetch_biorxiv_supplementary,
    "medrxiv.org": _fetch_biorxiv_supplementary,
    "ncbi.nlm.nih.gov": _fetch_pmc_supplementary,
    "pmc.ncbi.nlm.nih.gov": _fetch_pmc_supplementary,
    "elifesciences.org": _fetch_elife_supplementary,
    "figshare.com": _fetch_figshare,
    "zenodo.org": _fetch_zenodo,
    "osf.io": _fetch_osf,
    "datadryad.org": _fetch_dryad,
}


async def fetch_all_supplementary(
    urls: list[str],
    output_dir: Path,
    doi: Optional[str] = None
) -> list[dict]:
    """
    Download all supplementary materials for a paper.
    Returns list of {url, local_path, content_type, text_content}.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    results = []

    async with httpx.AsyncClient(
        timeout=60.0,
        follow_redirects=True,
        headers={"User-Agent": "AI-Genomics-Agent/1.0 (academic research tool)"}
    ) as client:
        tasks = [_fetch_url(client, url, output_dir) for url in urls]
        fetched = await asyncio.gather(*tasks, return_exceptions=True)

    for url, result in zip(urls, fetched):
        if isinstance(result, Exception):
            results.append({"url": url, "error": str(result)})
        else:
            results.append(result)

    return results


async def _fetch_url(client: httpx.AsyncClient, url: str, output_dir: Path) -> dict:
    """Download a single URL, detecting file type and extracting text if possible."""
    response = await client.get(url)
    response.raise_for_status()

    content_type = response.headers.get("content-type", "")
    filename = _url_to_filename(url, content_type)
    local_path = output_dir / filename

    local_path.write_bytes(response.content)

    result = {
        "url": url,
        "local_path": str(local_path),
        "content_type": content_type,
        "text_content": None,
    }

    # Extract text from HTML pages
    if "text/html" in content_type:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(response.text, "html.parser")
        # Remove scripts/styles
        for tag in soup(["script", "style", "nav", "footer"]):
            tag.decompose()
        result["text_content"] = soup.get_text(separator="\n", strip=True)
        # Look for PDF/code links in the page
        result["nested_links"] = _extract_links_from_html(soup, url)

    elif "application/pdf" in content_type:
        # Parse the supplementary PDF too
        from .pdf_parser import extract_text_and_links
        parsed = extract_text_and_links(local_path)
        result["text_content"] = parsed["text"]
        result["nested_github_urls"] = parsed["github_urls"]

    elif any(ext in url for ext in [".py", ".R", ".sh", ".smk", ".nf", ".wdl", ".cwl"]):
        result["text_content"] = response.text
        result["is_code"] = True

    return result


def _extract_links_from_html(soup, base_url: str) -> list[str]:
    """Find all relevant links (PDFs, code files, GitHub) in an HTML page."""
    links = []
    for a in soup.find_all("a", href=True):
        href = urljoin(base_url, a["href"])
        if any(kw in href.lower() for kw in [
            ".pdf", ".zip", ".tar", ".gz", ".R", ".py", ".sh", ".smk", ".nf",
            "github.com", "zenodo", "figshare", "supplementary", "suppl", "code"
        ]):
            links.append(href)
    return links


def _url_to_filename(url: str, content_type: str) -> str:
    parsed = urlparse(url)
    name = Path(parsed.path).name or "supplementary"
    if not Path(name).suffix:
        ext_map = {
            "application/pdf": ".pdf",
            "text/html": ".html",
            "application/zip": ".zip",
            "text/plain": ".txt",
        }
        for mime, ext in ext_map.items():
            if mime in content_type:
                name += ext
                break
    return re.sub(r'[^\w\.\-]', '_', name)


# Journal-specific fetchers (returns list of supplementary URLs)

async def _fetch_nature_supplementary(client, doi):
    url = f"https://www.nature.com/articles/{doi.split('/')[-1]}"
    r = await client.get(url)
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(r.text, "html.parser")
    links = []
    for a in soup.select("a[data-track-action='supplementary material']"):
        links.append(urljoin(url, a["href"]))
    return links


async def _fetch_biorxiv_supplementary(client, doi):
    # bioRxiv supplementary files are listed on the paper page
    url = f"https://www.biorxiv.org/content/{doi}"
    r = await client.get(url + "v1")
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(r.text, "html.parser")
    links = []
    for a in soup.select("a.article-dl-pdf-link, a[href*='supplementary']"):
        href = urljoin(url, a.get("href", ""))
        if href:
            links.append(href)
    return links


async def _fetch_pmc_supplementary(client, doi):
    pmcid = doi
    url = f"https://www.ncbi.nlm.nih.gov/pmc/articles/{pmcid}/"
    r = await client.get(url)
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(r.text, "html.parser")
    links = []
    for a in soup.select(".supplementary-material a, .sup-data a"):
        href = urljoin(url, a.get("href", ""))
        if href:
            links.append(href)
    return links


async def _fetch_cell_supplementary(client, doi):
    url = f"https://www.cell.com/action/downloadSupplement?doi={doi}"
    r = await client.get(url)
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(r.text, "html.parser")
    return [urljoin(url, a["href"]) for a in soup.select("a[href*='supplement']")]


async def _fetch_science_supplementary(client, doi):
    url = f"https://www.science.org/doi/{doi}"
    r = await client.get(url)
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(r.text, "html.parser")
    return [urljoin(url, a["href"]) for a in soup.select("a[href*='suppl']")]


async def _fetch_elife_supplementary(client, doi):
    article_id = doi.split(".")[-1]
    url = f"https://elifesciences.org/articles/{article_id}"
    r = await client.get(url)
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(r.text, "html.parser")
    return [urljoin(url, a["href"]) for a in soup.select("a[data-download]")]


async def _fetch_figshare(client, url):
    # Figshare has an API
    match = re.search(r'(\d+)', url)
    if match:
        article_id = match.group(1)
        api_url = f"https://api.figshare.com/v2/articles/{article_id}/files"
        r = await client.get(api_url)
        if r.status_code == 200:
            return [f["download_url"] for f in r.json()]
    return []


async def _fetch_zenodo(client, url):
    record_id = url.rstrip("/").split("/")[-1]
    api_url = f"https://zenodo.org/api/records/{record_id}"
    r = await client.get(api_url)
    if r.status_code == 200:
        return [f["links"]["self"] for f in r.json().get("files", [])]
    return []


async def _fetch_osf(client, url):
    node_id = url.rstrip("/").split("/")[-1]
    api_url = f"https://api.osf.io/v2/nodes/{node_id}/files/"
    r = await client.get(api_url)
    if r.status_code == 200:
        return [f["links"]["download"] for f in r.json().get("data", [])]
    return []


async def _fetch_dryad(client, url):
    doi = url.split("dryad.")[-1]
    api_url = f"https://datadryad.org/api/v2/datasets/doi:10.5061%2Fdryad.{doi}/files"
    r = await client.get(api_url)
    if r.status_code == 200:
        return [f["_links"]["self"]["href"] for f in r.json().get("_embedded", {}).get("stash:files", [])]
    return []
