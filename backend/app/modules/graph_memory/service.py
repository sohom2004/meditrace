import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import (
    ClinicalGraphEdge,
    ClinicalGraphNode,
    ClinicalObservation,
    Condition,
    Document,
    MedicationStatement,
)


class GraphMemoryService:
    """Graph-based Clinical Memory Service.

    Maintains patient-specific clinical knowledge graph:
    Nodes: Reports, Findings (Labs/Vitals), Conditions, Medications.
    Edges: HAS_FINDING, TEMPORAL_SEQUENCE (with delta & trend), INDICATES, TREATED_BY.
    """

    @staticmethod
    def _utc_now() -> datetime:
        return datetime.now(timezone.utc)

    @staticmethod
    async def build_document_subgraph(
        session: AsyncSession,
        care_profile_id: str,
        document_id: str,
        extracted_facts: dict[str, Any]
    ) -> dict[str, Any]:
        """Builds and commits a connected clinical subgraph for an uploaded report."""
        doc_res = await session.execute(select(Document).where(Document.id == document_id))
        doc = doc_res.scalar_one_or_none()
        doc_name = doc.filename if doc else "Clinical Report"

        # 1. Create Report Node
        report_node = ClinicalGraphNode(
            id=str(uuid.uuid4()),
            care_profile_id=care_profile_id,
            document_id=document_id,
            node_type="report",
            entity_id=document_id,
            label=doc_name,
            properties_json=json.dumps({
                "filename": doc_name,
                "mime_type": doc.mime_type if doc else "application/pdf",
                "checksum": doc.checksum if doc else "",
                "created_at": doc.created_at.isoformat() if doc and doc.created_at else "",
            }),
            observed_at=doc.created_at if doc and doc.created_at else GraphMemoryService._utc_now()
        )
        session.add(report_node)
        await session.flush()

        created_finding_nodes = []
        created_condition_nodes = []
        created_medication_nodes = []

        # 2. Ingest Observation / Lab Findings
        observations = extracted_facts.get("observations", [])
        for obs in observations:
            display_name = obs.get("display_name") or obs.get("name") or "Observation"
            canonical_code = obs.get("code_loinc") or obs.get("canonical_code") or ""
            val_num = obs.get("value_numeric")
            unit = obs.get("unit") or ""
            flag = obs.get("flag") or "normal"
            fact_id = obs.get("fact_id") or f"FACT-OBS-{uuid.uuid4().hex[:8]}"

            finding_node = ClinicalGraphNode(
                id=str(uuid.uuid4()),
                care_profile_id=care_profile_id,
                document_id=document_id,
                node_type="finding",
                entity_id=fact_id,
                label=display_name,
                canonical_code=f"LOINC:{canonical_code}" if canonical_code and not canonical_code.startswith("LOINC:") else canonical_code,
                value_numeric=val_num,
                unit=unit,
                flag=flag,
                observed_at=report_node.observed_at,
                properties_json=json.dumps({
                    "ref_low": obs.get("reference_range_low") or obs.get("ref_low"),
                    "ref_high": obs.get("reference_range_high") or obs.get("ref_high"),
                    "provenance": obs.get("provenance", {}),
                    "excerpt": obs.get("excerpt", ""),
                    "report_name": doc_name,
                })
            )
            session.add(finding_node)
            await session.flush()
            created_finding_nodes.append(finding_node)

            # Edge: Report -> HAS_FINDING -> FindingNode
            edge_has = ClinicalGraphEdge(
                id=str(uuid.uuid4()),
                care_profile_id=care_profile_id,
                source_node_id=report_node.id,
                target_node_id=finding_node.id,
                relation_type="HAS_FINDING",
                weight=1.0,
                properties_json=json.dumps({"report_name": doc_name})
            )
            session.add(edge_has)

            # TEMPORAL SEQUENCE: Link with prior measurement of the same test for this patient
            if val_num is not None:
                # Find prior node with same canonical_code or label
                prior_q = select(ClinicalGraphNode).where(
                    ClinicalGraphNode.care_profile_id == care_profile_id,
                    ClinicalGraphNode.node_type == "finding",
                    ClinicalGraphNode.id != finding_node.id,
                    ClinicalGraphNode.value_numeric.isnot(None),
                    (
                        (ClinicalGraphNode.canonical_code == finding_node.canonical_code)
                        | (ClinicalGraphNode.label.ilike(f"%{display_name}%"))
                    )
                ).order_by(desc(ClinicalGraphNode.observed_at)).limit(1)

                prior_res = await session.execute(prior_q)
                prior_node = prior_res.scalar_one_or_none()

                if prior_node and prior_node.value_numeric is not None:
                    delta = round(val_num - prior_node.value_numeric, 2)
                    prior_val = prior_node.value_numeric
                    delta_pct = round((delta / prior_val) * 100, 1) if prior_val != 0 else 0.0

                    # Clinical trend direction:
                    lower_is_better_tests = ["glucose", "sugar", "hba1c", "cholesterol", "triglyceride", "creatinine", "ldl"]
                    is_lower_better = any(t in display_name.lower() for t in lower_is_better_tests)

                    if delta == 0:
                        trend = "stable"
                    elif delta < 0:
                        trend = "improved" if is_lower_better else "worsened"
                    else:
                        trend = "worsened" if is_lower_better else "improved"

                    temporal_edge = ClinicalGraphEdge(
                        id=str(uuid.uuid4()),
                        care_profile_id=care_profile_id,
                        source_node_id=prior_node.id,
                        target_node_id=finding_node.id,
                        relation_type="TEMPORAL_SEQUENCE",
                        delta_numeric=delta,
                        delta_percentage=delta_pct,
                        trend_direction=trend,
                        properties_json=json.dumps({
                            "prior_value": prior_val,
                            "current_value": val_num,
                            "unit": unit,
                            "prior_date": prior_node.observed_at.isoformat() if prior_node.observed_at else "",
                            "current_date": finding_node.observed_at.isoformat() if finding_node.observed_at else "",
                            "comparison_text": f"{'Decreased' if delta < 0 else 'Increased'} by {abs(delta)} {unit} ({delta_pct}%) vs prior report.",
                        })
                    )
                    session.add(temporal_edge)

        # 3. Ingest Diagnosed Conditions
        for cond in extracted_facts.get("conditions", []):
            cond_name = cond.get("name") or "Condition"
            cond_node = ClinicalGraphNode(
                id=str(uuid.uuid4()),
                care_profile_id=care_profile_id,
                document_id=document_id,
                node_type="condition",
                entity_id=cond.get("fact_id") or f"FACT-COND-{uuid.uuid4().hex[:8]} ",
                label=cond_name,
                canonical_code=cond.get("code_snomed") or "",
                flag=cond.get("clinical_status") or "active",
                observed_at=report_node.observed_at,
                properties_json=json.dumps({"report_name": doc_name, "excerpt": cond.get("excerpt", "")})
            )
            session.add(cond_node)
            await session.flush()
            created_condition_nodes.append(cond_node)

            # Edge: Report -> HAS_FINDING -> ConditionNode
            session.add(ClinicalGraphEdge(
                id=str(uuid.uuid4()),
                care_profile_id=care_profile_id,
                source_node_id=report_node.id,
                target_node_id=cond_node.id,
                relation_type="HAS_FINDING",
                weight=1.0
            ))

            # Edge: Finding -> INDICATES -> Condition (e.g. Glucose/HbA1c -> Diabetes)
            for f_node in created_finding_nodes:
                if ("glucose" in f_node.label.lower() or "hba1c" in f_node.label.lower()) and "diabet" in cond_name.lower():
                    session.add(ClinicalGraphEdge(
                        id=str(uuid.uuid4()),
                        care_profile_id=care_profile_id,
                        source_node_id=f_node.id,
                        target_node_id=cond_node.id,
                        relation_type="INDICATES",
                        properties_json=json.dumps({"clinical_correlation": "Glycemic marker indicates Diabetes status"})
                    ))
                elif ("creatinine" in f_node.label.lower() or "egfr" in f_node.label.lower()) and ("kidney" in cond_name.lower() or "renal" in cond_name.lower() or "ckd" in cond_name.lower()):
                    session.add(ClinicalGraphEdge(
                        id=str(uuid.uuid4()),
                        care_profile_id=care_profile_id,
                        source_node_id=f_node.id,
                        target_node_id=cond_node.id,
                        relation_type="INDICATES",
                        properties_json=json.dumps({"clinical_correlation": "Renal marker indicates Kidney function"})
                    ))

        # 4. Ingest Medications
        for med in extracted_facts.get("medications", []):
            med_name = med.get("medicine_name") or med.get("name") or "Medication"
            med_node = ClinicalGraphNode(
                id=str(uuid.uuid4()),
                care_profile_id=care_profile_id,
                document_id=document_id,
                node_type="medication",
                entity_id=med.get("fact_id") or f"FACT-MED-{uuid.uuid4().hex[:8]}",
                label=med_name,
                canonical_code=med.get("atc_code") or "",
                observed_at=report_node.observed_at,
                properties_json=json.dumps({
                    "dosage": med.get("dosage"),
                    "frequency": med.get("frequency"),
                    "generic_name": med.get("generic_name"),
                    "report_name": doc_name,
                })
            )
            session.add(med_node)
            await session.flush()
            created_medication_nodes.append(med_node)

            # Edge: Report -> HAS_FINDING -> MedicationNode
            session.add(ClinicalGraphEdge(
                id=str(uuid.uuid4()),
                care_profile_id=care_profile_id,
                source_node_id=report_node.id,
                target_node_id=med_node.id,
                relation_type="HAS_FINDING",
                weight=1.0
            ))

            # Edge: Condition -> TREATED_BY -> Medication (e.g. Diabetes -> Metformin)
            for c_node in created_condition_nodes:
                if "diabet" in c_node.label.lower() and any(d in med_name.lower() for d in ["metformin", "glycomet", "glimepiride", "insulin", "januvia"]):
                    session.add(ClinicalGraphEdge(
                        id=str(uuid.uuid4()),
                        care_profile_id=care_profile_id,
                        source_node_id=c_node.id,
                        target_node_id=med_node.id,
                        relation_type="TREATED_BY",
                        properties_json=json.dumps({"indication": "First-line antihyperglycemic therapy"})
                    ))

        await session.commit()
        return {
            "report_node_id": report_node.id,
            "findings_count": len(created_finding_nodes),
            "conditions_count": len(created_condition_nodes),
            "medications_count": len(created_medication_nodes)
        }

    @staticmethod
    async def get_patient_graph(session: AsyncSession, care_profile_id: str) -> dict[str, Any]:
        """Returns the full clinical knowledge graph for a patient."""
        nodes_res = await session.execute(
            select(ClinicalGraphNode)
            .where(ClinicalGraphNode.care_profile_id == care_profile_id)
            .order_by(desc(ClinicalGraphNode.observed_at))
        )
        nodes = nodes_res.scalars().all()

        edges_res = await session.execute(
            select(ClinicalGraphEdge)
            .where(ClinicalGraphEdge.care_profile_id == care_profile_id)
        )
        edges = edges_res.scalars().all()

        node_dicts = []
        for n in nodes:
            props = json.loads(n.properties_json) if n.properties_json else {}
            node_dicts.append({
                "id": n.id,
                "node_type": n.node_type,
                "label": n.label,
                "canonical_code": n.canonical_code,
                "value_numeric": n.value_numeric,
                "unit": n.unit,
                "flag": n.flag,
                "document_id": n.document_id,
                "observed_at": n.observed_at.isoformat() if n.observed_at else None,
                "properties": props
            })

        edge_dicts = []
        for e in edges:
            props = json.loads(e.properties_json) if e.properties_json else {}
            edge_dicts.append({
                "id": e.id,
                "source": e.source_node_id,
                "target": e.target_node_id,
                "relation_type": e.relation_type,
                "delta_numeric": e.delta_numeric,
                "delta_percentage": e.delta_percentage,
                "trend_direction": e.trend_direction,
                "properties": props
            })

        reports_count = sum(1 for n in nodes if n.node_type == "report")
        findings_count = sum(1 for n in nodes if n.node_type == "finding")
        conditions_count = sum(1 for n in nodes if n.node_type == "condition")
        meds_count = sum(1 for n in nodes if n.node_type == "medication")
        temporal_edges = [e for e in edges if e.relation_type == "TEMPORAL_SEQUENCE"]

        return {
            "nodes": node_dicts,
            "edges": edge_dicts,
            "summary": {
                "reports_count": reports_count,
                "findings_count": findings_count,
                "conditions_count": conditions_count,
                "medications_count": meds_count,
                "temporal_links_count": len(temporal_edges)
            }
        }

    @staticmethod
    async def get_temporal_trajectories(
        session: AsyncSession,
        care_profile_id: str,
        test_name: str | None = None
    ) -> dict[str, list[dict[str, Any]]]:
        """Returns time-series trajectories for lab findings across reports."""
        q = select(ClinicalGraphNode).where(
            ClinicalGraphNode.care_profile_id == care_profile_id,
            ClinicalGraphNode.node_type == "finding",
            ClinicalGraphNode.value_numeric.isnot(None)
        ).order_by(ClinicalGraphNode.observed_at.asc())

        if test_name:
            q = q.where(ClinicalGraphNode.label.ilike(f"%{test_name}%"))

        nodes_res = await session.execute(q)
        nodes = nodes_res.scalars().all()

        trajectories: dict[str, list[dict[str, Any]]] = {}
        for n in nodes:
            key = n.label
            if key not in trajectories:
                trajectories[key] = []
            
            props = json.loads(n.properties_json) if n.properties_json else {}
            trajectories[key].append({
                "node_id": n.id,
                "date": n.observed_at.strftime("%Y-%m-%d") if n.observed_at else "Unknown",
                "value": n.value_numeric,
                "unit": n.unit,
                "flag": n.flag,
                "report_name": props.get("report_name", "Clinical Report"),
                "document_title": props.get("report_name", "Clinical Report"),
                "document_id": n.document_id,
                "ref_low": props.get("ref_low"),
                "ref_high": props.get("ref_high"),
                "delta": None,
                "delta_percentage": None,
                "trend_direction": None
            })

        if test_name:
            matched_pts = []
            for k, pts in trajectories.items():
                matched_pts.extend(pts)

            # Sort chronological
            matched_pts.sort(key=lambda x: x["date"])

            # Link temporal deltas
            for i in range(1, len(matched_pts)):
                prev = matched_pts[i - 1]
                curr = matched_pts[i]
                d = round(curr["value"] - prev["value"], 2)
                pct = round((d / prev["value"]) * 100, 1) if prev["value"] else 0.0
                curr["previous_value"] = prev["value"]
                curr["delta"] = d
                curr["delta_percentage"] = pct
                curr["trend_direction"] = "down" if d < 0 else "up" if d > 0 else "stable"

            return {
                "canonical_test_name": test_name,
                "data_points": matched_pts
            }

        return trajectories

    @staticmethod
    async def get_report_findings(session: AsyncSession, document_id: str) -> dict[str, Any]:
        """Returns all findings belonging to a specific report with temporal comparison."""
        doc = await session.get(Document, document_id)
        if not doc:
            return {"document_id": document_id, "findings": []}

        nodes_res = await session.execute(
            select(ClinicalGraphNode)
            .where(
                ClinicalGraphNode.document_id == document_id,
                ClinicalGraphNode.node_type != "report"
            )
            .order_by(ClinicalGraphNode.node_type)
        )
        nodes = nodes_res.scalars().all()

        # If findings are empty and file exists on disk, run on-demand extraction
        if len(nodes) == 0 and doc.file_path and os.path.exists(doc.file_path):
            try:
                with open(doc.file_path, "rb") as f:
                    content = f.read()
                from app.modules.ingestion.extractor import DocumentExtractor
                extracted = await DocumentExtractor.extract_structured_facts(
                    file_content=content,
                    filename=doc.filename,
                    mime_type=doc.mime_type
                )
                if extracted.get("observations") or extracted.get("medications") or extracted.get("conditions"):
                    for o in extracted.get("observations", []):
                        obs = ClinicalObservation(
                            fact_id=o["fact_id"],
                            care_profile_id=doc.care_profile_id,
                            document_id=doc.id,
                            code_loinc=o.get("code_loinc"),
                            display_name=o["display_name"],
                            category=o.get("category", "laboratory"),
                            value_numeric=o.get("value_numeric"),
                            unit=o.get("unit"),
                            reference_range_low=o.get("reference_range_low"),
                            reference_range_high=o.get("reference_range_high"),
                            flag=o.get("flag", "normal"),
                            confidence=o.get("confidence", 1.0),
                            verification_status=o.get("verification_status", "auto_accepted"),
                            provenance_json=json.dumps(o.get("provenance", {}))
                        )
                        session.add(obs)

                    for m in extracted.get("medications", []):
                        med = MedicationStatement(
                            fact_id=m["fact_id"],
                            care_profile_id=doc.care_profile_id,
                            document_id=doc.id,
                            medicine_name=m["medicine_name"],
                            generic_name=m.get("generic_name"),
                            atc_code=m.get("atc_code"),
                            dosage=m.get("dosage"),
                            frequency=m.get("frequency"),
                            duration=m.get("duration"),
                            confidence=m.get("confidence", 1.0),
                            verification_status=m.get("verification_status", "auto_accepted"),
                            provenance_json=json.dumps(m.get("provenance", {}))
                        )
                        session.add(med)

                    for c in extracted.get("conditions", []):
                        cond = Condition(
                            fact_id=c["fact_id"],
                            care_profile_id=doc.care_profile_id,
                            document_id=doc.id,
                            name=c["name"],
                            clinical_status=c.get("clinical_status", "active"),
                            verification_status=c.get("verification_status", "auto_accepted"),
                            provenance_json=json.dumps(c.get("provenance", {}))
                        )
                        session.add(cond)

                    await session.commit()

                    await GraphMemoryService.build_document_subgraph(
                        session=session,
                        care_profile_id=doc.care_profile_id,
                        document_id=doc.id,
                        extracted_facts=extracted
                    )

                    from app.modules.assistant.snapshot import PatientSnapshotService
                    await PatientSnapshotService.compute_snapshot(session, doc.care_profile_id)

                    nodes_res = await session.execute(
                        select(ClinicalGraphNode)
                        .where(
                            ClinicalGraphNode.document_id == document_id,
                            ClinicalGraphNode.node_type != "report"
                        )
                        .order_by(ClinicalGraphNode.node_type)
                    )
                    nodes = nodes_res.scalars().all()
            except Exception as e:
                pass

        findings_list = []
        for n in nodes:
            props = json.loads(n.properties_json) if n.properties_json else {}
            # Check for incoming temporal comparison edge
            edge_res = await session.execute(
                select(ClinicalGraphEdge).where(
                    ClinicalGraphEdge.target_node_id == n.id,
                    ClinicalGraphEdge.relation_type == "TEMPORAL_SEQUENCE"
                )
            )
            temp_edge = edge_res.scalar_one_or_none()
            comp_info = None
            if temp_edge:
                edge_props = json.loads(temp_edge.properties_json) if temp_edge.properties_json else {}
                comp_info = {
                    "delta": temp_edge.delta_numeric,
                    "delta_percentage": temp_edge.delta_percentage,
                    "trend": temp_edge.trend_direction,
                    "comparison_text": edge_props.get("comparison_text", "")
                }

            findings_list.append({
                "id": n.id,
                "type": n.node_type,
                "label": n.label,
                "code": n.canonical_code,
                "value": n.value_numeric,
                "unit": n.unit,
                "flag": n.flag,
                "comparison": comp_info,
                "properties": props
            })

        return {
            "document_id": document_id,
            "filename": doc.filename,
            "uploaded_at": doc.created_at.isoformat() if doc.created_at else None,
            "status": doc.status,
            "findings_count": len(findings_list),
            "findings": findings_list
        }

    @staticmethod
    async def traverse_semantic_memory(
        session: AsyncSession,
        care_profile_id: str,
        user_query: str
    ) -> dict[str, Any]:
        """Traverses patient clinical graph to answer queries about past reports and conditions."""
        # Query all nodes for this patient
        nodes_res = await session.execute(
            select(ClinicalGraphNode)
            .where(ClinicalGraphNode.care_profile_id == care_profile_id)
            .order_by(desc(ClinicalGraphNode.observed_at))
        )
        all_nodes = nodes_res.scalars().all()

        edges_res = await session.execute(
            select(ClinicalGraphEdge)
            .where(ClinicalGraphEdge.care_profile_id == care_profile_id)
        )
        all_edges = edges_res.scalars().all()

        q_lower = user_query.lower()

        # Filter relevant nodes
        matched_nodes = []
        for n in all_nodes:
            lbl = n.label.lower()
            code = (n.canonical_code or "").lower()
            if any(term in lbl or term in code for term in q_lower.split() if len(term) > 2):
                matched_nodes.append(n)
            elif "report" in q_lower or "past" in q_lower or "latest" in q_lower or "history" in q_lower:
                matched_nodes.append(n)

        # If no specific match, provide top findings and reports
        if not matched_nodes:
            matched_nodes = all_nodes[:12]

        # Gather temporal comparisons for matched findings
        node_ids = {n.id for n in matched_nodes}
        relevant_edges = [
            e for e in all_edges
            if e.source_node_id in node_ids or e.target_node_id in node_ids
        ]

        comparisons = []
        for e in relevant_edges:
            if e.relation_type == "TEMPORAL_SEQUENCE":
                props = json.loads(e.properties_json) if e.properties_json else {}
                comparisons.append({
                    "delta": e.delta_numeric,
                    "delta_percentage": e.delta_percentage,
                    "trend": e.trend_direction,
                    "text": props.get("comparison_text", "")
                })

        # Format structured graph knowledge string for grounding
        knowledge_lines = []
        for n in matched_nodes[:15]:
            props = json.loads(n.properties_json) if n.properties_json else {}
            if n.node_type == "finding":
                line = f"- Lab/Finding: {n.label} = {n.value_numeric} {n.unit} [{n.flag}] (Report: {props.get('report_name', 'Report')}, Date: {n.observed_at.strftime('%Y-%m-%d') if n.observed_at else 'Unknown'})"
            elif n.node_type == "report":
                line = f"- Document Report: {n.label} (Ingested on {n.observed_at.strftime('%Y-%m-%d') if n.observed_at else 'Unknown'})"
            elif n.node_type == "condition":
                line = f"- Diagnosed Condition: {n.label} ({n.flag})"
            elif n.node_type == "medication":
                line = f"- Medication: {n.label} (Dose: {props.get('dosage')}, Freq: {props.get('frequency')})"
            else:
                line = f"- {n.node_type}: {n.label}"
            knowledge_lines.append(line)

        return {
            "matched_nodes_count": len(matched_nodes),
            "graph_summary": "\n".join(knowledge_lines),
            "comparisons": comparisons,
            "relevant_nodes": [
                {
                    "label": n.label,
                    "type": n.node_type,
                    "value": n.value_numeric,
                    "unit": n.unit,
                    "flag": n.flag,
                    "document_id": n.document_id,
                    "date": n.observed_at.strftime("%Y-%m-%d") if n.observed_at else ""
                }
                for n in matched_nodes[:10]
            ]
        }
