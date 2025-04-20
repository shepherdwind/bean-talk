// 分类相关的类型定义

// 分类数据
export interface CategorizationData {
  merchantId: string;
  categories: {
    primary: string;
    alternative: string;
    suggested: string;
  };
}

// 分类映射
export type CategorizationMap = Map<string, CategorizationData>;

// 分类选择事件数据
export interface CategorySelectionEventData {
  merchantId: string;
  merchant: string;
  selectedCategory: string;
  timestamp: string;
} 