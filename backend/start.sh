#!/bin/bash
# Render 启动脚本
set -e

echo "Starting gunicorn on port ${PORT:-8000}..."
exec gunicorn -c gunicorn_config.py app.main:app
