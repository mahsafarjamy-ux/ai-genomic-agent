"""
Brain Loader — indexes the BRAIN.md knowledge base into ChromaDB
and provides retrieval for the discovery agent.

Usage:
    python knowledge/brain_loader.py          # index all knowledge files
    python knowledge/brain_loader.py --query  # interactive retrieval test
"""

import os
import sys
import re
import argparse
from pathlib import Path
from typing import Optional

KNOWLEDGE_DIR = Path(__file__).parent
CHROMA_DIR    = KNOWLEDGE_DIR / ".chroma_db"


def get_collection():
    import chromadb
    client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    return client.get_or_create_collection(
        name="genomics_brain",
        metadata={"description": "AI Genomics Agent professor brain — comprehensive scientific knowledge"},
    )


def chunk_markdown(text: str, source: str, chunk_size: int = 800, overlap: int = 150) -> list[dict]:
    """Split markdown into overlapping chunks, preserving section headers."""
    chunks = []
    # Split on ## or ### headers to get semantic chunks
    sections = re.split(r"\n(?=#{1,3} )", text)

    for section in sections:
        if len(section.strip()) < 50:
            continue
        # Extract the header for metadata
        header_match = re.match(r"^#{1,3} (.+)", section)
        section_title = header_match.group(1).strip() if header_match else "General"

        # Sub-chunk long sections with overlap
        words = section.split()
        if len(words) <= chunk_size:
            chunks.append({
                "text": section.strip(),
                "source": source,
                "section": section_title,
            })
        else:
            for i in range(0, len(words), chunk_size - overlap):
                chunk_words = words[i:i + chunk_size]
                if len(chunk_words) < 50:
                    continue
                chunks.append({
                    "text": " ".join(chunk_words),
                    "source": source,
                    "section": section_title,
                })

    return chunks


def index_all():
    """Index all markdown files in the knowledge directory into ChromaDB."""
    from sentence_transformers import SentenceTransformer

    print("Loading embedding model (all-MiniLM-L6-v2)...")
    model = SentenceTransformer("all-MiniLM-L6-v2")

    collection = get_collection()

    # Collect markdown files — all .md files, but:
    #   • skip hidden dirs (.chroma_db, .git, etc.)
    #   • skip .venv
    #   • for skills/, only index SKILL.md (not auxiliary scripts/configs)
    all_md = [
        f for f in KNOWLEDGE_DIR.rglob("*.md")
        if not any(part.startswith(".") for part in f.parts)
        and ".venv" not in f.parts
    ]
    skills_dir = KNOWLEDGE_DIR / "skills"
    md_files = []
    for f in all_md:
        try:
            rel = f.relative_to(skills_dir)
            # inside skills/ — only keep SKILL.md at depth 1 (skills/{name}/SKILL.md)
            if f.name == "SKILL.md" and len(rel.parts) == 2:
                md_files.append(f)
        except ValueError:
            # not inside skills/ — keep it
            md_files.append(f)

    print(f"Found {len(md_files)} knowledge files to index")

    all_chunks  = []
    all_ids     = []
    all_docs    = []
    all_metas   = []

    for md_file in md_files:
        rel_path = str(md_file.relative_to(KNOWLEDGE_DIR))
        text = md_file.read_text(encoding="utf-8")
        chunks = chunk_markdown(text, source=rel_path)
        print(f"  {rel_path}: {len(chunks)} chunks")

        for i, chunk in enumerate(chunks):
            chunk_id = f"{rel_path}_{i}"
            all_ids.append(chunk_id)
            all_docs.append(chunk["text"])
            all_metas.append({"source": chunk["source"], "section": chunk["section"]})

    print(f"\nEncoding {len(all_docs)} chunks...")
    embeddings = model.encode(all_docs, batch_size=64, show_progress_bar=True).tolist()

    # Upsert in batches of 500
    batch_size = 500
    for i in range(0, len(all_ids), batch_size):
        collection.upsert(
            ids        = all_ids[i:i + batch_size],
            documents  = all_docs[i:i + batch_size],
            embeddings = embeddings[i:i + batch_size],
            metadatas  = all_metas[i:i + batch_size],
        )
        print(f"  Upserted {min(i + batch_size, len(all_ids))}/{len(all_ids)}")

    print(f"\n✓ Indexed {len(all_ids)} chunks into ChromaDB at {CHROMA_DIR}")
    return len(all_ids)


