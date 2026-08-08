# Changelog

格式遵循 Keep a Changelog，版本采用 Semantic Versioning。

## Unreleased

### Added

- 项目文档、协作规则、CI、安全检查和双仓版本追踪治理基线。

## Release 规则

- Tag：`vMAJOR.MINOR.PATCH`。
- Release 说明必须记录前端 SHA、后端 SHA、manifest 校验值和回滚入口。
- 未完成线上 manifest 与 `/health` 读回时，不标记为已部署。
