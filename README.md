# Mini-Course Multi-Agent App

A full-stack product where a learner enters any topic and an Orchestrator coordinates specialist agents to plan, teach, quiz, and grade a beginner mini-course. Planner, Tutor, Quiz Maker, and Grader all read/write the same shared memory so the learner can see what the system knows at each step.

Newton's Laws remains as a deterministic example/regression, but the main product flow is topic-driven.

## Structure

- `backend/` — Python FastAPI app with deterministic fake agents and OpenAI/ChatGPT-backed role agents.
- `frontend/` — TypeScript React/Vite app for the mini-course workbench.
- `run-dev.sh` — one-command local runner for backend port `8081` and frontend port `5175`.
- `SKILLS.md` — project-specific agent and coding guidance.

## Product flow

1. Learner enters a topic and learner level.
2. Orchestrator creates a shared-memory course session.
3. Planner writes a topic-specific lesson plan.
4. Tutor teaches Part 1 from the plan.
5. Quiz Maker creates a concept-check question.
6. Learner submits an answer.
7. Grader marks it, gives feedback, and logs weak spots into shared memory.

## Newton example/regression

The example path still verifies:

1. Topic is `Newton's Laws`.
2. Learner level is `beginner`.
3. Tutor includes: “A ball stays still until you kick it — that's inertia.”
4. Quiz Maker asks: “On frictionless ice, does a moving puck slow down on its own?”
5. Learner answer `yes` is wrong.
6. Correct answer is `no`.
7. Shared memory logs `inertia` as a weak spot.

## Run locally

```bash
cd /Users/bytedance/Documents/mini-course-agent-app
./run-dev.sh
```

The script starts:

- Backend: `http://127.0.0.1:8081`
- Frontend: `http://127.0.0.1:5175`

It also stops any old process already using ports `8081` or `5175` before starting fresh servers.

## Backend setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e '.[test]'
uvicorn app.main:app --reload --port 8081
```

Default mode is `fake`, which is deterministic and does not call any external LLM provider.

For ChatGPT/OpenAI-backed agents:

```bash
export OPENAI_API_KEY=sk-...
export COURSE_AGENT_MODE=openai
export OPENAI_MODEL=gpt-4.1-mini
```

Optional:

```bash
export OPENAI_BASE_URL=https://api.openai.com/v1
```

## Frontend setup

```bash
cd frontend
npm install
VITE_API_BASE_URL=http://127.0.0.1:8081/api npm run dev -- --host 127.0.0.1 --port 5175 --strictPort
```

## Deploy to public URLs

Recommended production setup:

- Backend: Render Web Service
- Frontend: Vercel Vite app
- LLM mode: OpenAI, configured only on the backend

### 1. Push this project to GitHub

Render and Vercel both deploy most easily from a GitHub repository.

### 2. Deploy backend on Render

1. In Render, create a new **Blueprint** or **Web Service** from this repo.
2. If using the included `render.yaml`, Render will use:
   - Root directory: `backend`
   - Build command: `pip install -r requirements.txt`
   - Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Health check: `/api/health`
3. Set environment variables in Render:

```env
COURSE_AGENT_MODE=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
FRONTEND_ORIGINS=https://your-vercel-app.vercel.app
```

After Render deploys, copy the backend URL, for example:

```text
https://mini-course-agent-backend.onrender.com
```

### 3. Deploy frontend on Vercel

1. In Vercel, import the same GitHub repo.
2. Set the project root directory to:

```text
frontend
```

3. Set the environment variable:

```env
VITE_API_BASE_URL=https://your-render-backend.onrender.com/api
```

4. Deploy.

### 4. Update backend CORS after Vercel URL is known

After Vercel gives you the final frontend URL, update Render's backend environment variable:

```env
FRONTEND_ORIGINS=https://your-vercel-app.vercel.app
```

If you use more than one frontend URL, separate them with commas:

```env
FRONTEND_ORIGINS=https://your-vercel-app.vercel.app,https://your-custom-domain.com
```

Then redeploy/restart the Render service.

## Verification

Backend:

```bash
cd backend
source .venv/bin/activate
python -m pytest
```

Frontend:

```bash
cd frontend
npm run typecheck
npm run test
npm run build
```
