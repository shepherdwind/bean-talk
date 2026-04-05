import { BeancountQueryService } from '../beancount-query.service';
import * as child_process from 'child_process';
import * as util from 'util';

// Mock child_process.exec for executeQuery tests
jest.mock('child_process');
jest.mock('util', () => {
  const original = jest.requireActual('util');
  return {
    ...original,
    promisify: jest.fn((fn: unknown) => fn),
  };
});

class TestBeancountQueryService extends BeancountQueryService {
  public processQueryResult(rawResult: string) {
    return super.processQueryResult(rawResult);
  }
}

describe('BeancountQueryService', () => {
  let service: TestBeancountQueryService;

  beforeEach(() => {
    service = new TestBeancountQueryService();
  });

  describe('processQueryResult', () => {
    it('should correctly process query results and merge expense categories', () => {
      const rawResult = `
           account                  ps    
-----------------------------  -----------
Assets:DBS:SGD:Wife            -102.32 SGD
Assets:Cash:Wife                -15.50 SGD
Assets:DBS:SGD:Saving            -3.86 SGD
Expenses:Food:Online              0.19 SGD
Expenses:Shopping:Supermarket     1.52 SGD
Expenses:Food                     7.50 SGD
Expenses:Transport:Bus           11.27 SGD
Expenses:Food:Dining             14.00 SGD
Expenses:Education:Kids          87.20 SGD
      `;

      const result = service.processQueryResult(rawResult);

      expect(result.assets).toHaveLength(3);
      expect(result.expenses).toHaveLength(4);

      // Check assets
      expect(result.assets).toContainEqual({
        account: 'Assets:DBS:SGD:Wife',
        amount: -102.32
      });
      expect(result.assets).toContainEqual({
        account: 'Assets:Cash:Wife',
        amount: -15.50
      });
      expect(result.assets).toContainEqual({
        account: 'Assets:DBS:SGD:Saving',
        amount: -3.86
      });

      // Check expenses (merged categories)
      expect(result.expenses).toContainEqual({
        category: 'Expenses:Food',
        amount: 21.69 // 0.19 + 7.50 + 14.00
      });
      expect(result.expenses).toContainEqual({
        category: 'Expenses:Shopping',
        amount: 1.52
      });
      expect(result.expenses).toContainEqual({
        category: 'Expenses:Transport',
        amount: 11.27
      });
      expect(result.expenses).toContainEqual({
        category: 'Expenses:Education',
        amount: 87.20
      });
    });

    it('should handle empty results', () => {
      const rawResult = `
           account                  ps    
-----------------------------  -----------
      `;

      const result = service.processQueryResult(rawResult);

      expect(result.assets).toHaveLength(0);
      expect(result.expenses).toHaveLength(0);
    });

    it('should handle malformed lines', () => {
      const rawResult = `
           account                  ps    
-----------------------------  -----------
Invalid Line
Assets:DBS:SGD:Wife            -102.32 SGD
      `;

      const result = service.processQueryResult(rawResult);

      expect(result.assets).toHaveLength(1);
      expect(result.expenses).toHaveLength(0);
      expect(result.assets[0]).toEqual({
        account: 'Assets:DBS:SGD:Wife',
        amount: -102.32
      });
    });
  });

  describe('queryByDateRange', () => {
    it('should execute query and process result', async () => {
      const mockExec = child_process.exec as unknown as jest.Mock;
      mockExec.mockResolvedValue({
        stdout: `
           account                  ps
-----------------------------  -----------
Assets:DBS:SGD:Saving            -50.00 SGD
Expenses:Food                     50.00 SGD
`,
      });

      const startDate = new Date('2024-03-01');
      const endDate = new Date('2024-03-31');
      const result = await service.queryByDateRange(startDate, endDate);

      expect(result.assets).toHaveLength(1);
      expect(result.expenses).toHaveLength(1);
      expect(result.assets[0].amount).toBe(-50);
    });

    it('should throw when command execution fails', async () => {
      const mockExec = child_process.exec as unknown as jest.Mock;
      mockExec.mockRejectedValue(new Error('command not found'));

      const startDate = new Date('2024-03-01');
      const endDate = new Date('2024-03-31');

      await expect(service.queryByDateRange(startDate, endDate)).rejects.toThrow(
        'Failed to execute Beancount query'
      );
    });
  });
});