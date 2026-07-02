from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.api import funds, backtest, scoring, portfolio

# 创建数据库表
Base.metadata.create_all(bind=engine)

app = FastAPI(title="基金小助手", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
