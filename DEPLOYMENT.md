# 部署

本次治理不执行部署。本文定义可重复发布契约。

## 构建

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm ci
```

发布工具必须显式注入 `RELEASE_ID`、`FRONTEND_COMMIT_SHA`、`BACKEND_COMMIT_SHA` 和 `BUILD_TIME`，生成 `release-manifest.json`，再把 `dist/` 与 manifest 放入不可变 release 目录。

```bash
release_dir="${APP_ROOT}/releases/${RELEASE_ID}"
ln -sfn "$release_dir" "${APP_ROOT}/current.next"
mv -Tf "${APP_ROOT}/current.next" "${APP_ROOT}/current"
```

Nginx 只服务 `${APP_ROOT}/current/dist`，并将 `/auth`、`/v1`、`/public-assets` 代理至后端。真实域名、主机、账号和密钥不得进入仓库。

## 版本切换

切换前验证 manifest、静态文件校验值和配套后端 SHA。切换后验证首页、静态资源、登录和后端 `/health`。GitHub Tag/Release 必须记录相同的双仓 SHA；没有线上读回时不能声称 Release 已上线。
