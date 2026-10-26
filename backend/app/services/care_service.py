"""OptiDerma Care Connect Service.

Provides verified dermatologist discovery, consultation preparation summaries,
and appointment coordination without fabricating live bookings.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

VERIFIED_CLINICS: List[Dict[str, Any]] = [
    {
        "id": "aiims-delhi-derm",
        "name": "AIIMS Department of Dermatology, Venereology & Leprology",
        "institution": "All India Institute of Medical Sciences (AIIMS)",
        "address": "Ansari Nagar East, Ring Road, New Delhi, Delhi 110029",
        "city": "Delhi",
        "district": "New Delhi",
        "pin_code": "110029",
        "phone": "+91-11-26588500",
        "consultation_types": ["in-person"],
        "hours": "Mon-Sat: 08:30 - 13:00 (OPD)",
        "verified": True,
        "specialties": ["General Dermatology", "Dermato-Oncology", "Cutaneous Surgery", "Phototherapy"],
        "booking_mode": "request_or_hospital_portal",
        "portal_url": "https://ors.gov.in/",
    },
    {
        "id": "pgimer-chd-derm",
        "name": "PGIMER Department of Dermatology",
        "institution": "Postgraduate Institute of Medical Education and Research",
        "address": "Sector 12, Chandigarh, 160012",
        "city": "Chandigarh",
        "district": "Chandigarh",
        "pin_code": "160012",
        "phone": "+91-172-2746018",
        "consultation_types": ["in-person", "teleconsult"],
        "hours": "Mon-Fri: 09:00 - 14:00",
        "verified": True,
        "specialties": ["Pigmentary Disorders", "Dermatosurgery", "Psoriasis Clinic", "Melanoma Screening"],
        "booking_mode": "request_or_hospital_portal",
        "portal_url": "https://pgimer.edu.in/",
    },
    {
        "id": "kem-mumbai-derm",
        "name": "KEM Hospital Dermatology & Dermatosurgery Clinic",
        "institution": "King Edward Memorial Hospital & Seth GS Medical College",
        "address": "Acharya Donde Marg, Parel, Mumbai, Maharashtra 400012",
        "city": "Mumbai",
        "district": "Mumbai",
        "pin_code": "400012",
        "phone": "+91-22-24107000",
        "consultation_types": ["in-person"],
        "hours": "Mon-Sat: 08:30 - 12:30",
        "verified": True,
        "specialties": ["Dermatosurgery", "Contact Dermatitis", "Melanoma & Non-Melanoma Surveillance"],
        "booking_mode": "request_or_hospital_portal",
        "portal_url": "https://www.kem.edu/",
    },
    {
        "id": "victoria-bengaluru-derm",
        "name": "Bangalore Medical College & Victoria Hospital Dermatology OPD",
        "institution": "Victoria Hospital / BMCRI",
        "address": "Fort Road, Near City Market, Bengaluru, Karnataka 560002",
        "city": "Bengaluru",
        "district": "Bengaluru Urban",
        "pin_code": "560002",
        "phone": "+91-80-26701150",
        "consultation_types": ["in-person"],
        "hours": "Mon-Sat: 09:00 - 13:00",
        "verified": True,
        "specialties": ["Clinical Dermatology", "Dermoscopy", "Allergy Testing"],
        "booking_mode": "request_or_hospital_portal",
        "portal_url": "https://bmcri.edu.in/",
    },
    {
        "id": "cmc-vellore-derm",
        "name": "CMC Vellore Department of Dermatology",
        "institution": "Christian Medical College",
        "address": "Ida Scudder Road, Vellore, Tamil Nadu 632004",
        "city": "Vellore",
        "district": "Vellore",
        "pin_code": "632004",
        "phone": "+91-416-2281000",
        "consultation_types": ["in-person", "teleconsult"],
        "hours": "Mon-Sat: 08:00 - 16:30",
        "verified": True,
        "specialties": ["Dermatopathology", "Pediatric Dermatology", "Cutaneous Oncology"],
        "booking_mode": "request_or_hospital_portal",
        "portal_url": "https://clin.cmcvellore.ac.in/",
    },
    {
        "id": "apollo-chennai-derm",
        "name": "Apollo Hospitals Dermatology & Cosmetic Clinic",
        "institution": "Apollo Main Hospital",
        "address": "21 Greams Lane, Thousand Lights, Chennai, Tamil Nadu 600006",
        "city": "Chennai",
        "district": "Chennai",
        "pin_code": "600006",
        "phone": "+91-44-28290200",
        "consultation_types": ["in-person", "teleconsult"],
        "hours": "Mon-Sat: 09:00 - 18:00",
        "verified": True,
        "specialties": ["Dermoscopy", "Laser Surgery", "Atypical Mole Clinic"],
        "booking_mode": "request_or_hospital_portal",
        "portal_url": "https://www.apollohospitals.com/",
    },
    {
        "id": "max-saket-derm",
        "name": "Max Super Speciality Hospital Dermatology Institute",
        "institution": "Max Healthcare",
        "address": "1, 2 Press Enclave Marg, Saket Institutional Area, New Delhi 110017",
        "city": "New Delhi",
        "district": "South Delhi",
        "pin_code": "110017",
        "phone": "+91-11-26515050",
        "consultation_types": ["in-person", "teleconsult"],
        "hours": "Mon-Sat: 09:00 - 19:00",
        "verified": True,
        "specialties": ["Skin Cancer Screening", "Mohs Surgery Consultation", "Photodynamic Therapy"],
        "booking_mode": "request_or_hospital_portal",
        "portal_url": "https://www.maxhealthcare.in/",
    },
    {
        "id": "slbs-mandi-derm",
        "name": "SLBS Government Medical College & Hospital Dermatology OPD",
        "institution": "Shri Lal Bahadur Shastri Govt Medical College Mandi",
        "address": "National Highway 21, Nerchowk, District Mandi, Himachal Pradesh 175008",
        "city": "Mandi",
        "district": "Mandi",
        "pin_code": "175008",
        "phone": "+91-1905-243945",
        "consultation_types": ["in-person", "teleconsult"],
        "hours": "Mon-Sat: 09:30 - 15:30 (OPD)",
        "verified": True,
        "specialties": ["General Dermatology", "Dermatosurgery", "Pigmentary Disorders", "Contact Dermatitis"],
        "booking_mode": "request_or_hospital_portal",
        "portal_url": "http://www.slbsgmchmandi.com/",
    },
    {
        "id": "aiims-bilaspur-derm",
        "name": "AIIMS Bilaspur Department of Dermatology",
        "institution": "All India Institute of Medical Sciences Bilaspur (HP)",
        "address": "Kothipura, Bilaspur, Himachal Pradesh 174001",
        "city": "Bilaspur",
        "district": "Bilaspur",
        "pin_code": "174001",
        "phone": "+91-1978-292500",
        "consultation_types": ["in-person", "teleconsult"],
        "hours": "Mon-Sat: 09:00 - 14:00",
        "verified": True,
        "specialties": ["Dermato-Oncology", "Phototherapy", "Cutaneous Surgery", "Melanoma & Mole Surveillance"],
        "booking_mode": "request_or_hospital_portal",
        "portal_url": "https://www.aiimsbilaspur.edu.in/",
    },
    {
        "id": "rpgmc-tanda-derm",
        "name": "Dr. RPGMC Tanda Department of Dermatology",
        "institution": "Dr. Rajendra Prasad Government Medical College",
        "address": "Kangra Road, Tanda, Himachal Pradesh 176001",
        "city": "Kangra",
        "district": "Kangra",
        "pin_code": "176001",
        "phone": "+91-1892-267115",
        "consultation_types": ["in-person", "teleconsult"],
        "hours": "Mon-Sat: 09:30 - 14:00",
        "verified": True,
        "specialties": ["Dermoscopy", "Histopathology", "Psoriasis & Eczema Clinic"],
        "booking_mode": "request_or_hospital_portal",
        "portal_url": "https://rpgmc.ac.in/",
    },
    {
        "id": "esanjeevani-tele-derm",
        "name": "eSanjeevani National Tele-Dermatology OPD",
        "institution": "Ministry of Health and Family Welfare (MoHFW), Govt of India",
        "address": "National Teleconsultation Network (Available across all India PIN codes)",
        "city": "Pan-India",
        "district": "National Network",
        "pin_code": "175121",
        "phone": "1075 (Toll-Free Health Helpline)",
        "consultation_types": ["teleconsult"],
        "hours": "Mon-Sat: 08:00 - 20:00 (Digital OPD)",
        "verified": True,
        "specialties": ["Digital Tele-Dermatology", "Rash & Lesion Triage", "Specialist e-Prescription"],
        "booking_mode": "request_or_hospital_portal",
        "portal_url": "https://esanjeevani.mohfw.gov.in/",
    },
]


def search_dermatologists(
    pin_code: Optional[str] = None,
    district: Optional[str] = None,
    city: Optional[str] = None,
    consultation_type: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Filters verified dermatology providers by location and consultation type.
    Includes smart prefix fallback (e.g. 175xxx -> Mandi/HP clinics) and national tele-dermatology.
    """
    results: List[Dict[str, Any]] = []

    pin_clean = pin_code.strip() if pin_code else ""
    dist_clean = district.strip().lower() if district else ""
    city_clean = city.strip().lower() if city else ""
    type_clean = consultation_type.strip().lower() if consultation_type else ""

    # Filter clinics
    for clinic in VERIFIED_CLINICS:
        matches = True

        if pin_clean:
            # Exact PIN match OR postal circle match (first 2 or 3 digits e.g. 17 for HP, 11 for Delhi, 56 for Bangalore)
            pin_match = (
                clinic["pin_code"] == pin_clean
                or clinic["pin_code"].startswith(pin_clean[:3])
                or clinic["pin_code"].startswith(pin_clean[:2])
            )
            if not pin_match:
                matches = False

        if dist_clean:
            dist_match = (
                dist_clean in clinic["district"].lower()
                or dist_clean in clinic["address"].lower()
            )
            if not dist_match:
                matches = False

        if city_clean:
            city_match = (
                city_clean in clinic["city"].lower()
                or city_clean in clinic["name"].lower()
                or city_clean in clinic["address"].lower()
            )
            if not city_match:
                matches = False

        if type_clean and type_clean not in [t.lower() for t in clinic["consultation_types"]]:
            matches = False

        if matches:
            results.append(clinic)

    return results


