FROM python:3-alpine
MAINTAINER Alex Tucker <alex@floop.org.uk>

COPY requirements.txt /usr/local/registry/
RUN \
  apk add --no-cache bash mariadb-connector-c-dev && \
  apk add --no-cache --virtual .build-deps \
        build-base \
        mariadb-dev && \
  pip install --no-cache-dir -r /usr/local/registry/requirements.txt && \
  apk del .build-deps
COPY *.py /usr/local/registry
WORKDIR /usr/local/registry
CMD ["python", "fetch_whitehall.py"]