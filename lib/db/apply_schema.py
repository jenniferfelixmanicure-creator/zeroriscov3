import psycopg2
import os

db_url = "postgresql://zerorisco_user:i9Sl6KqgwNWheRrAEiIErXwG0ibElJZo@dpg-d86k1rbtqb8s73fl40k0-a.oregon-postgres.render.com:5432/zerorisco_0l8f?sslmode=require"

commands = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT;",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_id TEXT;",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token TEXT;",
    "ALTER TABLE users ALTER COLUMN cpf DROP NOT EXISTS;",
    "ALTER TABLE users ALTER COLUMN password_hash DROP NOT EXISTS;",
    "ALTER TABLE users ALTER COLUMN phone DROP NOT EXISTS;",
    "ALTER TABLE rides ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;",
    "ALTER TABLE rides ADD COLUMN IF NOT EXISTS verification_pin TEXT;"
]

try:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    for cmd in commands:
        print(f"Executando: {cmd}")
        cur.execute(cmd)
    conn.commit()
    cur.close()
    conn.close()
    print("Schema atualizado com sucesso!")
except Exception as e:
    print(f"Erro ao atualizar schema: {e}")
    "ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES categories(id);"
