#!/bin/bash
# 记账系统 - 数据库自动备份脚本
# 用法: 添加到 crontab: 0 3 * * * /path/to/backup.sh
# 每天凌晨3点自动备份

set -e

# 配置
BACKUP_DIR="/opt/jizhang/backups"
DB_CONTAINER="jizhang-db"
DB_USER="jizhang"
DB_NAME="jizhang"
KEEP_DAYS=30

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 生成备份文件名
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/jizhang_${TIMESTAMP}.sql.gz"

echo "[$(date)] 开始备份数据库..."

# 执行备份（通过 Docker）
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

# 检查备份文件
if [ -s "$BACKUP_FILE" ]; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "[$(date)] 备份成功: $BACKUP_FILE ($SIZE)"
else
    echo "[$(date)] 备份失败: 文件为空"
    rm -f "$BACKUP_FILE"
    exit 1
fi

# 清理旧备份（保留最近30天）
DELETED=$(find "$BACKUP_DIR" -name "jizhang_*.sql.gz" -mtime +$KEEP_DAYS -delete -print | wc -l)
if [ "$DELETED" -gt 0 ]; then
    echo "[$(date)] 已清理 $DELETED 个过期备份"
fi

echo "[$(date)] 备份完成"
