# image-compress — Image Compression Skill for Claude Code

![GitHub stars](https://img.shields.io/github/stars/xiaowu89/skill-compress)
![License](https://img.shields.io/badge/license-MIT-blue)

AI-powered **image compression** Skill for Claude Code. Sends images to the NX API for smart optimization and returns **CDN URLs** with compression ratios. Free to try.

## Features

- **Batch compress**: folders or single images, URL mode supported (`--urls=`)
- **Concurrent batching**: ≤20 images in one request; >20 split into parallel batches
- **Size guard**: files over 30MB skipped automatically
- **Tabular summary** of compression ratio and CDN address per image

## Installation

### Via skills.sh (recommended)

```bash
npx skills add https://github.com/xiaowu89/skill-compress --skill image-compress
```

### Manual install

```bash
git clone https://github.com/xiaowu89/skill-compress.git /tmp/sc && \
cp -r /tmp/sc ~/.claude/skills/image-compress/ && \
rm -rf /tmp/sc
```

## Configuration

Create a `.env` file with your NX API key:

```bash
NX_API_KEY=your_api_key
```

Need a key? Contact WeChat `zhijian_2026`. No restart required after configuration.

## Usage

In Claude Code:

```
/image-compress compress E:/images/                    # compress a folder
/image-compress compress E:/images/photo.png           # compress a single image
/image-compress --urls=https://cdn.xxx/1.jpg           # compress by URL
```

## Requirements

- Node.js ≥ 18
- NX_API_KEY

## Related Skills

- [image-audit](https://github.com/xiaowu89/skill-function) — image moderation (NSFW / political / violent content)
- [nx-matting](https://github.com/xiaowu89/skill-matting) — local BiRefNet background removal, no Python needed

## License

MIT