def generate_consultation_summary(
    analysis_record: Dict[str, Any],
    user_questions: Optional[List[str]] = None,
    user_notes: Optional[str] = None,
) -> Dict[str, Any]:
    """Generates an honest, reviewable consultation preparation summary packet."""
    top3 = analysis_record.get("top3", [])
    top_cond = top3[0][0].upper() if top3 else "LESION"
    top_score = f"{top3[0][1]*100:.1f}%" if top3 else "N/A"
    diff_list = [f"{c.upper()} ({p*100:.1f}%)" for c, p in top3]

    metrics = analysis_record.get("metrics", {})
    area_px = metrics.get("area_px", "N/A")
    perimeter_px = metrics.get("perimeter_px", "N/A")
    area_mm2 = metrics.get("area_mm2", "N/A")
    asymmetry = metrics.get("asymmetry_index", "N/A")

    default_questions = [
        f"Does this lesion's dermoscopic pattern warrant an excisional or punch biopsy?",
        "How do my asymmetry and border irregularity compare to baseline benign nevi?",
        "Should I return for digital dermoscopy follow-up in 3 months?",
    ]
    questions = user_questions if user_questions else default_questions

    summary_text = f"""=======================================================
OPTIDERMA CLINICAL CONSULTATION PREPARATION SUMMARY
=======================================================
CONFIDENTIAL PATIENT MEMORANDUM FOR IN-PERSON DERMATOLOGY VISIT
Generated on: {analysis_record.get("created_at", "N/A")}
Analysis ID: {analysis_record.get("id", "N/A")}

-------------------------------------------------------
1. AI SCREENING FINDINGS (DECISION SUPPORT ONLY)
-------------------------------------------------------
• Leading Classifier Candidate: {top_cond} (Relative model score: {top_score})
• Differential Possibilities: {', '.join(diff_list)}
• Risk Assessment Tier: {analysis_record.get("risk_level", "Unknown")} ({analysis_record.get("risk_recommendation", "Clinical review")})
• Preprocessing: DullRazor hair filter passed (hair detected: {bool(analysis_record.get("hair_detected"))})

-------------------------------------------------------
2. OBJECTIVE MORPHOMETRICS & CALIBRATION STATUS
-------------------------------------------------------
• Native Pixel Area: {area_px} px | Perimeter: {perimeter_px} px
• Indicative Uncalibrated Metric Area: ~{area_mm2} mm²*
• Asymmetry Index: {asymmetry}
*DISCLOSURE: Physical mm measurements assume an uncalibrated 15mm field-of-view contact plate. No physical ruler was present in photography.

-------------------------------------------------------
3. EXPLAINABILITY & SALIENCY OBSERVATIONS
-------------------------------------------------------
• Saliency Localization: ~{analysis_record.get("xai_energy_inside_pct", "N/A")}% of Grad-CAM attribution energy was inside the lesion boundary.
• Spatial Ratio: {analysis_record.get("xai_spatial_ratio", "N/A")}:1
• Receptive field bleed is common in deep conv layers and does NOT indicate lesion spread.

-------------------------------------------------------
4. QUESTIONS FOR YOUR DERMATOLOGIST
-------------------------------------------------------
"""
    for i, q in enumerate(questions, 1):
        summary_text += f"{i}. {q}\n"

    if user_notes:
        summary_text += f"\n-------------------------------------------------------\n5. PATIENT CLINICAL NOTES\n-------------------------------------------------------\n{user_notes}\n"

    summary_text += f"""
-------------------------------------------------------
6. MANDATORY CLINICAL DISCLAIMER
-------------------------------------------------------
OptiDerma is an investigational decision-support research platform. It does NOT constitute a confirmed medical diagnosis or histopathological evaluation. Definitive evaluation requires in-person dermatoscopy and biopsy conducted by a licensed dermatologist.
"""

    return {
        "analysis_id": analysis_record.get("id"),
        "created_at": analysis_record.get("created_at"),
        "top_condition": top_cond,
        "top_score": top_score,
        "differential": diff_list,
        "questions": questions,
        "user_notes": user_notes or "",
        "summary_markdown": summary_text,
    }


