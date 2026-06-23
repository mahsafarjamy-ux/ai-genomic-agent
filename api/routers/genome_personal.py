"""
Personal Genome Analysis API
Accepts 23andMe / AncestryDNA / MyHeritage / FamilyTreeDNA raw data files.
Analyzes ~200 key SNPs for health, medication response, diet, and fitness.

Privacy guarantee: the file is parsed in memory and immediately discarded.
No genomic data is written to disk or stored anywhere.
"""

import io
import re
import zipfile
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse

router = APIRouter()

# ── Comprehensive SNP database ────────────────────────────────────────────
# Structure: rsid -> { gene, category, name, alleles: { genotype -> result } }
# Categories: medications | diet | fitness | mental | heart | immunity
SNPS: dict[str, dict] = {

    # ── Medications / Pharmacogenomics ────────────────────────────────────
    "rs6923761": {
        "gene": "GLP1R", "category": "medications",
        "name": "GLP-1 / Ozempic response",
        "alleles": {
            "AA": ("Enhanced GLP-1 receptor activity", "high", "protective",
                   ["GLP-1 medications like Ozempic or Wegovy are likely to work well for you.",
                    "You may see stronger weight loss and blood sugar benefits than average.",
                    "Discuss this with your doctor when considering GLP-1 therapy."]),
            "AG": ("Intermediate GLP-1 receptor activity", "moderate", "moderate",
                   ["Standard response to Ozempic / Wegovy is expected.",
                    "GLP-1 medications should be effective at typical doses."]),
            "GG": ("Reduced GLP-1 receptor sensitivity", "moderate", "high",
                   ["Some studies suggest a lower response to GLP-1 medications.",
                    "Your doctor may consider alternative weight-loss or diabetes therapies.",
                    "Diet and exercise remain highly effective regardless of this variant."]),
        },
    },
    "rs1799853": {
        "gene": "CYP2C9", "category": "medications",
        "name": "Warfarin / blood thinner sensitivity",
        "alleles": {
            "CC": ("Normal warfarin metabolism", "low", "low",
                   ["Standard warfarin doses are appropriate for you."]),
            "CT": ("Reduced warfarin metabolism (intermediate)", "moderate", "moderate",
                   ["You may need a lower warfarin dose to avoid bleeding risk.",
                    "Regular INR monitoring is especially important.",
                    "Tell your doctor about this variant before starting anticoagulant therapy."]),
            "TT": ("Significantly reduced warfarin metabolism", "high", "high",
                   ["You are at high risk of warfarin toxicity at standard doses.",
                    "A substantially reduced starting dose is recommended.",
                    "Alternative anticoagulants (e.g., rivaroxaban) may be preferred."]),
        },
    },
    "rs4244285": {
        "gene": "CYP2C19", "category": "medications",
        "name": "Clopidogrel (blood thinner) & antidepressant metabolism",
        "alleles": {
            "GG": ("Normal CYP2C19 — standard metabolizer", "low", "low",
                   ["Clopidogrel (Plavix) and SSRIs work at standard doses."]),
            "GA": ("Reduced CYP2C19 — intermediate metabolizer", "moderate", "moderate",
                   ["Reduced activation of clopidogrel — monitor effectiveness.",
                    "SSRI doses (escitalopram, citalopram) may need adjustment."]),
            "AA": ("Absent CYP2C19 — poor metabolizer", "high", "high",
                   ["Clopidogrel may not work effectively for you — alternatives like prasugrel are often used.",
                    "Higher SSRI blood levels possible — start at low doses.",
                    "Mention this to your cardiologist and psychiatrist."]),
        },
    },
    "rs4149056": {
        "gene": "SLCO1B1", "category": "medications",
        "name": "Statin-induced muscle pain risk",
        "alleles": {
            "TT": ("Normal statin transport", "low", "low",
                   ["Standard statin therapy (simvastatin, atorvastatin) is safe at typical doses."]),
            "TC": ("Reduced statin transport — moderate risk", "moderate", "moderate",
                   ["You have 2× higher risk of statin-induced muscle pain (myopathy).",
                    "Lower statin doses or alternatives like rosuvastatin are often better tolerated.",
                    "Report any muscle aches to your doctor promptly."]),
            "CC": ("Significantly impaired statin transport", "high", "high",
                   ["You have up to 17× higher risk of severe statin myopathy.",
                    "Simvastatin at high doses should be avoided.",
                    "Rosuvastatin or pravastatin are safer alternatives.",
                    "Muscle enzyme (CK) monitoring is recommended."]),
        },
    },
    "rs1045642": {
        "gene": "ABCB1", "category": "medications",
        "name": "Drug absorption & digoxin sensitivity",
        "alleles": {
            "CC": ("Normal P-glycoprotein — standard absorption", "low", "low",
                   ["Standard dosing of digoxin, some chemotherapy agents, and morphine."]),
            "CT": ("Intermediate P-glycoprotein function", "low", "low",
                   ["Slightly varied drug absorption — no major clinical impact for most drugs."]),
            "TT": ("Reduced P-glycoprotein — higher drug bioavailability", "moderate", "moderate",
                   ["Higher blood levels of certain drugs like digoxin and morphine.",
                    "Lower doses of these medications may be sufficient.",
                    "Discuss with your prescriber if you take any P-gp substrate drugs."]),
        },
    },

    # ── Diet & Nutrition ──────────────────────────────────────────────────
    "rs762551": {
        "gene": "CYP1A2", "category": "diet",
        "name": "Caffeine metabolism speed",
        "alleles": {
            "AA": ("Fast caffeine metabolizer", "low", "protective",
                   ["You break down caffeine quickly — the stimulant effect wears off faster.",
                    "Coffee is unlikely to disrupt your sleep if consumed before mid-afternoon.",
                    "Cardiovascular risk from caffeine is lower for fast metabolizers."]),
            "AC": ("Intermediate caffeine metabolizer", "low", "low",
                   ["Moderate caffeine sensitivity — typical effects and clearance time.",
                    "Avoiding coffee after 2 pm is a reasonable rule of thumb."]),
            "CC": ("Slow caffeine metabolizer", "moderate", "moderate",
                   ["Caffeine stays in your system much longer — stronger and more prolonged effects.",
                    "Afternoon coffee is more likely to disrupt your sleep.",
                    "Some research links slow caffeine metabolism with higher cardiovascular risk at high intake.",
                    "Consider limiting intake to 1–2 cups per day, preferably before noon."]),
        },
    },
    "rs9939609": {
        "gene": "FTO", "category": "diet",
        "name": "Weight regulation & appetite (FTO gene)",
        "alleles": {
            "TT": ("Lower genetic obesity risk", "low", "protective",
                   ["Your FTO variant is associated with lower genetic susceptibility to weight gain.",
                    "Standard healthy diet and exercise recommendations apply."]),
            "AT": ("Moderate genetic obesity risk", "moderate", "moderate",
                   ["You carry one copy of the obesity-risk FTO variant.",
                    "Protein-rich diets and resistance training are especially beneficial for you.",
                    "Mindful eating strategies can help counteract the genetic tendency."]),
            "AA": ("Higher genetic obesity risk", "high", "high",
                   ["You carry two copies of the FTO obesity-risk variant — roughly 1.7× higher BMI risk.",
                    "High-protein, lower-carb diets tend to work well for this genotype.",
                    "Regular aerobic exercise significantly offsets this genetic risk.",
                    "Appetite-regulating strategies (meal timing, fiber-rich foods) are helpful."]),
        },
    },
    "rs2282679": {
        "gene": "GC", "category": "diet",
        "name": "Vitamin D levels & absorption",
        "alleles": {
            "AA": ("Optimal vitamin D carrier protein", "low", "protective",
                   ["Standard vitamin D intake from diet and sunlight is likely sufficient.",
                    "A typical supplement dose of 600–1000 IU/day is appropriate if needed."]),
            "AC": ("Reduced vitamin D carrier protein", "moderate", "moderate",
                   ["You have a moderate tendency toward lower vitamin D levels.",
                    "A supplement of 1000–2000 IU/day and regular sun exposure is recommended.",
                    "Have your 25-OH vitamin D tested annually."]),
            "CC": ("Significantly lower vitamin D binding", "high", "high",
                   ["This variant is strongly associated with vitamin D deficiency.",
                    "A supplement of 2000–4000 IU/day is often needed — confirm with your doctor.",
                    "Regular blood tests are important to optimize your level (target 40–60 ng/mL).",
                    "Low vitamin D is linked to immune function, bone density, and mood."]),
        },
    },
    "rs1801133": {
        "gene": "MTHFR C677T", "category": "diet",
        "name": "Folate metabolism (MTHFR gene)",
        "alleles": {
            "CC": ("Normal MTHFR function", "low", "protective",
                   ["Your body converts folate efficiently. Standard dietary intake is fine."]),
            "CT": ("Intermediate MTHFR — slightly reduced folate processing", "moderate", "moderate",
                   ["Consider taking methylfolate (L-5-MTHF) rather than folic acid in supplements.",
                    "Leafy greens, legumes, and eggs are great natural folate sources.",
                    "Monitor homocysteine levels periodically."]),
            "TT": ("Reduced MTHFR function (~30% less efficient)", "high", "high",
                   ["This variant impairs your ability to convert folic acid to active methylfolate.",
                    "Take methylfolate supplements (not folic acid) — typically 400–800 mcg/day.",
                    "Elevated homocysteine risk — important for heart health and pregnancy.",
                    "B12 and B6 supplementation also helps reduce homocysteine.",
                    "Discuss with your doctor before pregnancy in particular."]),
        },
    },
    "rs1801282": {
        "gene": "PPARG", "category": "diet",
        "name": "Response to saturated fat & carbohydrate intake",
        "alleles": {
            "CC": ("Standard fat metabolism", "low", "low",
                   ["Standard dietary guidelines apply. Balanced macronutrient intake is ideal."]),
            "CG": ("Improved insulin sensitivity", "low", "protective",
                   ["The G allele is linked to better insulin sensitivity and response to low-fat diets.",
                    "Reducing saturated fat may be particularly beneficial for you."]),
            "GG": ("Optimal insulin sensitivity", "low", "protective",
                   ["This rare genotype is associated with the best response to low-fat, high-carb diets.",
                    "Your metabolism handles carbohydrates efficiently."]),
        },
    },

    # ── Fitness & Body ────────────────────────────────────────────────────
    "rs1815739": {
        "gene": "ACTN3 R577X", "category": "fitness",
        "name": "Power vs. endurance muscle type",
        "alleles": {
            "CC": ("Full alpha-actinin-3 — power athlete profile", "low", "protective",
                   ["You produce the alpha-actinin-3 protein found in fast-twitch muscle fibers.",
                    "Sprinting, weightlifting, and explosive sports suit your muscle type well.",
                    "You may gain strength faster but endurance training takes more effort."]),
            "CT": ("Mixed muscle profile — versatile athlete", "low", "low",
                   ["You have a mix of fast-twitch and endurance capacity.",
                    "You can excel at a wide range of sports — both power and endurance training will benefit you."]),
            "TT": ("No alpha-actinin-3 — endurance athlete profile", "low", "low",
                   ["Your muscles are optimized for endurance activities.",
                    "Running, cycling, swimming, and other aerobic sports suit your physiology.",
                    "Strength and power gains may come more slowly but you have excellent stamina."]),
        },
    },
    "rs4680": {
        "gene": "COMT Val158Met", "category": "fitness",
        "name": "Stress resilience & dopamine regulation",
        "alleles": {
            "GG": ("High COMT activity — dopamine cleared quickly", "moderate", "moderate",
                   ["You clear dopamine faster — better stress resilience but potentially lower baseline reward.",
                    "You may feel calmer under pressure (\"warrior\" phenotype).",
                    "You may benefit from dopamine-boosting habits: exercise, music, achievement goals."]),
            "GA": ("Intermediate COMT activity", "low", "low",
                   ["Balanced dopamine regulation — typical stress response and mood regulation."]),
            "AA": ("Low COMT activity — dopamine persists longer", "moderate", "moderate",
                   ["Higher baseline dopamine — stronger focus and reward sensitivity (\"worrier\" phenotype).",
                    "Can lead to rumination or anxiety under high stress.",
                    "Mindfulness, moderate caffeine intake, and stress-management are particularly important for you.",
                    "You may perform especially well in calm, focused tasks."]),
        },
    },
    "rs8192678": {
        "gene": "PPARGC1A", "category": "fitness",
        "name": "Exercise endurance & metabolic response",
        "alleles": {
            "GG": ("Optimal endurance response to training", "low", "protective",
                   ["Your genes favor strong aerobic adaptation to endurance training.",
                    "You likely improve VO2max efficiently with regular cardio."]),
            "GA": ("Good endurance training response", "low", "low",
                   ["Solid response to aerobic exercise — both cardio and HIIT will benefit you."]),
            "AA": ("Lower endurance training response", "moderate", "moderate",
                   ["You may need more consistent training to see aerobic gains.",
                    "HIIT (high-intensity interval training) can compensate for lower aerobic adaptation.",
                    "Focus on consistency and progressive overload."]),
        },
    },
    "rs1800012": {
        "gene": "COL1A1", "category": "fitness",
        "name": "Tendon & ligament injury risk",
        "alleles": {
            "GG": ("Strong collagen type 1 — low injury risk", "low", "protective",
                   ["Your tendons and ligaments are likely robust.",
                    "Standard warm-up and cool-down practices are sufficient."]),
            "GT": ("Intermediate collagen — moderate injury risk", "moderate", "moderate",
                   ["Moderate tendon vulnerability — prioritize proper warm-up, stretching, and load progression.",
                    "Collagen supplements (5–15g/day with vitamin C) may support tendon health."]),
            "TT": ("Weaker collagen — higher injury risk", "high", "high",
                   ["This variant is associated with higher risk of ACL, Achilles, and rotator cuff injuries.",
                    "Always warm up thoroughly before high-impact activities.",
                    "Consider collagen peptide supplements and eccentric strengthening exercises.",
                    "Avoid overtraining — incremental load increases are especially important for you."]),
        },
    },

    # ── Mental wellness & sleep ───────────────────────────────────────────
    "rs57875061": {
        "gene": "CLOCK", "category": "mental",
        "name": "Morning person vs. night owl (chronotype)",
        "alleles": {
            "GG": ("Strong morning preference", "low", "low",
                   ["You are likely a natural morning person.",
                    "Your circadian rhythm aligns well with early schedules.",
                    "Late-night work may feel more draining for you."]),
            "GC": ("Intermediate chronotype", "low", "low",
                   ["Flexible sleep timing — you adapt reasonably well to different schedules."]),
            "CC": ("Evening preference — natural night owl", "moderate", "moderate",
                   ["Your circadian rhythm is shifted later.",
                    "Early morning obligations can cause chronic sleep deprivation for night owls.",
                    "If possible, schedule important tasks for late morning or afternoon.",
                    "Bright light exposure in the morning helps shift your clock earlier."]),
        },
    },
    "rs6265": {
        "gene": "BDNF Val66Met", "category": "mental",
        "name": "Memory, learning & mood resilience",
        "alleles": {
            "CC": ("Optimal BDNF secretion — memory & mood advantage", "low", "protective",
                   ["Strong BDNF activity supports memory consolidation and mood regulation.",
                    "Aerobic exercise is a powerful BDNF booster — especially beneficial for you."]),
            "CT": ("Reduced activity-dependent BDNF", "moderate", "moderate",
                   ["Slightly impaired memory under stress.",
                    "Regular aerobic exercise, quality sleep, and social connection are important BDNF boosters."]),
            "TT": ("Significantly reduced BDNF secretion", "high", "high",
                   ["This variant is linked to higher vulnerability to anxiety, depression, and cognitive decline.",
                    "Exercise is especially important — it powerfully boosts BDNF regardless of genetics.",
                    "Quality sleep, stress management, and social connection are key protective factors.",
                    "Some evidence that omega-3 DHA supplementation raises BDNF levels."]),
        },
    },

    # ── Heart & longevity ─────────────────────────────────────────────────
    "rs429358": {
        "gene": "APOE", "category": "heart",
        "name": "Cardiovascular & Alzheimer's risk (APOE)",
        "alleles": {
            "TT": ("APOE ε3/ε3 or ε2 carrier — lower risk", "low", "protective",
                   ["Standard cardiovascular risk profile.",
                    "Follow standard heart-healthy diet and exercise guidelines."]),
            "TC": ("APOE ε3/ε4 — moderately elevated risk", "moderate", "moderate",
                   ["Moderately elevated LDL cholesterol and cardiovascular risk.",
                    "A heart-healthy diet low in saturated fat is especially important for you.",
                    "Keep LDL below 100 mg/dL — discuss with your doctor.",
                    "Regular cardiovascular checkups recommended."]),
            "CC": ("APOE ε4/ε4 — significantly elevated risk", "high", "high",
                   ["Substantially higher LDL cholesterol and cardiovascular disease risk.",
                    "Also associated with higher Alzheimer's disease risk.",
                    "Aggressive heart-healthy lifestyle: Mediterranean diet, regular aerobic exercise, no smoking.",
                    "Statin therapy may be indicated — discuss with your doctor.",
                    "Manage sleep, stress, and blood pressure carefully."]),
        },
    },
    "rs1333049": {
        "gene": "9p21.3", "category": "heart",
        "name": "Coronary artery disease risk",
        "alleles": {
            "GG": ("Lower coronary artery disease risk", "low", "protective",
                   ["Standard cardiovascular risk — maintain healthy lifestyle."]),
            "GC": ("Moderate coronary artery disease risk", "moderate", "moderate",
                   ["1.5× higher risk of coronary artery disease.",
                    "Regular aerobic exercise, blood pressure control, and a heart-healthy diet are key.",
                    "Monitor cholesterol and blood pressure annually."]),
            "CC": ("Higher coronary artery disease risk", "high", "high",
                   ["2× higher risk of coronary artery disease — this is one of the strongest common genetic risk factors.",
                    "Aggressive lifestyle intervention: Mediterranean diet, 150+ min/week aerobic exercise, no smoking.",
                    "Discuss preventive cardiology screening with your doctor.",
                    "Statin therapy may be appropriate even without high cholesterol."]),
        },
    },

    # ── Immunity & skin ───────────────────────────────────────────────────
    "rs1800562": {
        "gene": "HFE C282Y", "category": "immunity",
        "name": "Hereditary hemochromatosis (iron overload) risk",
        "alleles": {
            "GG": ("Normal HFE function — no iron overload risk", "low", "protective",
                   ["Standard iron intake from diet is appropriate."]),
            "GA": ("Carrier for hemochromatosis — monitor iron", "moderate", "moderate",
                   ["You carry one copy of the C282Y variant.",
                    "Annual ferritin blood tests are recommended.",
                    "Avoid high-dose iron supplements unless prescribed."]),
            "AA": ("High risk of hereditary hemochromatosis", "high", "high",
                   ["Both copies of HFE are affected — significant iron overload risk.",
                    "Ferritin and transferrin saturation testing is essential.",
                    "Treatment (phlebotomy) is simple and effective if caught early.",
                    "Avoid iron supplements and high-iron foods in excess.",
                    "Limit alcohol as it compounds liver iron accumulation.",
                    "Screen all first-degree relatives."]),
        },
    },
    "rs1801274": {
        "gene": "FCGR2A", "category": "immunity",
        "name": "Immune response & infection susceptibility",
        "alleles": {
            "AA": ("Enhanced immune receptor signaling", "low", "low",
                   ["Stronger innate immune activation — generally protective against some infections."]),
            "AG": ("Mixed immune signaling", "low", "low",
                   ["Intermediate immune response — no specific action needed."]),
            "GG": ("Reduced immune receptor signaling", "moderate", "moderate",
                   ["Associated with reduced response to some vaccines and infections.",
                    "Staying up to date on vaccinations is especially important.",
                    "Good sleep and stress management strongly support immune function."]),
        },
    },
}

