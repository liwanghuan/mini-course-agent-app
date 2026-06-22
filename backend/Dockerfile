FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8081

WORKDIR /app

COPY requirements.txt pyproject.toml ./
COPY app ./app

RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 8081

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8081}"]
