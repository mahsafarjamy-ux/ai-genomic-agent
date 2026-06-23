"""
Error Detective Agent: monitors pipeline logs, detects failures, proposes fixes,
and submits them for human approval before retrying.
"""

import os
import re
import json
from pathlib import Path
from typing import Optional
import anthropic


SYSTEM_PROMPT = """You are an expert bioinformatics pipeline debugger.
Analyze pipeline error logs and propose specific, safe fixes.
Always explain what went wrong, why, and exactly what command or config change to apply.
Classify severity: FATAL (cannot continue), RECOVERABLE (retry with fix), WARNING (note but continue).
Output JSON only."""

FIX_PROMPT = """A bioinformatics pipeline has failed. Diagnose and propose a fix.

Pipeline step: {step_name}
Tool: {tool} {version}
Command run:
{command}

Error output (last 100 lines):
{error_log}

Pipeline configuration:
{config}

Return JSON:
{{
  "severity": "FATAL|RECOVERABLE|WARNING",
  "root_cause": "one-line summary",
  "explanation": "detailed explanation of what went wrong",
  "proposed_fix": {{
    "type": "parameter_change|command_change|resource_increase|dependency_install|file_fix|skip_step",
    "description": "what to change",
    "before": "original command or config",
    "after": "fixed command or config",
    "safe_to_autofix": true,
    "requires_human_approval": false
  }},
  "alternative_fixes": [],
  "reference_links": []
}}"""


class ErrorDetectiveAgent:
    def __init__(self, api_key: Optional[str] = None):
        self.client = anthropic.Anthropic(api_key=api_key or os.environ["ANTHROPIC_API_KEY"])
        self.fix_history: list[dict] = []

    def analyze_failure(
        self,
        step_name: str,
        tool: str,
        version: str,
        command: str,
        log_path: str | Path,
        config: dict,
    ) -> dict:
        """
        Read the error log and ask Claude for a diagnosis + fix proposal.
        Never auto-applies changes — returns for human approval.
        """
        log_path = Path(log_path)
        error_log = self._extract_error_tail(log_path)

        prompt = FIX_PROMPT.format(
            step_name=step_name,
            tool=tool,
            version=version,
            command=command,
            error_log=error_log,
            config=json.dumps(config, indent=2)[:2000],
        )

        response = self.client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}]
        )

        content = response.content[0].text.strip()
        content = re.sub(r'^```[a-z]*\n?', '', content)
        content = re.sub(r'\n?```$', '', content)

        try:
            diagnosis = json.loads(content)
        except json.JSONDecodeError:
            match = re.search(r'\{[\s\S]+\}', content)
            diagnosis = json.loads(match.group()) if match else {"error": "parse failed", "raw": content}

        diagnosis["step"] = step_name
        diagnosis["tool"] = tool
        diagnosis["log_path"] = str(log_path)
        diagnosis["status"] = "pending_approval"

        self.fix_history.append(diagnosis)
        return diagnosis

    def apply_fix(self, diagnosis: dict, approved: bool, user_comment: str = "") -> dict:
        """
        Called after human approves/rejects a fix.
        Returns the modified command/config to use on retry.
        """
        if not approved:
            diagnosis["status"] = "rejected"
            diagnosis["user_comment"] = user_comment
            return diagnosis

        diagnosis["status"] = "approved"
        diagnosis["user_comment"] = user_comment

        fix = diagnosis.get("proposed_fix", {})
        return {
            "approved": True,
            "fix_type": fix.get("type"),
            "new_command": fix.get("after"),
            "description": fix.get("description"),
        }

    def _extract_error_tail(self, log_path: Path, lines: int = 100) -> str:
        """Read the last N lines of a log file without loading it all into memory."""
        if not log_path.exists():
            return "(log file not found)"
        try:
            with open(log_path, "rb") as f:
                f.seek(0, 2)
                file_size = f.tell()
                chunk = min(file_size, 8000)
                f.seek(-chunk, 2)
                tail = f.read().decode("utf-8", errors="replace")
            return "\n".join(tail.split("\n")[-lines:])
        except Exception as e:
            return f"(could not read log: {e})"

    def common_error_patterns(self, error_log: str) -> list[str]:
        """Quick pattern match for known errors before calling Claude (saves API cost)."""
        patterns = {
            r"out of memory|OOM|killed|oom_kill": "Insufficient memory — increase --mem parameter",
            r"no space left on device": "Disk full — free up space or change output directory",
            r"command not found|not found in PATH": "Tool not installed or not in PATH",
            r"permission denied": "File permission error",
            r"file not found|no such file": "Input file missing — check data directory",
            r"index out of range|segmentation fault": "Possible corrupt input file",
            r"connection refused|timeout": "Network issue (for reference download steps)",
            r"java.*heap": "Java heap space — increase -Xmx parameter",
        }
        found = []
        lower_log = error_log.lower()
        for pat, msg in patterns.items():
            if re.search(pat, lower_log):
                found.append(msg)
        return found
