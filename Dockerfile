# SPDX-License-Identifier: AGPL-3.0-only
# Moja kolekcja — https://github.com/pozdromaciek/game-lib-sh
FROM python:3.12-slim

ARG VERSION=dev
LABEL org.opencontainers.image.title="Moja kolekcja" \
      org.opencontainers.image.description="Self-hosted library of physical games, consoles and accessories" \
      org.opencontainers.image.source="https://github.com/pozdromaciek/game-lib-sh" \
      org.opencontainers.image.url="https://github.com/pozdromaciek/game-lib-sh" \
      org.opencontainers.image.authors="pozdromaciek" \
      org.opencontainers.image.licenses="AGPL-3.0-only" \
      org.opencontainers.image.version="${VERSION}"

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 DATA_DIR=/data
WORKDIR /srv
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng fonts-dejavu-core \
 && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
 && useradd -r -u 1000 app && mkdir -p /data && chown app /data
COPY LICENSE NOTICE ./
COPY app/ ./app/
USER app
VOLUME ["/data"]
EXPOSE 8080 8443
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD python -c "import os, urllib.request as u; u.urlopen('http://127.0.0.1:%s/healthz' % os.getenv('PORT', '8080'))"
CMD ["python", "-m", "app.run"]
