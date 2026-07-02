# 基金小助手 (Investment Assistant)

> 基金数据分析与定投回测工具 — 支持场外基金与ETF，提供定投回测、组合回测、综合评分排名功能

## 功能概览

### 1. 数据拉取
- 支持**场外基金**（净值数据）和 **ETF**（K线数据）
- 数据源：[AKShare](https://akshare.akfamily.xyz/) 开源金融数据接口
- 预置 15 只热门基金，一键批量拉取
- 自动识别基金类型（51/56/58/15开头为ETF，16开头为LOF场外基金）
- ETF K线接口失败时自动回退到净值接口
- 批量拉取自带限流保护（2秒间隔 + 3次重试）

### 2. 定投回测
- 支持 **每日 / 每周 / 双周 / 每月** 四种定投周期
- 可配置每次定投金额、回测时长（180天~5年）
- 输出指标：总收益率、年化收益率、最大回撤、定投次数
- 收益曲线图 + 累计成本对比 + 定投明细表

### 3. 组合回测
- 选择多只基金，按权重配置组合
- 添加/删除持仓时自动均分权重，支持手动调整
- 组合整体收益曲线 + 持仓分布饼图
- 各基金独立持仓明细（投入/市值/收益率）

### 4. 综合评分排名
- **三维度加权评分**：
  - 收益维度（40%）：年化收益、近1/3月收益
  - 风险维度（35%）：最大回撤、波动率、夏普比率
  - 基本面维度（25%）：基金规模、管理费率、基金经理
- 支持按类型筛选、按分数范围过滤、按维度排序
- 雷达图展示各维度得分

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Python + FastAPI + SQLAlchemy + SQLite |
| 数据源 | AKShare（东方财富/天天基金） |
| 前端 | React 18 + TypeScript + Vite |
| 图表 | ECharts |
| 样式 | TailwindCSS（深色主题） |
| 状态管理 | Zustand |
| 图标 | Lucide Icons |

## 项目结构

```
chicken_assitant/
├── backend/
│   ├── requirements.txt
│   ├── fund_data.db              # SQLite 数据库
│   └── app/
│       ├── main.py               # FastAPI 入口
│       ├── database.py           # 数据库连接
│       ├── models.py             # 数据模型（FundInfo / FundNav / FundKline）
│       ├── schemas.py            # Pydantic 模型
│       ├── api/
│       │   ├── funds.py          # 基金数据 API + 批量拉取
│       │   ├── backtest.py       # 定投回测 API
│       │   ├── portfolio.py      # 组合回测 API
│       │   └── scoring.py        # 评分排名 API
│       └── services/
│           ├── data_fetcher.py   # AKShare 数据拉取
│           ├── backtest.py       # 定投回测引擎
│           ├── portfolio.py      # 组合回测引擎
│           └── scoring.py        # 评分计算引擎
└── frontend/
    ├── package.json
    └── src/
        ├── App.tsx               # 路由
        ├── components/
        │   ├── Sidebar.tsx       # 侧边栏导航
        │   ├── SearchBar.tsx      # 基金搜索
        │   └── FundCard.tsx       # 基金卡片
        ├── pages/
        │   ├── Home.tsx          # 首页仪表盘
        │   ├── Backtest.tsx      # 定投回测
        │   ├── Portfolio.tsx     # 组合回测
        │   └── Scoring.tsx       # 评分排名
        └── lib/
            └── api.ts            # API 请求封装
```

## 快速开始

### 后端

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

后端运行在 `http://localhost:8000`

### 前端

```bash
cd frontend
npm install
npm run dev
```

前端运行在 `http://localhost:5173`

## API 接口

### 基金数据
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/funds/list` | 获取基金列表（含数据条数） |
| GET | `/funds/popular` | 获取预置热门基金列表 |
| POST | `/funds/fetch` | 拉取单只基金数据 |
| POST | `/funds/batch-fetch` | 批量拉取基金数据 |
| DELETE | `/funds/{code}` | 删除基金 |

### 定投回测
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/backtest/dca` | 定投回测 |

### 组合回测
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/portfolio/backtest` | 组合定投回测 |

### 评分排名
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/scoring/rank` | 综合评分排名（支持筛选排序） |
| GET | `/scoring/{code}/detail` | 单只基金评分详情 |

## 预置热门基金

| 代码 | 名称 | 类型 |
|---|---|---|
| 510300 | 沪深300ETF | 宽基ETF |
| 510500 | 中证500ETF | 宽基ETF |
| 159915 | 创业板ETF | 宽基ETF |
| 588000 | 科创50ETF | 宽基ETF |
| 512100 | 中证1000ETF | 宽基ETF |
| 512690 | 白酒ETF | 行业ETF |
| 159995 | 芯片ETF | 行业ETF |
| 512170 | 医疗ETF | 行业ETF |
| 512660 | 军工ETF | 行业ETF |
| 515790 | 光伏ETF | 行业ETF |
| 110011 | 易方达优质精选混合 | 场外基金 |
| 003834 | 华夏能源革新 | 场外基金 |
| 161725 | 招商中证白酒指数 | LOF |
| 005827 | 易方达蓝筹精选混合 | 场外基金 |
| 001938 | 中欧时代先锋 | 场外基金 |

## License

MIT
