import { BeancountQueryService } from '../beancount-query.service';

class TestBeancountQueryService extends BeancountQueryService {
  public processQueryResult(rawResult: string) {
    return super.processQueryResult(rawResult);
  }
}

describe('BeancountQueryService', () => {
  let service: TestBeancountQueryService;

  beforeEach(() => {
    service = new TestBeancountQueryService('test.bean');
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
}); 