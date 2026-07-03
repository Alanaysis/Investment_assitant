"""Gunicorn 生产环境配置

Render 会在 PORT 环境变量中注入监听端口。
使用 uvicorn worker 运行 FastAPI 应用。
"""
import os
import multiprocessing

# 监听端口（Render 通过 PORT 注入）
bind = f"0.0.0.0:{os.environ.get('PORT', '8000')}"

# 工作进程数：取 CPU 核心数与 4 的最小值
workers = multiprocessing.cpu_count() * 2 + 1
workers = min(workers, 4)

# 使用 uvicorn worker 支持 ASGI
worker_class = "uvicorn.workers.UvicornWorker"

# 超时设置（AKShare 数据拉取可能较慢）
timeout = 120
graceful_timeout = 30
keepalive = 5

# 日志
accesslog = "-"
errorlog = "-"
loglevel = "info"

# 预加载应用，节省内存
preload_app = True
