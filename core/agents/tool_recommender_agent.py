"""
Tool Recommender Agent: given data characteristics and study goals,
recommends the optimal tool stack from the registry — with reasoning,
alternatives, and publication benchmarks.
"""

import os
import json
from pathlib import Path
from typing import Optional
import anthropic

REGISTRY_PATH = Path(__file__).parent.parent / "tool_registry" / "registry.json"

SYSTEM_PROMPT = """You are a senior bioinformatics scientist who has benchmarked every major tool.
Given a user's data and study goals, recommend the best tool stack.
Always explain WHY each tool is recommended over alternatives.
Cite benchmark papers when possible. Flag resource requirements honestly.
Consider: accuracy, speed, RAM, community support, reproducibility, and publication standard.
Output structured JSON only."""

RECOMMENDATION_PROMPT = """Recommend the optimal bioinformatics tool stack for this study.

Analysis type: {analysis_type}
Study goal: {study_goal}
Organism: {organism}
Sequencing platform: {platform}
Data characteristics:
  - Read length: {read_length} bp
  - Paired-end: {paired_end}
  - Approximate N samples: {n_samples}
  - Approximate depth: {depth}x
  - Special considerations: {special_notes}

Available compute:
  - CPU cores: {cpu_cores}
  - RAM GB: {ram_gb}
  - Has GPU: {has_gpu}
  - Has HPC/SLURM: {has_hpc}

Available tools from registry (relevant subset):
{registry_subset}

Return JSON:
{{
  "recommended_pipeline": [
    {{
      "stage": "Quality Control",
      "tool": "FastQC",
      "version": "0.12.1",
      "docker": "biocontainers/fastqc:v0.12.1_cv2",
      "reason": "Industry standard; required for most journals",
      "alternatives": [{{"tool": "fastp", "reason": "Also generates QC report while trimming"}}],
      "estimated_time_per_sample": "2 minutes",
      "ram_gb_required": 1,
      "key_parameters": {{}},
      "benchmark_reference": "Andrews et al. 2010"
    }}
  ],
  "pipeline_type": "snakemake",
  "total_estimated_time": "4 hours per sample at 30x WGS",
  "total_ram_peak_gb": 64,
  "docker_compose_needed": true,
  "warnings": ["Note: VQSR requires >30 samples for reliable calibration"],
  "novel_tool_suggestions": ["Tools published in last 12 months that may improve results"],
  "publication_standard_notes": "What reviewers will expect to see in Methods"
}}"""


class ToolRecommenderAgent:
    def __init__(self, api_key: Optional[str] = None):
        self.client = anthropic.Anthropic(api_key=api_key or os.environ["ANTHROPIC_API_KEY"])
        self.registry = json.loads(REGISTRY_PATH.read_text())

    def recommend(
        self,
        analysis_type: str,
        study_goal: str,
        organism: str = "human",
        platform: str = "Illumina NovaSeq",
        read_length: int = 150,
        paired_end: bool = True,
        n_samples: int = 10,
        depth: int = 30,
        cpu_cores: int = 16,
        ram_gb: int = 64,
        has_gpu: bool = False,
        has_hpc: bool = False,
        special_notes: str = "",
    ) -> dict:
        # Pull the relevant section from the registry
        cat = self.registry["categories"].get(analysis_type.lower(), {})
        registry_subset = json.dumps(cat, indent=2)[:6000]

        prompt = RECOMMENDATION_PROMPT.format(
            analysis_type=analysis_type,
            study_goal=study_goal,
            organism=organism,
            platform=platform,
            read_length=read_length,
            paired_end=paired_end,
            n_samples=n_samples,
            depth=depth,
            special_notes=special_notes or "None",
            cpu_cores=cpu_cores,
            ram_gb=ram_gb,
            has_gpu=has_gpu,
            has_hpc=has_hpc,
            registry_subset=registry_subset,
        )

        response = self.client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}]
        )

        import re
        content = response.content[0].text.strip()
        content = re.sub(r'^```[a-z]*\n?', '', content)
        content = re.sub(r'\n?```$', '', content)

        try:
            result = json.loads(content)
        except json.JSONDecodeError:
            match = re.search(r'\{[\s\S]+\}', content)
            result = json.loads(match.group()) if match else {"error": "parse failed", "raw": content}

        result["analysis_type"] = analysis_type
        result["input_params"] = {
            "organism": organism, "platform": platform, "read_length": read_length,
            "n_samples": n_samples, "depth": depth, "ram_gb": ram_gb,
        }
        return result

    def list_analysis_types(self) -> list[dict]:
        return [
            {"id": k, "name": v["name"], "description": v["description"]}
            for k, v in self.registry["categories"].items()
        ]

    def get_tool_info(self, tool_name: str) -> Optional[dict]:
        """Find a tool anywhere in the registry."""
        tool_lower = tool_name.lower()
        for cat_data in self.registry["categories"].values():
            for stage_data in cat_data.get("stages", {}).values():
                tools = stage_data if isinstance(stage_data, list) else []
                for tool in tools:
                    if isinstance(tool, dict) and tool.get("tool", "").lower() == tool_lower:
                        return tool
        return None

    def compare_tools(self, tool_a: str, tool_b: str, context: str) -> dict:
        """Ask Claude to compare two specific tools head-to-head."""
        info_a = self.get_tool_info(tool_a) or {"tool": tool_a}
        info_b = self.get_tool_info(tool_b) or {"tool": tool_b}

        response = self.client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            messages=[{
                "role": "user",
                "content": f"""Compare {tool_a} vs {tool_b} for this use case: {context}

Tool A info: {json.dumps(info_a)}
Tool B info: {json.dumps(info_b)}

Return JSON with: winner, reasoning, accuracy_comparison, speed_comparison,
memory_comparison, ease_of_use, community_support, when_to_choose_a, when_to_choose_b"""
            }]
        )
        import re
        content = response.content[0].text.strip()
        content = re.sub(r'^```[a-z]*\n?', '', content)
        content = re.sub(r'\n?```$', '', content)
        try:
            return json.loads(content)
        except Exception:
            return {"comparison": content}
