from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import os

# 获取数据库路径
DB_PATH = os.getenv('SQLITE_DB_PATH', 'houses.db')

app = Flask(__name__)
CORS(app)

# 数据库初始化
def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS houses
        (id TEXT PRIMARY KEY,
         status TEXT DEFAULT '未标记',
         favorite INTEGER DEFAULT 0,
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
    ''')
    conn.commit()
    conn.close()

# 获取房源状态
@app.route('/api/house/<house_id>', methods=['GET'])
def get_house_status(house_id):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('SELECT status, favorite FROM houses WHERE id = ?', (house_id,))
    result = c.fetchone()
    conn.close()
    
    if result:
        return jsonify({'status': result[0], 'favorite': result[1]})
    else:
        # 如果房源不存在，创建一个新记录
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        # Initialize with favorite = 0
        c.execute('INSERT INTO houses (id, status, favorite) VALUES (?, ?, ?)', (house_id, '未标记', 0))
        conn.commit()
        conn.close()
        return jsonify({'status': '未标记', 'favorite': 0})

# 批量获取房源状态
@app.route('/api/houses/batch', methods=['POST'])
def batch_get_house_status():
    data = request.get_json()
    house_ids = data.get('ids', [])
    
    if not house_ids:
        return jsonify({'error': 'House IDs are required'}), 400
    
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    result = {}
    for house_id in house_ids:
        c.execute('SELECT status, favorite FROM houses WHERE id = ?', (house_id,))
        row = c.fetchone()
        if not row:
            # Initialize with favorite = 0
            c.execute('INSERT INTO houses (id, status, favorite) VALUES (?, ?, ?)', (house_id, '未标记', 0))
            result[house_id] = {'status': '未标记', 'favorite': 0}
        else:
            result[house_id] = {'status': row[0], 'favorite': row[1]}
    
    conn.commit()
    conn.close()
    
    return jsonify(result)

# 更新房源状态
@app.route('/api/house/<house_id>', methods=['POST'])
def update_house_status(house_id):
    data = request.get_json()
    new_status = data.get('status')
    
    if not new_status:
        return jsonify({'error': 'Status is required'}), 400
        
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('INSERT OR REPLACE INTO houses (id, status) VALUES (?, ?)',
              (house_id, new_status))
    conn.commit()
    conn.close()
    
    return jsonify({'status': 'success'})

# 更新房源收藏状态
@app.route('/api/house/<house_id>/favorite', methods=['POST'])
def update_house_favorite(house_id):
    data = request.get_json()
    new_favorite_status = data.get('favorite')

    if new_favorite_status is None or not isinstance(new_favorite_status, int):
        return jsonify({'error': 'Favorite status (integer 0 or 1) is required'}), 400

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    # Check if record exists, if not, create it with default status
    c.execute('SELECT id FROM houses WHERE id = ?', (house_id,))
    if not c.fetchone():
        c.execute('INSERT INTO houses (id, status, favorite) VALUES (?, ?, ?)', (house_id, '未标记', new_favorite_status))
    else:
        c.execute('UPDATE houses SET favorite = ? WHERE id = ?', (new_favorite_status, house_id))
    conn.commit()
    conn.close()

    return jsonify({'status': 'success', 'favorite': new_favorite_status})

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000)
