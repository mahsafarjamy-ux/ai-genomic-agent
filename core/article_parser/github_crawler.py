"""
GitHub repository crawler: finds and extracts pipeline code from repos
referenced in scientific papers. Looks for Snakemake, Nextflow, WDL,
shell scripts, R/Python analysis scripts.
"""

import re
import asyncio
import httpx
import base64
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse


PIPELINE_FILE_PATTERNS = [
    r'Snakefile',
    r'.*\.smk$',
    r'.*\.nf$',
    r'.*\.wdl$',
    r'.*\.cwl$',
    r'workflow\.py$',
    r'.*pipeline.*\.(py|sh|R|r)$',
    r'.*analysis.*\.(py|sh|R|r)$',
    r'config\.yaml$',
    r'config\.yml$',
    r'environment\.yaml$',
    r'environment\.yml$',
    r'requirements\.txt$',
    r'Dockerfile$',
    r'docker-compose.*\.yml$',
]


class GitHubCrawler:
    def __init__(self, token: Optional[str] = None):
        headers = {"Accept": "application/vnd.github+json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        self.headers = headers

    async def crawl_repo(self, github_url: str, output_dir: Path) -> dict:
        """
        Crawl a GitHub repo URL and extract all pipeline-relevant files.
        Handles: repo root, specific subdirectory, specific file, specific branch.
        """
        output_dir.mkdir(parents=True, exist_ok=True)
        owner, repo, path, ref = self._parse_github_url(github_url)
        if not owner or not repo:
            return {"error": f"Could not parse GitHub URL: {github_url}"}

        result = {
            "repo": f"{owner}/{repo}",
            "url": github_url,
            "files": [],
            "readme": None,
            "pipeline_type": None,
        }

        async with httpx.AsyncClient(
            timeout=30.0,
            headers=self.headers,
            follow_redirects=True
        ) as client:
            # Get default branch
            repo_info = await self._api_get(client, f"repos/{owner}/{repo}")
            default_branch = ref or (repo_info.get("default_branch", "main") if repo_info else "main")

            # Fetch README
            readme = await self._fetch_readme(client, owner, repo, default_branch)
            result["readme"] = readme

            # Get file tree
            tree = await self._get_tree(client, owner, repo, default_branch, path)
            pipeline_files = [f for f in tree if self._is_pipeline_file(f)]

            # Download each pipeline file
            for file_path in pipeline_files[:50]:  # cap at 50 files
                content = await self._fetch_file(client, owner, repo, file_path, default_branch)
                if content:
                    local_path = output_dir / file_path.replace("/", "__")
                    local_path.write_text(content, encoding="utf-8")
                    result["files"].append({
                        "path": file_path,
                        "local_path": str(local_path),
                        "content": content,
                    })

        # Detect pipeline type
        all_paths = [f["path"] for f in result["files"]]
        if any("Snakefile" in p or p.endswith(".smk") for p in all_paths):
            result["pipeline_type"] = "snakemake"
        elif any(p.endswith(".nf") for p in all_paths):
            result["pipeline_type"] = "nextflow"
        elif any(p.endswith(".wdl") for p in all_paths):
            result["pipeline_type"] = "wdl"
        elif any(p.endswith(".cwl") for p in all_paths):
            result["pipeline_type"] = "cwl"
        else:
            result["pipeline_type"] = "scripts"

        return result

    def _parse_github_url(self, url: str) -> tuple:
        """Parse github.com/owner/repo[/tree/branch/path] into components."""
        url = url.rstrip("/")
        # Clean up markdown link artifacts
        url = re.sub(r'[\)\]>].*$', '', url)

        patterns = [
            r'github\.com/([^/]+)/([^/]+)/tree/([^/]+)/?(.*)',
            r'github\.com/([^/]+)/([^/]+)/blob/([^/]+)/?(.*)',
            r'github\.com/([^/]+)/([^/]+)',
        ]
        for pat in patterns:
            m = re.search(pat, url)
            if m:
                groups = m.groups()
                owner = groups[0]
                repo = groups[1].rstrip(".git")
                ref = groups[2] if len(groups) > 2 else None
                path = groups[3] if len(groups) > 3 else ""
                return owner, repo, path, ref
        return None, None, None, None

    async def _api_get(self, client: httpx.AsyncClient, endpoint: str) -> Optional[dict]:
        url = f"https://api.github.com/{endpoint}"
        try:
            r = await client.get(url)
            if r.status_code == 200:
                return r.json()
        except Exception:
            pass
        return None

    async def _get_tree(self, client, owner, repo, branch, path="") -> list[str]:
        """Get flat file list using the git tree API (recursive)."""
        data = await self._api_get(client, f"repos/{owner}/{repo}/git/trees/{branch}?recursive=1")
        if not data:
            return []
        files = [item["path"] for item in data.get("tree", []) if item["type"] == "blob"]
        if path:
            files = [f for f in files if f.startswith(path)]
        return files

    def _is_pipeline_file(self, path: str) -> bool:
        filename = Path(path).name
        for pattern in PIPELINE_FILE_PATTERNS:
            if re.match(pattern, filename, re.IGNORECASE):
                return True
        return False

    async def _fetch_file(self, client, owner, repo, path, branch) -> Optional[str]:
        data = await self._api_get(client, f"repos/{owner}/{repo}/contents/{path}?ref={branch}")
        if data and data.get("encoding") == "base64":
            try:
                return base64.b64decode(data["content"]).decode("utf-8", errors="replace")
            except Exception:
                return None
        return None

    async def _fetch_readme(self, client, owner, repo, branch) -> Optional[str]:
        data = await self._api_get(client, f"repos/{owner}/{repo}/readme?ref={branch}")
        if data and data.get("encoding") == "base64":
            try:
                return base64.b64decode(data["content"]).decode("utf-8", errors="replace")
            except Exception:
                return None
        return None


async def crawl_repos_from_urls(
    github_urls: list[str],
    output_dir: Path,
    github_token: Optional[str] = None
) -> list[dict]:
    crawler = GitHubCrawler(token=github_token)
    tasks = [crawler.crawl_repo(url, output_dir / f"repo_{i}") for i, url in enumerate(github_urls)]
    return await asyncio.gather(*tasks, return_exceptions=True)
