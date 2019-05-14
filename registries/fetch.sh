#!/bin/bash

wait-for-it.sh -t 0 sqldb:3306
fetch_whitehall.py
fetch_ons.py