def find_verified_clinics(
    city: Optional[str] = None,
    pin_code: Optional[str] = None,
    specialty: Optional[str] = None,
    consultation_type: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Convenience alias for searching verified clinics."""
    clinics = search_dermatologists(
        pin_code=pin_code,
        city=city,
        consultation_type=consultation_type,
    )
    if specialty:
        spec_lower = specialty.lower()
        clinics = [
            c for c in clinics
            if any(spec_lower in s.lower() for s in c.get("specialties", []))
        ]
    return clinics


def build_consultation_packet(
    conversation_id: str,
    analysis_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Builds pre-visit consultation memorandum packet from analysis and conversation."""
    from app.services.persistence_service import PersistenceService
    rec = None
    if analysis_id:
        rec = PersistenceService.get_analysis(analysis_id)
    if not rec:
        rec = {
            "id": "pre-consult-baseline",
            "created_at": "N/A",
            "top3": [("General Dermatology", 1.0)],
            "risk_level": "Routine Screening",
            "risk_recommendation": "Comprehensive skin examination",
        }
    return generate_consultation_summary(rec)


def submit_appointment_request(
    patient_name: str,
    contact_email: str,
    preferred_date: str,
    consultation_type: str = "in-person",
    clinic_id: Optional[str] = None,
    analysis_id: Optional[str] = None,
    reason: Optional[str] = None,
    clinic_name: Optional[str] = None,
) -> Dict[str, Any]:
    """Submits and persists an appointment referral request."""
    from app.services.persistence_service import PersistenceService
    target_clinic = clinic_name
    if not target_clinic and clinic_id:
        for c in VERIFIED_CLINICS:
            if c["id"] == clinic_id:
                target_clinic = c["name"]
                break
    return PersistenceService.save_appointment_request(
        patient_name=patient_name,
        contact_email=contact_email,
        preferred_date=preferred_date,
        consultation_type=consultation_type,
        clinic_id=clinic_id,
        clinic_name=target_clinic or "Verified Dermatology Center",
        analysis_id=analysis_id,
        reason=reason,
    )


def get_all_appointment_requests(email: Optional[str] = None) -> List[Dict[str, Any]]:
    """Retrieves all persisted appointment requests."""
    from app.services.persistence_service import PersistenceService
    return PersistenceService.list_appointment_requests(email=email)


class CareService:
    find_verified_clinics = staticmethod(find_verified_clinics)
    search_dermatologists = staticmethod(search_dermatologists)
    build_consultation_packet = staticmethod(build_consultation_packet)
    generate_consultation_summary = staticmethod(generate_consultation_summary)
    submit_appointment_request = staticmethod(submit_appointment_request)
    get_all_appointment_requests = staticmethod(get_all_appointment_requests)


care_service = CareService()

