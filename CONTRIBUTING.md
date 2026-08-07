# 贡献规范

## 分支

使用 `feature/`、`fix/`、`chore/`、`docs/`、`release/`。禁止直接向 `main` 推送。

## 提交

采用 Conventional Commits：`feat:`、`fix:`、`docs:`、`chore:`、`test:`、`ci:`、`build:`、`refactor:`。

## Pull Request

PR 必须说明范围、业务行为、测试证据、安全影响、部署影响和回滚方式。至少一名 CODEOWNER Review 且 required checks 通过后才能合并。默认使用 squash merge，并在合并后删除短期分支。

## Release

使用 `vMAJOR.MINOR.PATCH` Tag，更新 CHANGELOG，并记录前后端完整 Commit SHA。Release 创建与线上部署是不同动作。
