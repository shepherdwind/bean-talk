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

## 3. 领域模型

### 3.1 核心实体

#### 3.1.1 交易(Transaction)

```typescript
interface Transaction {
  date: Date;
  description: string;
  entries: Entry[];
  metadata: Record<string, unknown>;
}

class TransactionImpl implements Transaction {
  constructor(
    public date: Date,
    public description: string,
    public entries: Entry[] = [],
    public metadata: Record<string, unknown> = {}
  ) {}

  addEntry(entry: Entry): void {
    this.entries.push(entry);
  }

  isBalanced(): boolean {
    return this.entries.reduce((sum, entry) => sum + entry.amount.value, 0) === 0;
  }
}
```

#### 3.1.2 账户(Account)

```typescript
type AccountType = 'Assets' | 'Liabilities' | 'Income' | 'Expenses' | 'Equity';

interface Account {
  name: string;
  type: AccountType;
}

class AccountImpl implements Account {
  constructor(
    public name: string,
    public type: AccountType
  ) {}

  getHierarchy(): string[] {
    return this.name.split(':');
  }
}
```

#### 3.1.3 交易条目(Entry/Posting)

```typescript
interface Entry {
  account: Account;
  amount: Amount;
  metadata: Record<string, unknown>;
}

class EntryImpl implements Entry {
  constructor(
    public account: Account,
    public amount: Amount,
    public metadata: Record<string, unknown> = {}
  ) {}
}
```

#### 3.1.4 账单(Bill)

```typescript
interface Bill {
  source: string;
  content: string;
  date: Date;
}

class BillImpl implements Bill {
  constructor(
    public source: string,
    public content: string,
    public date: Date
  ) {}

  async parseToTransaction(): Promise<Transaction> {
    // Implementation details
  }
}
```

### 3.2 值对象

#### 3.2.1 货币(Currency)

```typescript
interface Currency {
  code: string;
  name: string;
}

class CurrencyImpl implements Currency {
  constructor(
    public code: string,
    public name: string = ''
  ) {}

  format(amount: number): string {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: this.code
    }).format(amount);
  }
}
```

#### 3.2.2 金额(Amount)

```typescript
interface Amount {
  value: number;
  currency: Currency;
}

class AmountImpl implements Amount {
  constructor(
    public value: number,
    public currency: Currency
  ) {}

  format(): string {
    return this.currency.format(this.value);
  }
}
```

## 4. 领域服务

### 4.1 记账服务(AccountingService)

```typescript
interface IAccountingService {
  addTransaction(transaction: Transaction): Promise<void>;
  updateTransaction(id: string, transaction: Transaction): Promise<void>;
  deleteTransaction(id: string): Promise<void>;
}

class AccountingService implements IAccountingService {
  constructor(private transactionRepository: ITransactionRepository) {}

  async addTransaction(transaction: Transaction): Promise<void> {
    // Implementation
  }

  async updateTransaction(id: string, transaction: Transaction): Promise<void> {
    // Implementation
  }

  async deleteTransaction(id: string): Promise<void> {
    // Implementation
  }
}
```

### 4.2 查询服务(QueryService)

```typescript
interface IQueryService {
  getBalance(account?: string, date?: Date): Promise<Amount>;
  getTransactions(filters: TransactionFilters): Promise<Transaction[]>;
  getMonthlyExpenses(year: number, month: number): Promise<MonthlyExpenseReport>;
}

class QueryService implements IQueryService {
  constructor(private beancountQueryAdapter: IBeancountQueryAdapter) {}

  async getBalance(account?: string, date?: Date): Promise<Amount> {
    // Implementation
  }

  async getTransactions(filters: TransactionFilters): Promise<Transaction[]> {
    // Implementation
  }

  async getMonthlyExpenses(year: number, month: number): Promise<MonthlyExpenseReport> {
    // Implementation
  }
}
```

### 4.3 账单处理服务(BillProcessingService)

