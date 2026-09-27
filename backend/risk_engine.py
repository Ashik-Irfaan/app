"""Explainable weighted risk-scoring engine (Random-Forest style feature importances)."""

QUESTIONS = [
    {"id": "work_hours", "category": "Work", "text": "On average, how many hours do you work per day?",
     "options": ["Less than 8 hours", "8 – 10 hours", "10 – 12 hours", "More than 12 hours"], "weight": 0.08,
     "label": "Long working hours"},
    {"id": "night_duty", "category": "Work", "text": "How many night duties do you perform in a week?",
     "options": ["None", "1 – 2 nights", "3 – 4 nights", "5 or more nights"], "weight": 0.07,
     "label": "Frequent night duties"},
    {"id": "workload", "category": "Work", "text": "How would you describe your current workload?",
     "options": ["Light", "Moderate", "Heavy", "Overwhelming"], "weight": 0.09, "label": "Heavy workload"},
    {"id": "transfers", "category": "Work", "text": "How many times have you been transferred in the last 2 years?",
     "options": ["None", "Once", "Twice", "3 or more times"], "weight": 0.05, "label": "Frequent transfers"},
    {"id": "deployment", "category": "Work", "text": "How long has your current / most recent deployment been?",
     "options": ["Under 3 months", "3 – 6 months", "6 – 12 months", "Over 12 months"], "weight": 0.07,
     "label": "Extended deployment"},
    {"id": "leave", "category": "Work", "text": "How much leave have you been able to take in the last 6 months?",
     "options": ["Adequate", "Some", "Very little", "None"], "weight": 0.08, "label": "Insufficient leave"},
    {"id": "sleep", "category": "Wellness", "text": "How well have you been sleeping recently?",
     "options": ["Very well", "Fairly well", "Poorly", "Very poorly"], "weight": 0.12, "label": "Poor sleep quality"},
    {"id": "mood", "category": "Wellness", "text": "How has your overall mood been lately?",
     "options": ["Positive", "Okay", "Low", "Very low"], "weight": 0.10, "label": "Low mood"},
    {"id": "exhaustion", "category": "Wellness", "text": "How often do you feel mentally exhausted?",
     "options": ["Rarely", "Sometimes", "Often", "Almost always"], "weight": 0.12, "label": "Mental exhaustion"},
    {"id": "anxiety", "category": "Wellness", "text": "How frequently do you feel anxious or on edge?",
     "options": ["Rarely", "Sometimes", "Often", "Almost daily"], "weight": 0.11, "label": "Frequent anxiety"},
    {"id": "family", "category": "Wellness", "text": "How often are you able to connect with family or friends?",
     "options": ["Regularly", "Occasionally", "Rarely", "Almost never"], "weight": 0.06,
     "label": "Social isolation"},
    {"id": "trauma", "category": "Wellness", "text": "Have you been exposed to distressing incidents recently?",
     "options": ["No", "Once", "A few times", "Frequently"], "weight": 0.05, "label": "Exposure to distressing incidents"},
]

QUESTION_MAP = {q["id"]: q for q in QUESTIONS}

RECOMMENDATIONS = {
    "low": {
        "title": "You're doing well",
        "summary": "Your responses and available indicators suggest a low level of stress risk. Keep up your healthy routines.",
        "actions": [
            "Take regular short breaks during duty hours",
            "Maintain 7–8 hours of sleep where possible",
            "Stay physically active with light exercise",
            "Practice 5 minutes of breathing relaxation daily",
            "Stay connected with family and friends",
        ],
        "pathway": "Continue periodic wellness check-ins.",
    },
    "medium": {
        "title": "Some indicators need attention",
        "summary": "Your responses suggest a moderate level of stress risk. Focused self-care and regular check-ins can help.",
        "actions": [
            "Try a guided stress-management activity today",
            "Follow a fixed wind-down routine before sleep",
            "Talk to a trusted colleague or family member",
            "Schedule a wellness check-in within 7 days",
            "Optional: connect with a counsellor through Mind Well",
        ],
        "pathway": "Continued monitoring with optional counselling access.",
    },
    "high": {
        "title": "Additional support may be helpful",
        "summary": "Your recent wellness indicators suggest that additional support may be helpful. You are not alone — a qualified professional can help.",
        "actions": [
            "Reach out to a Mind Well counsellor today",
            "Share how you are feeling with someone you trust",
            "Prioritise rest — avoid extra duties where possible",
            "Use the AI companion for a calm, supportive conversation",
            "A welfare officer will be notified confidentially for support",
        ],
        "pathway": "Human review → qualified counsellor → counselling → follow-up monitoring.",
    },
}


def compute_risk(answers: dict, heart_rate: int | None = None) -> dict:
    """answers: {question_id: option_index (0-3)}"""
    contributions = []
    score = 0.0
    for q in QUESTIONS:
        v = int(answers.get(q["id"], 0))
        v = max(0, min(3, v))
        c = q["weight"] * (v / 3.0) * 100
        score += c
        contributions.append({
            "id": q["id"],
            "label": q["label"],
            "category": q["category"],
            "contribution": round(c, 1),
            "severity": v,
            "answer": q["options"][v],
        })

    hr_note = None
    if heart_rate is not None:
        # Elevated resting heart rate adds up to +10 risk points
        if heart_rate > 100:
            bump = 10.0
        elif heart_rate > 90:
            bump = 6.0
        elif heart_rate > 80:
            bump = 3.0
        else:
            bump = 0.0
        if bump:
            score += bump
            contributions.append({
                "id": "heart_rate", "label": "Elevated resting heart rate", "category": "Wearable",
                "contribution": bump, "severity": 3 if bump >= 6 else 2, "answer": f"{heart_rate} bpm",
            })
        hr_note = f"Resting heart rate {heart_rate} bpm from connected wearable"

    score = round(min(100.0, score), 1)
    if score < 35:
        level = "low"
    elif score < 60:
        level = "medium"
    else:
        level = "high"

    top = sorted([c for c in contributions if c["severity"] >= 2], key=lambda c: -c["contribution"])[:4]
    rec = RECOMMENDATIONS[level]
    return {
        "score": score,
        "level": level,
        "top_factors": top,
        "all_factors": contributions,
        "heart_rate_note": hr_note,
        "title": rec["title"],
        "summary": rec["summary"],
        "actions": rec["actions"],
        "pathway": rec["pathway"],
        "model": "MindWell Weighted Ensemble v1 (Random-Forest style importances)",
    }
