# 个人财务记账系统设计文档

## 1. 项目概述

### 1.1 背景和目标

本项目旨在创建一个个人财务记账系统，使用Beancount作为数据存储，通过Telegram机器人提供用户交互界面，并利用OpenAI API实现自然语言处理，同时支持从Gmail自动获取账单信息实现自动记账。

### 1.2 系统特点

- 使用Beancount作为核心记账引擎，支持复式记账
- 通过Telegram机器人实现自然语言交互
- 利用OpenAI API处理用户指令和自然语言查询
- 自动从Gmail收集账单并生成记账条目
- 基于TypeScript实现，提供类型安全和更好的开发体验

## 2. 系统架构

### 2.1 架构概览

系统采用六边形架构(Hexagonal Architecture)，将领域逻辑与外部依赖明确分离

### 2.2 主要组件

1. **核心领域层** - 包含业务实体和逻辑
2. **应用服务层** - 协调领域对象完成用例
3. **接口适配器层** - 将外部请求转换为应用服务调用
4. **基础设施层** - 实现与外部系统的集成

### 2.3 数据流图

```
用户 → Telegram → 自然语言处理 → 命令解析 → 领域服务 → Beancount文件
Gmail → 邮件解析 → 账单提取 → 领域服务 → Beancount文件
用户 ← Telegram ← 结果格式化 ← 查询服务 ← Beancount查询
```

## 3. 详细设计文档

系统的详细设计已拆分为以下文档：

1. [领域模型和服务设计](domain-design.md) - 包含核心实体、值对象和领域服务的详细设计
2. [应用服务和适配器设计](application-design.md) - 包含应用层服务、适配器和用例实现的详细设计

## 4. 技术实现细节

### 4.1 项目结构

```
src/
├── domain/                   # 领域模型和服务
│   ├── models/               # 领域实体和值对象
│   ├── services/             # 领域服务
│   └── repositories/         # 存储库接口
├── application/              # 应用服务和用例
│   ├── useCases/
│   └── services/
├── interfaces/               # 接口适配器
│   ├── telegram/
│   ├── openai/
│   └── gmail/
└── infrastructure/           # 基础设施
    ├── beancount/
    ├── openai/
    ├── telegram/
    └── gmail/
```

### 4.2 依赖包

```json
{
  "dependencies": {
    "telegraf": "^4.12.2",
    "openai": "^4.6.0",
    "googleapis": "^118.0.0",
    "dotenv": "^16.0.3",
    "node-cron": "^3.0.2",
    "moment": "^2.29.4"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^18.0.0",
    "@types/node-cron": "^3.0.0",
    "ts-node": "^10.9.1",
    "ts-jest": "^29.0.0",
    "@types/jest": "^29.0.0"
  }
}
```

### 4.3 环境变量

```typescript
// .env
OPENAI_API_KEY=your_openai_api_key
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
BEANCOUNT_FILE_PATH=/path/to/your/ledger.beancount
GMAIL_CREDENTIALS_PATH=/path/to/credentials.json
GMAIL_TOKENS_PATH=/path/to/token.json
```

### 4.4 启动流程

```typescript
async function main(): Promise<void> {
  // 初始化存储库和适配器
  const beancountFileRepository = new BeancountFileRepository(process.env.BEANCOUNT_FILE_PATH);
  const beancountQueryAdapter = new BeancountQueryAdapter(process.env.BEANCOUNT_FILE_PATH);
  const openaiAdapter = new OpenAIAdapter(process.env.OPENAI_API_KEY);
  
  // 初始化领域服务
  const accountingService = new AccountingService(beancountFileRepository);
  const queryService = new QueryService(beancountQueryAdapter);
  const nlpService = new NLPService(openaiAdapter);
  
  // 初始化应用服务
  const userInteractionService = new UserInteractionService(
    nlpService, accountingService, queryService
  );
  
  // 初始化外部适配器
  const telegramAdapter = new TelegramAdapter(
    process.env.TELEGRAM_BOT_TOKEN, userInteractionService
  );
  telegramAdapter.init();
  
  // 初始化Gmail集成
  const credentials = JSON.parse(fs.readFileSync(process.env.GMAIL_CREDENTIALS_PATH));
  const tokens = JSON.parse(fs.readFileSync(process.env.GMAIL_TOKENS_PATH));
  
  const gmailAdapter = new GmailAdapter(credentials, tokens);
  await gmailAdapter.init();
  
  const billProcessingService = new BillProcessingService(nlpService, accountingService);
  const automationService = new AutomationService(gmailAdapter, billProcessingService);
  
  // 设置定时任务
  cron.schedule('0 */2 * * *', async () => {
    console.log('正在检查Gmail账单...');
    await automationService.scheduledCheck();
  });
  
  console.log('记账系统已启动!');
}
```

## 5. 部署和运维

### 5.1 部署方式

推荐使用Docker容器化部署，简化环境配置和管理：

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
```

## 6. 扩展和未来计划

### 6.1 潜在扩展

1. **Web界面**：添加一个简单的Web界面来可视化财务数据
2. **多用户支持**：扩展系统支持多个用户，每个用户有独立的Beancount文件
3. **报表生成**：支持生成PDF或电子表格格式的财务报表
4. **投资跟踪**：增加股票、基金等投资资产的自动价格更新
5. **预算管理**：添加预算设置和跟踪功能

### 6.2 技术改进

1. **测试覆盖**：增加单元测试和集成测试
2. **性能优化**：针对大型Beancount文件的查询性能优化
3. **API扩展**：提供REST API以支持更多客户端
4. **本地化支持**：增加多语言支持

## 7. 总结

本设计文档提供了一个基于领域驱动设计原则的个人财务记账系统架构。系统将Beancount作为核心记账引擎，通过Telegram机器人提供自然语言交互界面，并利用OpenAI API实现智能对话和指令解析。系统还能够自动从Gmail获取账单信息并进行记账，大大减轻了用户的记账负担。

通过清晰的领域模型划分和六边形架构设计，系统保持了良好的可维护性和可扩展性，为未来的功能增强奠定了坚实基础。
