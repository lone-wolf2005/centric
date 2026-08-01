# Centric Material Tracking System

AI-based centering and scaffolding rental management for RR Thulasi / RR Groups — built from the Mazenet proposal, FRD, and May 2026 rent statement Excel.

## Stack

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind CSS
- **Backend:** NestJS + Prisma + SQLite (JWT auth)
- **AI Service:** Python FastAPI + Ultralytics YOLO11 segmentation

## YOLO model

Uses trained weights from:

`C:\Users\ajith\OneDrive\Desktop\projects\dataset\runs\segment\train\weights\best.pt`

Override with env `YOLO_MODEL_PATH` if needed.

## Features

- Supervisor web app for inward/outward shifting with AI match/mismatch beeps
- 11 material categories with real size rates from rent statement Excel
- 33 project sites seeded from Excel + Erode Godown
- Monthly billing (Excel formula: days × qty × rate/month ÷ 30)
- Quotations, indents, site transfers, approvals, stock by location
- Reports: inward/outward, item summary, AI accuracy, exceptions, utilization, rent statements
- Tally sync stubs (Item master / DC / GRN / Invoice contracts)

## Getting started

### 1. NestJS API

```bash
cd api
npm install
npx prisma db push
npm run seed
npm run start:dev
```

API: `http://localhost:3001/api`

**Demo login:** `supervisor@centric.local` / `password`  
Approver: `approver@centric.local` / `password`

Set in `api/.env`:

```
DATABASE_URL="file:./dev.db"
JWT_SECRET="centric-dev-secret-change-me"
PORT=3001
AI_SERVICE_URL="http://127.0.0.1:5001"
```

### 2. AI service

```bash
cd ai-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 5001
```

### 3. Frontend

```bash
npm install
npm run dev
```

App: `http://localhost:3000`

`.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

## Project structure

```
centric/
├── app/                 # Next.js pages
├── components/
├── lib/
├── ai-service/          # YOLO FastAPI
├── api/                 # NestJS + Prisma (active backend)
└── backend/             # Legacy Laravel (not used)
```

## Seed data

`api/prisma/data/excel_catalog.json` is generated from the Centering Rent Statement workbook (May 2026): sites, normalized sizes mapped to the 11 proposal categories, rates, and usage lines used to raise sample monthly bills.
