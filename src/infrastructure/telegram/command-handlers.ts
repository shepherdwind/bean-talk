import { Telegraf, Context } from "telegraf";
import { ILogger, container, Logger } from "../utils";
import { TG_ACCOUNTS } from "../utils/telegram";
import { PendingCategorization, TextMessage } from "./types";
import { CategorizationCommandHandler } from "./commands/categorization-command-handler";
import { QueryCommandHandler } from "./commands/query-command-handler";
import { AddCommandHandler } from "./commands/add-command-handler";
import { CustomQueryCommandHandler } from "./commands/custom-query-command-handler";

// 用户状态枚举
export enum UserState {
  IDLE = "IDLE", // 空闲状态
  ADDING_BILL = "ADDING_BILL", // 正在添加账单
  CATEGORIZING = "CATEGORIZING", // 正在分类
}

export class CommandHandlers {
  private logger: ILogger;
  private bot: Telegraf;
  private categorizationHandler: CategorizationCommandHandler;
  private queryHandler: QueryCommandHandler;
  private addHandler: AddCommandHandler;
  private customQueryHandler: CustomQueryCommandHandler;

  // 用户状态管理
  private userStates: Map<string, UserState> = new Map();
  // 交易数据管理
  private transactionData: Map<string, any> = new Map();

  constructor(bot: Telegraf) {
    this.logger = container.getByClass(Logger);
    this.bot = bot;

    // 先创建 CategorizationCommandHandler，因为它需要 CommandHandlers 实例
    this.categorizationHandler = new CategorizationCommandHandler(bot, this);

    this.queryHandler = new QueryCommandHandler(bot as any);
    this.addHandler = new AddCommandHandler(bot, this);
    this.customQueryHandler = new CustomQueryCommandHandler(bot as any);

    this.setupMessageHandler();
    this.setupCommandHandlers();
  }

  private setupMessageHandler(): void {
    this.bot.on("message", async (ctx, next) => {
      // Check if message is from whitelisted user
      const username = ctx.from?.username;
      if (!username || !TG_ACCOUNTS.includes(username)) {
        this.logger.debug(
          `Ignoring message from non-whitelisted user: ${username}`
        );
        return;
      }

      // 如果不是文本消息，直接传递给下一个处理器
      if (!this.isTextMessage(ctx)) {
        return next();
      }

      // 如果是命令消息，直接传递给下一个处理器
      if (this.isCommandMessage(ctx)) {
        return next();
      }

      const chatId = ctx.chat?.id.toString();
      if (!chatId) {
        return next();
      }

      try {
        // 根据用户当前状态决定由哪个处理器处理消息
        const userState = this.getUserState(chatId);

        switch (userState) {
          case UserState.ADDING_BILL:
            // 用户正在添加账单，由 AddCommandHandler 处理
            await this.addHandler.handleMessage(ctx);
            break;

          case UserState.CATEGORIZING:
            // 用户正在分类，由 CategorizationCommandHandler 处理
            await this.categorizationHandler.handleMessage(ctx);
            break;

          case UserState.IDLE:
          default:
            const handledByCustomQuery = await this.customQueryHandler.handle(ctx as any);
            if (handledByCustomQuery) {
              break;
            }

            // 用户处于空闲状态，尝试让 AddCommandHandler 处理
            // 如果 AddCommandHandler 没有处理，则尝试让 CategorizationCommandHandler 处理
            const handledByAdd = await this.addHandler.handleMessage(ctx);
            if (!handledByAdd) {
              await this.categorizationHandler.handleMessage(ctx);
            }
            break;
        }
      } catch (error) {
        this.logger.error("Error in message handler:", error);
        await ctx.reply(
          "Sorry, I encountered an error while processing your message."
        );
      }
    });
  }

  private isTextMessage(ctx: Context): boolean {
    return ctx.message !== undefined && "text" in ctx.message;
  }

  private isCommandMessage(ctx: Context): boolean {
    return (
      ctx.message !== undefined &&
      "text" in ctx.message &&
      ctx.message.text.startsWith("/")
    );
  }

  // 获取用户当前状态
  public getUserState(chatId: string): UserState {
    return this.userStates.get(chatId) || UserState.IDLE;
  }

  // 设置用户状态
  public setUserState(chatId: string, state: UserState): void {
    this.userStates.set(chatId, state);
  }

  // 重置用户状态为空闲
  public resetUserState(chatId: string): void {
    this.userStates.set(chatId, UserState.IDLE);
  }

  // 设置交易数据
  public setTransactionData(chatId: string, data: any): void {
    this.transactionData.set(chatId, data);
  }

  // 获取交易数据
  public getTransactionData(chatId: string): any {
    return this.transactionData.get(chatId);
  }

  // 清除交易数据
  public clearTransactionData(chatId: string): void {
    this.transactionData.delete(chatId);
  }

  private setupCommandHandlers(): void {
    // Set up start command
    this.bot.command("start", async (ctx) => {
      try {
        await this.handleStart(ctx);
      } catch (error) {
        this.logger.error("Error handling start command:", error);
        await ctx.reply(
          "Sorry, I encountered an error while processing your command."
        );
      }
    });

    // Set up add command
    this.bot.command("add", async (ctx) => {
      try {
        const chatId = ctx.chat?.id.toString();
        if (chatId) {
          this.setUserState(chatId, UserState.ADDING_BILL);
        }
        await this.addHandler.handle(ctx);
      } catch (error) {
        this.logger.error("Error handling add command:", error);
        await ctx.reply(
          "Sorry, I encountered an error while processing your command."
        );
      }
    });

    // Set up query command
    this.bot.command("query", async (ctx) => {
      try {
        await this.queryHandler.handle(ctx as any);
      } catch (error) {
        this.logger.error("Error handling query command:", error);
        await ctx.reply(
          "Sorry, I encountered an error while processing your command."
        );
      }
    });

    // Set up cancel command
    this.bot.command("cancel", async (ctx) => {
      try {
        const chatId = ctx.chat?.id.toString();
        if (chatId) {
          this.resetUserState(chatId);
        }
        await ctx.reply("Operation cancelled. You are now in idle state.");
      } catch (error) {
        this.logger.error("Error handling cancel command:", error);
        await ctx.reply(
          "Sorry, I encountered an error while processing your command."
        );
      }
    });
  }

  async handleStart(ctx: Context): Promise<void> {
    await ctx.reply(
      "👋 Welcome to Bean Talk! I'm here to help you manage your finances.\n\nI can help you:\n- Categorize merchants\n- Query your transactions\n- Add new bills\n- And more coming soon!"
    );
  }

  // 发送通知
  async sendNotification(
    chatId: string,
    message: string,
    merchantId?: string,
    categorizationData?: PendingCategorization
  ): Promise<void> {
    if (merchantId && categorizationData) {
      // 如果需要分类，使用 categorizationHandler
      this.setUserState(chatId, UserState.CATEGORIZING);
      await this.categorizationHandler.sendNotification(
        chatId,
        message,
        merchantId,
        categorizationData
      );
    } else {
      // 普通通知直接发送
      await this.bot.telegram.sendMessage(chatId, message, {
        parse_mode: "HTML",
      });
    }
  }
}
