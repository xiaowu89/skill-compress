# image-compress — 图片压缩 Skill

直连 NX API 对图片进行智能压缩，返回 CDN 地址和压缩率。

## 快速安装

### skills.sh（推荐）

```bash
npx skills add https://github.com/xiaowu89/skill-compress --skill image-compress
```

### 手动安装

```bash
git clone https://github.com/xiaowu89/skill-compress.git /tmp/sc && \
cp -r /tmp/sc ~/.claude/skills/image-compress/ && \
rm -rf /tmp/sc
```

## 配置

Skill 通过 `.env` 文件读取 `NX_API_KEY`，首次使用时会自动引导配置。

```bash
NX_API_KEY=你的API_Key
```

> **没有 API Key？** 联系微信 `zhijian_2026` 获取。

配置后无需重启，直接使用。

## 使用

```
/image-compress 压缩 E:/images/                    # 批量压缩文件夹
/image-compress 压缩 E:/images/photo.png           # 单张压缩
/image-compress --urls=https://cdn.xxx/1.jpg       # URL 压缩
```

## 压缩流程

| 步骤 | 说明 |
|------|------|
| 检查配置 | 读取 `.env` 中的 `NX_API_KEY`，缺失则引导用户配置 |
| 扫描 | 扫描目标目录，超 30MB 文件自动跳过 |
| 压缩 | 直连 API 分批并发（≤20 张 1 批，>20 张均分多批） |
| 汇总 | 表格展示压缩率、CDN 地址 |

## 依赖

- Node.js ≥ 18
- NX_API_KEY

## 许可证

MIT
