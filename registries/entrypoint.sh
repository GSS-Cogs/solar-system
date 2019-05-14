#!/bin/bash

(sleep 60; /etc/periodic/daily/fetch.sh) &

exec "$@"
