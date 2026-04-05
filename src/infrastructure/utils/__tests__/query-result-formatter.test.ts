import { formatQueryResult } from '../query-result-formatter';
import { ProcessedQueryResult } from '../../beancount/beancount-query.service';

describe('formatQueryResult', () => {
  it('should format assets and expenses sections', () => {
    const result: ProcessedQueryResult = {
      assets: [
        { account: 'Assets:DBS:SGD:Wife', amount: -100 },
        { account: 'Assets:DBS:SGD:Saving', amount: -50 },
      ],
      expenses: [
        { category: 'Expenses:Food', amount: 120 },
        { category: 'Expenses:Transport', amount: 30 },
      ],
    };

    const output = formatQueryResult(result);

    // Check structure
    expect(output).toContain('<b>Assets</b>');
    expect(output).toContain('<b>Expenses by Category</b>');

    // Check user spending
    expect(output).toContain('@LingerZou');
    expect(output).toContain('@ewardsong');
    expect(output).toContain('100.00 SGD');
    expect(output).toContain('50.00 SGD');
    expect(output).toContain('Total');
    expect(output).toContain('150.00 SGD');

    // Check expenses
    expect(output).toContain('Food');
    expect(output).toContain('120.00 SGD');
    expect(output).toContain('Transport');
    expect(output).toContain('30.00 SGD');
  });

  it('should handle empty results', () => {
    const result: ProcessedQueryResult = {
      assets: [],
      expenses: [],
    };

    const output = formatQueryResult(result);
    expect(output).toContain('<b>Assets</b>');
    expect(output).toContain('Total');
    expect(output).toContain('0.00 SGD');
  });

  it('should aggregate spending per user from multiple accounts', () => {
    const result: ProcessedQueryResult = {
      assets: [
        { account: 'Assets:DBS:SGD:Wife', amount: -60 },
        { account: 'Assets:Cash:Wife', amount: -40 },
      ],
      expenses: [],
    };

    const output = formatQueryResult(result);
    // Both accounts map to LingerZou, so should aggregate
    expect(output).toContain('@LingerZou');
    expect(output).toContain('100.00 SGD');
  });

  it('should skip assets without a telegram mapping', () => {
    const result: ProcessedQueryResult = {
      assets: [
        { account: 'Assets:Unknown:Account', amount: -200 },
        { account: 'Assets:DBS:SGD:Saving', amount: -50 },
      ],
      expenses: [],
    };

    const output = formatQueryResult(result);
    // Only ewardsong account should appear, total should be 50
    expect(output).toContain('50.00 SGD');
  });

  it('should extract second-level category from full expense path', () => {
    const result: ProcessedQueryResult = {
      assets: [],
      expenses: [
        { category: 'Expenses:Shopping', amount: 75 },
      ],
    };

    const output = formatQueryResult(result);
    expect(output).toContain('Shopping');
    expect(output).toContain('75.00 SGD');
  });

  it('should use full category if no colon separator', () => {
    const result: ProcessedQueryResult = {
      assets: [],
      expenses: [
        { category: 'Miscellaneous', amount: 10 },
      ],
    };

    const output = formatQueryResult(result);
    expect(output).toContain('Miscellaneous');
  });
});
