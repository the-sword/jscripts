FROM docker.leacode.eu.org/python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# 创建数据卷目录
RUN mkdir -p /data/db

# 设置环境变量
ENV SQLITE_DB_PATH=/data/db/houses.db

EXPOSE 5000

CMD ["python", "app.py"]