```typescript
interface IBillProcessingService {
  processBill(bill: Bill): Promise<Transaction>;
}

class BillProcessingService implements IBillProcessingService {
  constructor(
    private nlpService: INLPService,
    private accountingService: IAccountingService
  ) {}

  async processBill(bill: Bill): Promise<Transaction> {
    // Implementation
  }
}
```

### 4.4 自然语言处理服务(NLPService)

```typescript
interface INLPService {
  parseUserCommand(userId: string, message: string): Promise<Command>;
  parseBillContent(subject: string, body: string): Promise<BillData>;
  formatQueryResult(data: unknown, queryType: QueryType): Promise<string>;
}

class NLPService implements INLPService {
  constructor(private openaiAdapter: IOpenAIAdapter) {}

  async parseUserCommand(userId: string, message: string): Promise<Command> {
    // Implementation
  }

  async parseBillContent(subject: string, body: string): Promise<BillData> {
    // Implementation
  }

  async formatQueryResult(data: unknown, queryType: QueryType): Promise<string> {
    // Implementation
  }
}
```

## 5. 应用层服务

### 5.1 用户交互服务(UserInteractionService)

```typescript
interface IUserInteractionService {
  handleUserMessage(userId: string, message: string): Promise<string>;
}

class UserInteractionService implements IUserInteractionService {
  constructor(
    private nlpService: INLPService,
    private accountingService: IAccountingService,
    private queryService: IQueryService
  ) {}

  async handleUserMessage(userId: string, message: string): Promise<string> {
    // Implementation
  }
}
```

### 5.2 自动化服务(AutomationService)

```typescript
interface IAutomationService {
  scheduledCheck(): Promise<void>;
}

class AutomationService implements IAutomationService {
  constructor(
    private gmailAdapter: IGmailAdapter,
    private billProcessingService: IBillProcessingService
  ) {}

  async scheduledCheck(): Promise<void> {
    // Implementation
  }
}
```

## 6. 适配器

### 6.1 Beancount适配器

#### 6.1.1 Beancount文件存储库

```typescript
interface IBeancountFileRepository {
  saveTransaction(transaction: Transaction): Promise<void>;
  getAllTransactions(): Promise<Transaction[]>;
}

class BeancountFileRepository implements IBeancountFileRepository {
  constructor(private filePath: string) {}

  async saveTransaction(transaction: Transaction): Promise<void> {
    // Implementation
  }

  async getAllTransactions(): Promise<Transaction[]> {
    // Implementation
  }
}
```

#### 6.1.2 Beancount查询适配器

```typescript
interface IBeancountQueryAdapter {
  executeQuery(query: string): Promise<string>;
}

class BeancountQueryAdapter implements IBeancountQueryAdapter {
  constructor(private filePath: string) {}

  async executeQuery(query: string): Promise<string> {
    // Implementation
  }
}
```

### 6.2 OpenAI适配器

```typescript
interface IOpenAIAdapter {
  processMessage(systemPrompt: string, userMessage: string): Promise<string>;
}

class OpenAIAdapter implements IOpenAIAdapter {
  constructor(private apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  async processMessage(systemPrompt: string, userMessage: string): Promise<string> {
    // Implementation
  }
}
```

### 6.3 Telegram适配器

```typescript
interface ITelegramAdapter {
  init(): void;
  sendMessage(userId: string, text: string): Promise<void>;
}

class TelegramAdapter implements ITelegramAdapter {
  constructor(
    private token: string,
    private userInteractionService: IUserInteractionService
  ) {
    this.bot = new Telegraf(token);
  }

  init(): void {
    // Implementation
  }

  async sendMessage(userId: string, text: string): Promise<void> {
    // Implementation
  }
}
```

### 6.4 Gmail适配器

