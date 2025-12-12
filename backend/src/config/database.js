import mysql from 'mysql2/promise';
import config from './env.js';

let pool = null;

export async function getConnection() {
  if (!pool) {
    const poolConfig = {
      host: config.db.host,
      port: config.db.port,
      database: config.db.database,
      user: config.db.user,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    };

    // Only include password if it's set
    if (config.db.password) {
      poolConfig.password = config.db.password;
    }

    pool = mysql.createPool(poolConfig);
  }
  return pool;
}

export async function query(sql, params = []) {
  const connection = await getConnection();
  const [rows] = await connection.execute(sql, params);
  return rows;
}

export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

export async function insert(sql, params = []) {
  const connection = await getConnection();
  const [result] = await connection.execute(sql, params);
  return result.insertId;
}

export async function update(sql, params = []) {
  const connection = await getConnection();
  const [result] = await connection.execute(sql, params);
  return result.affectedRows;
}

export async function testConnection() {
  try {
    const connection = await getConnection();
    await connection.execute('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database connection failed:', error.message);
    return false;
  }
}
