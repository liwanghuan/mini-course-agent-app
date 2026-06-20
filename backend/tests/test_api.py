from fastapi.testclient import TestClient

from app.course.agents import INERTIA_SENTENCE, PUCK_QUESTION
from app.main import app


def test_newtons_demo_endpoint_returns_required_flow():
    client = TestClient(app)

    response = client.post("/api/course/demo/newtons-laws")

    assert response.status_code == 200
    memory = response.json()["memory"]
    assert memory["topic"] == "Newton's Laws"
    assert memory["learner_level"] == "beginner"
    assert INERTIA_SENTENCE in memory["taught_parts"][0]["content"]
    assert memory["quiz_history"][0]["question"] == PUCK_QUESTION
    assert memory["answer_history"][0]["answer_text"] == "yes"
    assert memory["grade_history"][0]["is_correct"] is False
    assert memory["grade_history"][0]["correct_answer"] == "no"
    assert memory["weak_spots"][0]["concept"] == "inertia"


def test_create_session_accepts_user_topic():
    client = TestClient(app)

    response = client.post("/api/course/sessions", json={"topic": "Photosynthesis", "learner_level": "beginner"})

    assert response.status_code == 200
    memory = response.json()["memory"]
    assert memory["topic"] == "Photosynthesis"
    assert memory["learner_level"] == "beginner"
    assert memory["quiz_history"] == []


def test_create_session_rejects_blank_topic():
    client = TestClient(app)

    response = client.post("/api/course/sessions", json={"topic": "   ", "learner_level": "beginner"})

    assert response.status_code == 422


def test_submit_answer_rejects_blank_answer():
    client = TestClient(app)

    response = client.post("/api/course/sessions/course_1/answers/stream", json={"quiz_id": "quiz_1", "answer_text": "   "})

    assert response.status_code == 422
