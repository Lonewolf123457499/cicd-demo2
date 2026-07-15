FROM python:3.12.9-alpine3.21

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apk update && apk upgrade --no-cache && rm -rf /var/cache/apk/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8080

CMD ["sh", "-c", "cd /app && uvicorn app.main:app --host 0.0.0.0 --port 8080"]
