# 个人财务记账系统 - 应用服务和适配器设计

## 1. 应用层服务

### 1.1 用户交互服务(UserInteractionService)

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

### 1.2 自动化服务(AutomationService)

```typescript
interface IAutomationService {
  scheduledCheck(): Promise<void>;
}

class AutomationService implements IAutomationService {
  constructor(
    private gmailAdapter: IGmailAdapter,
    private nlpService: INLPService,
    private accountingService: IAccountingService
  ) {}

  async scheduledCheck(): Promise<void> {
    // Implementation
  }
}
```

## 2. 适配器

### 2.1 Beancount适配器

#### 2.1.1 Beancount文件存储库

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

#### 2.1.2 Beancount查询适配器

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

### 2.2 OpenAI适配器

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

### 2.3 Telegram适配器

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

### 2.4 Gmail适配器

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

## 3. 用例实现

### 3.1 添加交易

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

### 3.2 查询账户余额

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

### 3.3 自动处理账单邮件

```
1. AutomationService定期调用scheduledCheck()
2. AutomationService通过GmailAdapter获取未读账单邮件
3. 对于每封邮件:
   a. AutomationService调用NLPService.parseBillText(邮件内容)
   b. NLPService解析邮件内容并返回Transaction对象
   c. AutomationService调用AccountingService.addTransaction()
   d. GmailAdapter标记邮件为已读
``` 