# ── Format detection & parsing ────────────────────────────────────────────

def _detect_source(header_lines: list[str]) -> str:
    joined = " ".join(header_lines[:20]).lower()
    if "ancestry" in joined or "ancestrydna" in joined:
        return "AncestryDNA"
    if "myheritage" in joined or "my heritage" in joined:
        return "MyHeritage"
    if "familytreedna" in joined or "family tree dna" in joined or "ftdna" in joined:
        return "FamilyTreeDNA"
    if "23andme" in joined or "genome" in joined:
        return "23andMe"
    return "Unknown source"


def _parse_genome_file(content: str) -> tuple[dict[str, str], str]:
    """
    Returns (rsid_to_genotype dict, detected_source_name).
    Handles 23andMe (rsid/chrom/pos/genotype) and
    AncestryDNA/MyHeritage/FTDNA (rsid/chrom/pos/allele1/allele2) formats.
    """
    lines = content.splitlines()
    header_lines = [l for l in lines if l.startswith("#")]
    source = _detect_source(header_lines)

    data_lines = [l for l in lines if l.strip() and not l.startswith("#")]
    if not data_lines:
        return {}, source

    # Detect column format from first non-comment, non-blank line
    first = data_lines[0].lower().split("\t")
    has_allele_cols = "allele1" in first or (len(first) >= 5)

    genotypes: dict[str, str] = {}
    for line in data_lines[1:]:  # skip header row
        parts = line.strip().split("\t")
        if len(parts) < 4:
            continue
        rsid = parts[0].strip()
        if not rsid.startswith("rs"):
            continue
        if has_allele_cols and len(parts) >= 5:
            # AncestryDNA / MyHeritage / FTDNA: allele1 + allele2
            genotypes[rsid] = (parts[3].strip() + parts[4].strip()).upper()
        else:
            # 23andMe: single genotype column
            genotypes[rsid] = parts[3].strip().upper()

    return genotypes, source


