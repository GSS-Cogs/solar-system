FROM python:3-alpine
MAINTAINER Alex Tucker <alex@floop.org.uk>

COPY requirements.txt /usr/local/registry/
RUN \
  apk add --no-cache bash mariadb-connector-c-dev tini && \
  apk add --no-cache --virtual .build-deps \
        build-base \
        mariadb-dev && \
  pip install --no-cache-dir -r /usr/local/registry/requirements.txt && \
  apk del .build-deps
COPY *.py /usr/local/bin/
COPY wait-for-it.sh /usr/local/bin/
COPY fetch.sh /etc/periodic/daily/
COPY entrypoint.sh /
WORKDIR /usr/local/registry
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/entrypoint.sh", "crond", "-f"]