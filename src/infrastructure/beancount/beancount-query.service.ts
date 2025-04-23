import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "../utils";
import { formatDateToYYYYMMDD } from "../utils/date.utils";
import path from "path";

const execAsync = promisify(exec);

interface ProcessedQueryResult {
  assets: {
    account: string;
    amount: number;
  }[];
  expenses: {
    category: string;
    amount: number;
  }[];
}

export class BeancountQueryService {
  private readonly beanFile: string;
  private readonly beanQueryCommand: string;

  constructor(beanFile: string) {
    this.beanFile = path.join(process.env.BEANCOUNT_FILE_PATH || "", beanFile);
    this.beanQueryCommand = process.env.BEAN_QUERY_COMMAND || "bean-query";
    logger.info(
      `Initialized BeancountQueryService with bean file: ${this.beanFile} and command: ${this.beanQueryCommand}`
    );
  }

  protected processQueryResult(rawResult: string): ProcessedQueryResult {
    const lines = rawResult.split("\n");
    const result: ProcessedQueryResult = {
      assets: [],
      expenses: [],
    };

    // Skip header lines and empty lines
    const dataLines = lines.filter(
      (line) =>
        line.trim() && !line.includes("account") && !line.includes("---")
    );

    for (const line of dataLines) {
      const [account, amountStr] = line.trim().split(/\s+/);
      const amount = parseFloat(amountStr);

      if (account.startsWith("Assets:")) {
        result.assets.push({
          account,
          amount,
        });
      } else if (account.startsWith("Expenses:")) {
        // Merge to two levels
        const parts = account.split(":");
        const category = parts.length > 2 ? `${parts[0]}:${parts[1]}` : account;

        const existingExpense = result.expenses.find(
          (e) => e.category === category
        );
        if (existingExpense) {
          existingExpense.amount += amount;
        } else {
          result.expenses.push({
            category,
            amount,
          });
        }
      }
    }

    return result;
  }

  async queryByDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<ProcessedQueryResult> {
    const query = `SELECT account, sum(position) as ps WHERE date > ${formatDateToYYYYMMDD(
      startDate
    )} AND date < ${formatDateToYYYYMMDD(
      endDate
    )} GROUP BY account ORDER BY ps;`;
    logger.debug(`Executing Beancount query: ${query}`);
    const rawResult = await this.executeQuery(query);
    return this.processQueryResult(rawResult);
  }

  private async executeQuery(query: string): Promise<string> {
    try {
      const command = `${this.beanQueryCommand} ${this.beanFile} "${query}"`;
      logger.debug(`Running command: ${command}`);
      const { stdout } = await execAsync(command);
      logger.debug("Query executed successfully");
      return stdout;
    } catch (error) {
      logger.error("Error executing bean-query:", error);
      throw new Error("Failed to execute Beancount query");
    }
  }
}
