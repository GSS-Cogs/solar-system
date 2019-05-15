#!/bin/bash

wait-for-it.sh -t 0 sqldb:3306
fetch_sheet.py || true
fetch_whitehall.py || true
fetch_ons.py || true