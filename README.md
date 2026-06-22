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

- Backend: AWS or Alibaba Cloud container service
- Frontend: Vercel Vite app
- LLM mode: OpenAI, configured only on the backend

The backend now has a portable Docker deployment, so it does not need Render.

There is no real frontend/backend URL deadlock. Deploy in two passes:

1. Deploy the backend first with temporary permissive CORS.
2. Deploy the frontend using the backend URL.
3. Update backend CORS to the final Vercel URL.

### 1. Push this project to GitHub

Cloud providers and Vercel both deploy most easily from a GitHub repository.

### 2. Deploy backend with Docker

The backend can run anywhere that supports Docker.

Local container smoke test:

```bash
cd /Users/bytedance/Documents/mini-course-agent-app
OPENAI_API_KEY=sk-... FRONTEND_ORIGINS='*' docker compose up --build backend
```

Then verify:

```text
http://127.0.0.1:8081/
http://127.0.0.1:8081/api/health
```

The container uses:

```text
backend/Dockerfile
```

Runtime command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8081}
```

Required backend environment variables:

```env
COURSE_AGENT_MODE=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
FRONTEND_ORIGINS=*
```

`FRONTEND_ORIGINS=*` is only for the first deployment so the backend can start before the Vercel URL exists. Do not keep `*` for a student-facing production app.

### Option A: AWS App Runner backend

AWS App Runner is the simplest AWS option for this backend.

1. Push the repo to GitHub.
2. In AWS App Runner, create a service from source code.
3. Choose this repo and set source directory to:

```text
backend
```

4. Use Dockerfile deployment. App Runner should detect:

```text
backend/Dockerfile
```

5. Set environment variables:

```env
PORT=8081
COURSE_AGENT_MODE=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
FRONTEND_ORIGINS=*
```

6. Deploy and copy the App Runner service URL, for example:

```text
https://xxxxx.awsapprunner.com
```

7. Verify:

```text
https://xxxxx.awsapprunner.com/api/health
```

### Option B: Alibaba Cloud backend

Use Alibaba Cloud Container Registry plus either Elastic Container Instance, ACK, or ECS. The most straightforward path is ECS with Docker.

On an ECS machine with Docker installed:

```bash
git clone https://github.com/liwanghuan/mini-course-agent-app.git
cd mini-course-agent-app
export OPENAI_API_KEY=sk-...
export FRONTEND_ORIGINS='*'
docker compose up -d --build backend
```

Open inbound traffic for port `8081` in the ECS security group, then verify:

```text
http://<ecs-public-ip>:8081/api/health
```

For production, put a domain and HTTPS reverse proxy in front of it, for example Nginx + TLS, then use:

```text
https://api.your-domain.com/api/health
```

### 3. Deploy frontend on Vercel second

1. In Vercel, import the same GitHub repo.
2. Set the project root directory to:

```text
frontend
```

3. Set the environment variable using the real backend URL:

```env
VITE_API_BASE_URL=https://your-backend-url/api
```

Examples:

```env
VITE_API_BASE_URL=https://xxxxx.awsapprunner.com/api
```

or:

```env
VITE_API_BASE_URL=https://api.your-domain.com/api
```

4. Deploy.

After Vercel deploys, copy the frontend URL, for example:

```text
https://mini-course-agent-app.vercel.app
```

### 4. Lock backend CORS to the final frontend URL

After Vercel gives you the final frontend URL, replace the backend's temporary CORS value:

```env
FRONTEND_ORIGINS=https://mini-course-agent-app.vercel.app
```

If you use more than one frontend URL, separate them with commas:

```env
FRONTEND_ORIGINS=https://mini-course-agent-app.vercel.app,https://your-custom-domain.com
```

Then restart/redeploy the backend service.

### Deployment URL dependency summary

Use this order:

```text
Backend with FRONTEND_ORIGINS=* temporarily
  -> get backend URL
  -> Vercel frontend with VITE_API_BASE_URL=<Backend URL>/api
  -> get Vercel frontend URL
  -> Backend FRONTEND_ORIGINS=<Vercel URL>
```

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
