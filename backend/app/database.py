import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

# Render 提供 RENDER_DATA_DIR 环境变量用于持久化数据目录
# 本地开发时回退到当前目录下的 fund_data.db
_data_dir = Path(os.environ.get("RENDER_DATA_DIR", "."))
_data_dir.mkdir(parents=True, exist_ok=True)
_db_path = _data_dir / "fund_data.db"
DATABASE_URL = f"sqlite:///{_db_path}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
