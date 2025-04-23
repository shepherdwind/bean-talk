import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "../utils";
import path from "path";

const execAsync = promisify(exec);

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

  async queryByDateRange(startDate: Date, endDate: Date): Promise<string> {
    const query = `SELECT account, sum(position) as ps WHERE date > ${this.formatDate(
      startDate
    )} AND date < ${this.formatDate(
      endDate
    )} GROUP BY account ORDER BY ps;`;
    logger.debug(`Executing Beancount query: ${query}`);
    return this.executeQuery(query);
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

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}