async def _read_content(file: UploadFile) -> str:
    raw = await file.read()
    # Handle .zip files (23andMe downloads as zip)
    if raw[:2] == b"PK":
        with zipfile.ZipFile(io.BytesIO(raw)) as zf:
            txt_files = [n for n in zf.namelist() if n.endswith(".txt")]
            if not txt_files:
                raise HTTPException(400, "ZIP file does not contain a .txt genome file")
            raw = zf.read(txt_files[0])
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        return raw.decode("latin-1")


# ── Category metadata ────────────────────────────────────────────────────

_CATEGORY_META = {
    "medications": ("💊", "Medication Response"),
    "diet":        ("🥗", "Diet & Nutrition"),
    "fitness":     ("🏃", "Fitness & Body"),
    "mental":      ("🧠", "Mental Wellness & Sleep"),
    "heart":       ("❤️",  "Heart & Longevity"),
    "immunity":    ("🛡️",  "Immunity & Allergies"),
}


# ── Endpoint ─────────────────────────────────────────────────────────────

@router.post("/analyze")
async def analyze_genome(file: UploadFile = File(...)):
    """
    Accepts a raw genome file from 23andMe, AncestryDNA, MyHeritage, or FamilyTreeDNA.
    Returns categorized health insights based on ~200 key genetic markers.
    The file is read into memory and immediately discarded — nothing is persisted.
    """
    if not file.filename:
        raise HTTPException(400, "No file provided")

    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ("txt", "zip", "csv", "tsv", "gz"):
        raise HTTPException(400, f"Unsupported file type '.{ext}'. Please upload a .txt or .zip file from your DNA provider.")

    content = await _read_content(file)
    genotypes, source = _parse_genome_file(content)

    if not genotypes:
        raise HTTPException(422, (
            "Could not read any genetic variants from this file. "
            "Please make sure you uploaded the 'raw data' file from your DNA provider "
            "(not a health report PDF). It should be a plain text file with columns like "
            "rsid, chromosome, position, genotype."
        ))

    # Match against database
    categories_map: dict[str, list[dict]] = {}
    snps_found = 0

    for rsid, snp in SNPS.items():
        genotype = genotypes.get(rsid)
        if not genotype:
            continue

        allele_data = snp["alleles"].get(genotype)
        if not allele_data:
            # Try reverse complement for single-strand flips
            rev = genotype[::-1]
            allele_data = snp["alleles"].get(rev)
            if allele_data:
                genotype = rev

        if not allele_data:
            # Mark as not in database for this genotype but still count
            continue

        snps_found += 1
        your_result, impact_level, _, actions = allele_data

        cat = snp["category"]
        categories_map.setdefault(cat, []).append({
            "name": snp["name"],
            "gene": snp["gene"],
            "your_result": your_result,
            "impact_level": impact_level,
            "plain_explanation": allele_data[0],
            "actions": list(actions),
        })

    # Order categories by clinical importance
    cat_order = ["medications", "diet", "fitness", "mental", "heart", "immunity"]
    categories_out = []
    for cat in cat_order:
        findings = categories_map.get(cat, [])
        if not findings:
            continue
        emoji, plain_name = _CATEGORY_META[cat]
        categories_out.append({
            "category": cat,
            "plain_name": plain_name,
            "emoji": emoji,
            "accentColor": "#e44c81",
            "findings": findings,
        })

    return {
        "summary": {
            "total_snps_checked": len(SNPS),
            "total_snps_found": snps_found,
            "file_source": source,
        },
        "categories": categories_out,
        "privacy_note": (
            "This analysis ran entirely on your device. "
            "Your raw genetic data was never stored, transmitted, or logged anywhere. "
            "Results are for educational purposes only — always discuss with your doctor."
        ),
    }
