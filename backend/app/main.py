import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.api import funds, backtest, scoring, portfolio

# 创建数据库表
Base.metadata.create_all(bind=engine)

app = FastAPI(title="基金小助手", version="0.1.0")

# 允许的来源：通过环境变量配置（Vercel 域名等）
# 默认允许本地开发前端访问
_allowed_origins = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:4173,http://127.0.0.1:5173",
).split(",")
_allowed_origins = [o.strip() for o in _allowed_origins if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(funds.router)
app.include_router(backtest.router)
app.include_router(scoring.router)
app.include_router(portfolio.router)


@app.get("/")
def root():
    return {"message": "基金小助手 API 运行中"}
