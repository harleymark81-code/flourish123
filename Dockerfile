FROM python:3.11-slim

WORKDIR /app

COPY backend/ ./backend/

RUN pip install --no-cache-dir -r backend/requirements.txt

EXPOSE 8000

CMD cd backend && uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}