def retrieve(query: str, n_results: int = 8) -> list[dict]:
    """Retrieve the most relevant knowledge chunks for a query."""
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer("all-MiniLM-L6-v2")
    embedding = model.encode([query])[0].tolist()

    collection = get_collection()
    results = collection.query(
        query_embeddings=[embedding],
        n_results=n_results,
        include=["documents", "metadatas", "distances"],
    )

    chunks = []
    for doc, meta, dist in zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0],
    ):
        chunks.append({
            "text":      doc,
            "source":    meta.get("source", ""),
            "section":   meta.get("section", ""),
            "relevance": round(1 - dist, 3),
        })

    return chunks


def build_context_for_discovery(query: str, n_results: int = 6) -> str:
    """
    Build a rich context string from the brain for injection into
    the discovery agent's Claude prompt.
    """
    try:
        chunks = retrieve(query, n_results=n_results)
    except Exception:
        # Brain not indexed yet — fall back to graceful degradation
        return ""

    if not chunks:
        return ""

    context_parts = [
        "=== PROFESSOR BRAIN CONTEXT (retrieved from comprehensive scientific knowledge base) ===\n"
    ]

    for i, chunk in enumerate(chunks, 1):
        context_parts.append(
            f"[{i}] From: {chunk['source']} / {chunk['section']} (relevance: {chunk['relevance']})\n"
            f"{chunk['text'][:600]}...\n"
        )

    context_parts.append("=== END BRAIN CONTEXT ===\n")
    return "\n".join(context_parts)


def retrieve_skills(query: str, n_results: int = 6) -> list[dict]:
    """Retrieve the most relevant scientific skill definitions for a query."""
    chunks = retrieve(query, n_results=n_results * 3)  # over-fetch then filter
    skill_chunks = [c for c in chunks if "skills/" in c.get("source", "")]
    return skill_chunks[:n_results]


def build_skill_context(query: str, n_results: int = 5) -> str:
    """Build a context string of relevant skill instructions for the pipeline architect."""
    chunks = retrieve_skills(query, n_results=n_results)
    if not chunks:
        return ""
    parts = ["=== SCIENTIFIC SKILL INSTRUCTIONS (from K-Dense-AI/scientific-agent-skills) ===\n"]
    for i, c in enumerate(chunks, 1):
        skill_name = c["source"].split("/")[1] if "/" in c["source"] else c["source"]
        parts.append(f"[{i}] SKILL: {skill_name}\n{c['text'][:700]}...\n")
    parts.append("=== END SKILL INSTRUCTIONS ===\n")
    return "\n".join(parts)


def is_brain_indexed() -> bool:
    """Quick check whether the brain has been indexed."""
    try:
        collection = get_collection()
        count = collection.count()
        return count > 0
    except Exception:
        return False


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AI Genomics Brain Loader")
    parser.add_argument("--index",  action="store_true", default=True, help="Index all knowledge files")
    parser.add_argument("--query",  type=str, help="Test retrieval with a query")
    parser.add_argument("--count",  action="store_true", help="Show indexed chunk count")
    args = parser.parse_args()

    if args.count:
        collection = get_collection()
        print(f"Indexed chunks: {collection.count()}")
    elif args.query:
        results = retrieve(args.query)
        print(f"\nTop results for: '{args.query}'\n")
        for i, r in enumerate(results, 1):
            print(f"[{i}] {r['source']} / {r['section']} (relevance: {r['relevance']})")
            print(f"    {r['text'][:300]}...")
            print()
    else:
        index_all()
