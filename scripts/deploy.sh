#!/bin/bash
# 记账系统 - 一键部署脚本
# 在服务器上运行此脚本即可部署

set -e

echo "========================================="
echo "  记账系统 - 部署"
echo "========================================="

# 1. 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "正在安装 Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi

# 2. 检查 .env 文件
if [ ! -f .env ]; then
    echo "创建 .env 配置文件..."
    cp .env.production .env
    # 生成随机密码和密钥
    DB_PASS=$(openssl rand -hex 16)
    JWT_SEC=$(openssl rand -hex 32)
    sed -i "s/your_strong_password_here/$DB_PASS/g" .env
    sed -i "s/your_random_jwt_secret_here/$JWT_SEC/g" .env
    echo "已生成随机密码，请查看 .env 文件"
fi

# 3. 切换 Prisma 到 PostgreSQL
echo "配置 PostgreSQL..."
sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma

# 4. 构建并启动
echo "构建并启动服务..."
docker compose up -d --build

# 5. 等待数据库就绪
echo "等待数据库启动..."
sleep 10

# 6. 运行数据库迁移
echo "运行数据库迁移..."
docker compose exec app npx prisma migrate deploy

# 7. 设置自动备份
echo "配置每日自动备份..."
chmod +x scripts/backup.sh
BACKUP_PATH="$(pwd)/scripts/backup.sh"
(crontab -l 2>/dev/null; echo "0 3 * * * $BACKUP_PATH >> /var/log/jizhang-backup.log 2>&1") | sort -u | crontab -

echo ""
echo "========================================="
echo "  部署完成！"
echo "========================================="
echo ""
echo "  访问地址: http://服务器IP"
echo "  下一步:"
echo "    1. 配置域名指向服务器IP"
echo "    2. 配置 HTTPS (推荐 certbot)"
echo "    3. 打开浏览器注册第一个店铺账号"
echo ""
