FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && useradd -r -u 10001 ghost
COPY ghost_engine ./ghost_engine
USER ghost
EXPOSE 8001
CMD ["uvicorn", "ghost_engine.api:app", "--host", "0.0.0.0", "--port", "8001"]