```typescript
interface IGmailAdapter {
  init(): Promise<void>;
  fetchUnreadEmails(query: string): Promise<Email[]>;
}

class GmailAdapter implements IGmailAdapter {
  constructor(
    private credentials: GmailCredentials,
    private tokens: GmailTokens
  ) {}

  async init(): Promise<void> {
    // Implementation
  }

  async fetchUnreadEmails(query: string): Promise<Email[]> {
    // Implementation
  }
}
```

## 7. 用例实现

### 7.1 添加交易

```
1. 用户通过Telegram发送消息："今天在超市花了50元买食品"
2. TelegramAdapter接收消息并转发到UserInteractionService
3. UserInteractionService调用NLPService解析消息
4. NLPService通过OpenAIAdapter解析出交易信息:
   {
     date: "2025-04-18",
     description: "超市购物",
     accounts: ["Expenses:Food", "Assets:Cash"],
     amounts: [{amount: 50, currency: "CNY"}, {amount: -50, currency: "CNY"}]
   }
5. UserInteractionService创建Transaction对象
6. UserInteractionService调用AccountingService.addTransaction()
7. AccountingService通过BeancountFileRepository保存交易
8. UserInteractionService返回确认信息
9. TelegramAdapter发送确认消息给用户
```

### 7.2 查询账户余额

```
1. 用户通过Telegram发送消息："我的现金还有多少？"
2. TelegramAdapter接收消息并转发到UserInteractionService
3. UserInteractionService调用NLPService解析消息
4. NLPService通过OpenAIAdapter识别意图为查询余额，账户为"Assets:Cash"
5. UserInteractionService调用QueryService.getBalance("Assets:Cash")
6. QueryService通过BeancountQueryAdapter执行查询
7. UserInteractionService调用NLPService格式化结果
8. TelegramAdapter发送格式化结果给用户
```

### 7.3 自动处理账单

```
1. AutomationService定期调用scheduledCheck()
2. AutomationService通过GmailAdapter获取未读账单邮件
3. 对于每封邮件:
   a. AutomationService创建Bill对象
   b. AutomationService调用BillProcessingService.processBill(bill)
   c. BillProcessingService调用NLPService解析账单内容
   d. BillProcessingService创建Transaction对象
   e. BillProcessingService调用AccountingService.addTransaction()
   f. GmailAdapter标记邮件为已读
```

## 8. 技术实现细节

### 8.1 项目结构

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

### 8.2 依赖包

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

### 8.3 环境变量

```typescript
// .env
OPENAI_API_KEY=your_openai_api_key
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
BEANCOUNT_FILE_PATH=/path/to/your/ledger.beancount
GMAIL_CREDENTIALS_PATH=/path/to/credentials.json
GMAIL_TOKENS_PATH=/path/to/token.json
```

### 8.4 启动流程

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

## 9. 部署和运维

### 9.1 部署方式

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

## 10. 扩展和未来计划

### 10.1 潜在扩展

1. **Web界面**：添加一个简单的Web界面来可视化财务数据
2. **多用户支持**：扩展系统支持多个用户，每个用户有独立的Beancount文件
3. **报表生成**：支持生成PDF或电子表格格式的财务报表
4. **投资跟踪**：增加股票、基金等投资资产的自动价格更新
5. **预算管理**：添加预算设置和跟踪功能

### 10.2 技术改进

1. **测试覆盖**：增加单元测试和集成测试
2. **性能优化**：针对大型Beancount文件的查询性能优化
3. **API扩展**：提供REST API以支持更多客户端
4. **本地化支持**：增加多语言支持

## 11. 总结

本设计文档提供了一个基于领域驱动设计原则的个人财务记账系统架构。系统将Beancount作为核心记账引擎，通过Telegram机器人提供自然语言交互界面，并利用OpenAI API实现智能对话和指令解析。系统还能够自动从Gmail获取账单信息并进行记账，大大减轻了用户的记账负担。

通过清晰的领域模型划分和六边形架构设计，系统保持了良好的可维护性和可扩展性，为未来的功能增强奠定了坚实基础。
