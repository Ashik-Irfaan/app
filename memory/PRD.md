# Mind Well – PRD

## Original problem statement
SIH 2026 PS 26186 (MHA / CRPF): AI-Based Predictive Personnel Stress and Welfare Monitoring System for Uniformed Forces. Prototype mobile app "Mind Well" with: secure login for personnel (Service ID) and therapists (email), home with stress-history chart, 10+ question wellness test, AI friendly/motivational chat button, wearable/heart-rate connection, explainable risk prediction (Low/Medium/High) with support pathway, therapist dashboard (anonymized risk list, alerts, trends, follow-up), privacy & consent.

## User choices
- AI chat: GPT-5.4 Mini via Emergent LLM key
- Auth: JWT; personnel = Service ID + password (identifier-first "secure" flow), therapist = email + password
- Risk engine: weighted explainable scoring (Random-Forest style importances) + auto alert on HIGH + optional wearable heart-rate input
- Therapist: dashboard with anonymized risk list, alerts, trends, mark follow-up
- Design: calm deep teal/navy + soft green, professional

## Architecture
- Backend: FastAPI + Motor/MongoDB (`/app/backend/server.py`, `risk_engine.py`, `seed.py`), JWT (PyJWT) + bcrypt, emergentintegrations LlmChat (openai/gpt-5.4-mini)
- Frontend: Expo Router (SDK 57), react-query, react-native-gifted-charts, @react-native-vector-icons/ionicons, react-native-keyboard-controller, theme tokens in `src/theme.ts`
- Routes: `(auth)/login|register`, `(personnel)/index|chat|wearable|profile` tabs, `assessment/index|result`, `(therapist)/index|alerts|profile` tabs, `therapist/personnel/[id]`
- Collections: users, assessments, alerts, chat_messages (soft-delete via deleted_at)

## User personas
- Personnel (CRPF constable etc.): self-assess, see risk trend, chat with Mitra AI, connect wearable, request counsellor
- Therapist / welfare officer: anonymized risk overview, alerts, trends, record follow-up interventions

## Implemented (2026-06)
- Role-based JWT auth, seeded demo accounts (see /app/memory/test_credentials.md)
- 12-question wellness assessment → explainable risk score, top factors, recommendations, support pathway; HIGH auto-creates therapist alert
- Personnel home: risk card, stress history line chart, today's metrics, quick actions, high-risk attention banner, privacy note
- Mitra AI chat (gpt-5.4-mini) with persisted history, suggestions, clear
- Wearable simulated pairing → heart rate / HRV / sleep / steps; HR feeds into risk score
- Therapist dashboard (counts, filter chips, anonymized list, trend), alerts with follow-up notes, personnel detail with trend chart & recommended interventions
- Profile: consent toggle, privacy framework, logout
- Testing: backend 25/25 pass, frontend flows verified (iteration_1)

## Backlog
- P0: none
- P1: streaming chat responses; push/in-app notifications to therapist on new alert; scheduled periodic check-in reminders
- P2: real BLE/HealthKit/Health Connect wearable integration; HRMS data import (leave/deployment/transfer CSV); trainee-counsellor supervised module; multilingual (Hindi) UI; dark mode; export anonymized welfare reports for commanders
