# 仓库编码规则

本文件承载仓库级编码规范。

请配合以下文件一起使用：
- `AGENTS.md`：工作流、review 流程、执行约束
- `.claude/skills/*`：流程入口和操作编排

## 语言

- 代码、标识符、注释、commit message、PR body 一律使用英文
- Agent 说明、流程文档、仓库规范可以使用中文

## TypeScript

- 在可行的前提下，所有代码都应有明确且完整的 TypeScript 类型
- 禁止使用 `any`；必要时使用 `unknown` 并做显式收窄
- 类型单独成文件：接口和类型定义放在对应目录的 `types.ts` 或 `*.types.ts` 中，不与主要逻辑混写
- 仅非常局部、单次使用的类型可以保留在当前文件；拿不准时，放到该目录的类型文件

## 导入

- import 路径不要带 `.js` 或 `.ts` 扩展名
- 项目使用 `moduleResolution: Bundler`，按无扩展名导入

## 函数

- 单个函数尽量不超过 3 个参数；超过时改为 options 对象
- 单个函数尽量控制在 100 行以内
- 单个文件尽量控制在 400 行以内
- 优先使用 guard clause 和提前返回，避免深层嵌套
- 优先提取纯逻辑函数，把副作用放在边界层和编排层

## 状态管理

- 常量和状态值使用 `enum`，不要散落裸字符串
- 有状态流转的模块必须显式建模为状态机
- 用一个中心化对象定义状态迁移，不要把迁移逻辑散落在多个条件分支中

## MobX Store

- 使用 legacy decorator 模式：`@observable`、`@action`、`@computed`，并在构造函数中调用 `makeObservable(this)`
- 所有状态修改必须通过 `@action` 方法完成
- 异步方法不得直接修改状态，应调用 `@action` setter 更新
- 不使用 `makeAutoObservable` 或 `runInAction`

## React 前端

- UI 状态放在 domain store，不放在组件局部 `useState`
- 由 store 持有的数据和动作，不要通过 props 层层透传
- 页面级 `useEffect` 放在 `useXxxPage.ts` 中，页面组件顶部调用后只负责渲染
- 非简单组件要把逻辑提到同文件内的 `useXxx()` 函数，组件主体只保留 JSX
- 读取 MobX store 的组件必须用 `observer()` 包裹，hook 不要包 `observer()`

## 类

- 当逻辑持有内部状态且包含多组相关操作时，优先使用 `class`
- 每个 class 只负责一件事
- 依赖优先通过构造函数注入，便于测试替换

## 依赖

- 新增 npm 依赖必须先得到用户明确批准
- 先说明为什么需要该依赖，以及是否能用 Node.js 内置模块或现有依赖替代
- 可行时优先使用 Node.js 内置模块

## 一致性

- 引入新工具、抽象或工具函数前，先检查仓库里是否已有可复用实现
- 优先沿用现有模式，不引入平行替代方案

## 数据库类型

- SQLite 查询结果使用专门的 row interface，不要靠内联类型断言
- DB row 类型放在对应目录的类型文件中，不与查询逻辑混写
- 提供可复用的 row -> domain model 映射函数

## 错误处理

- 在系统边界处理错误，例如 API 调用、WebSocket、配置加载
- 受信任的内部模块之间不要做重复防御性校验
- 日志统一使用项目现有方案；如果项目已有结构化日志则沿用，否则统一使用内置 logger
- 存在 Telegram 告警链路时，关键异常要上报

## Commit 与 PR

- 使用 conventional commits
- 一个 commit 只做一件事
- 每个 task 创建 PR 后，把 PR 链接写回对应 task 文件和 `docs/tasks/plan.md`
