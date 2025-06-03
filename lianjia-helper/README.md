# 链家助手

这是一个帮助你在链家网站上标记和管理房源的工具。

## 功能

- 自动识别房源ID并建立数据库
- 为每个房源添加标记按钮（推荐/不推荐/一般）
- 数据保存在SQLite数据库中

## 安装步骤

### 后端部署（使用Docker）

1. 确保VPS上已安装Docker和Docker Compose

2. 克隆项目到VPS：
```bash
git clone <your-repo-url>
cd lianjia-helper
```

3. 使用Docker Compose启动服务：
```bash
docker-compose up -d
```

服务器将在5000端口运行。数据库文件会保存在`./data`目录中。

要查看日志：
```bash
docker-compose logs -f
```

要停止服务：
```bash
docker-compose down
```

### 前端安装

1. 安装Tampermonkey浏览器插件
2. 打开Tampermonkey的管理面板
3. 创建新脚本
4. 将`frontend/lianjia-helper.user.js`中的内容复制到编辑器中
5. 将脚本中的`API_BASE_URL`修改为你的VPS IP地址
6. 保存脚本

## 使用方法

1. 访问链家网站的房源列表页面
2. 每个房源标题旁边会出现标记按钮
3. 点击标记按钮可以选择不同的标记状态
4. 标记会自动保存到数据库中

## 注意事项

- 确保VPS的5000端口已开放
- 建议设置防火墙只允许需要的IP访问
- 定期备份SQLite数据库文件
