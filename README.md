# MediTrace 2.1 — Longitudinal Medical Memory & Grounded Clinical Monolith

> **Status:** Fully Implemented & Tested End-to-End. Built in accordance with `README_MediTrace_2.0.md` architecture specifications.
> **Design Philosophy:** Modular monolith, bounded assistant runtime, deterministic workflows, code-verified citations and actions. Models propose; humans commit; code verifies.

---

## 1. System Architecture & Key Capabilities

- **Separated Patient Accounts & Care Profiles (`care_profiles`)**: One user login manages self, parents, and children with roles (`owner`, `caregiver`, `viewer`).
- **Propose → Confirm Action Engine**: Mutating tools only create a `pending_action`; user/doctor explicitly commits via authenticated API call. Eliminates hallucinations and prompt-injection-driven actions.
- **Deterministic Citation Verification**: Code mathematically checks every claim against real `fact_id`s within the authorized scope; rejects unauthorized or hallucinated claims.
- **Precomputed Patient Snapshot**: Instant longitudinal context pack (allergies, active medications, recent key labs, upcoming appointments) injected into LLM prompt for low-latency grounding.
- **Pre-LLM Multi-lingual Emergency / Red-Flag Screen**: Immediate triage for acute symptoms across English, Hindi (हिन्दी), Bengali (বাংলা), and Tamil (தமிழ்), localized to Indian emergency numbers (112, 108, 102).
- **Multi-Route Ingestion Pipeline**:
  - Routing: Digital PDF text extraction, layout-aware document AI, or Vision-LLM for handwritten scans.
  - Terminology Normalization: LOINC (labs), SNOMED CT (conditions), ATC & Indian Brand→Generic mapping (e.g. Augmentin, Dolo 650, Glycomet GP2, Telma 40).
  - Review-fatigue mitigation: Targeted review prompts only for high-risk / handwritten facts; non-blocking badges for normal records.
  - Deduplication: SHA-256 file checksums and idempotency keys.
- **Deterministic Clinical Comparator (`compare_observations`)**: Computes numerical deltas, unit alignment, and trends in code; LLM explains but never calculates.
- **Doctor Portal & Care Network**:
  - Medical Council verification badges (`WBMC/2014/19823`).
  - Authorized patient rosters via DPDP Act 2023 compliant access grants.
  - Sourced clinical briefings with "Data as of" timestamps and citation drill-downs.
  - Digital prescription builder with automated real-time Allergy Conflict cross-checking and digital signing.
- **LiveKit Voice Agent Pipeline**:
  - WebRTC signaling and data channel UI event publishing (`model_activity` start/done, tool activity, barge-in / interruption handling).
  - Fast-path tool dispatching connected directly to MediTrace tools.
- **iOS Glassmorphic User Interface**:
  - Frosted glass cards (`backdrop-blur-xl bg-white/70 border border-white/30 shadow-xl`), Apple-style typography, smooth micro-interactions, responsive mobile/desktop layouts.

---

## 2. Directory Structure

```text
meditrace/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI entrypoint + static SPA mounting
│   │   ├── api/v1/api.py            # Complete REST & streaming endpoints
│   │   ├── core/                    # Config, errors, security, logging
│   │   ├── policy/                  # Central authorization + RLS session helpers
│   │   ├── db/                      # SQLAlchemy async engine, models, schemas, init_db
│   │   ├── modules/
│   │   │   ├── terminology/         # LOINC catalog, Indian drug mapping, unit conversion
│   │   │   ├── clinical_data/       # Deterministic observation comparator
│   │   │   ├── ingestion/           # Router, extractor, rules, presigned upload service
│   │   │   ├── retrieval/           # Hybrid retriever (cosine similarity + lexical RRF)
│   │   │   ├── assistant/           # Runtime, safety screen, snapshot, citation verifier
│   │   │   ├── pending_actions/     # Propose-confirm lifecycle service
│   │   │   └── practitioners/       # Doctor workspace, briefings, allergy-checked Rx
│   │   ├── voice/                   # LiveKit voice agent, tokens, bridge
│   │   └── workers/                 # Outbox projection workers (timeline, snapshots)
├── frontend/                        # React + Vite + Tailwind CSS (iOS Glassmorphism UI)
│   ├── src/
│   │   ├── components/              # Header, Snapshot, Upload, ReviewModal, Charts, Chat, Voice, Doctor
│   │   ├── api.ts                   # Typed API client
│   │   ├── App.tsx                  # Root app coordinator
│   │   └── index.css                # Frosted glassmorphism styles
│   └── dist/                        # Production optimized bundle
├── tests/                           # 27 automated unit, integration, and security tests
├── .env.example                     # Environment template
└── README.md
```

---

## 3. Quickstart & Verification

### Run the Backend & UI
```bash
# 1. Activate Python virtual environment
.venv\Scripts\activate

# 2. Start the FastAPI server (serves API at :8000 and the Glassmorphic UI at /)
python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000 --reload
```
Open [http://localhost:8000](http://localhost:8000) in your browser.

### Run Frontend in Vite Dev Mode (Optional)
```bash
cd frontend
npm run dev
```

### Run the Full Test Suite
```bash
.venv\Scripts\pytest -v tests
```
All 27 release-gate tests pass with 100% compliance.
