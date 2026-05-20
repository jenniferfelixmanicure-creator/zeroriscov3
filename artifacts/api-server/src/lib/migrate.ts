import { pool } from "@workspace/db";
  import type { Logger } from "pino";

  export async function runMigrations(logger: Logger): Promise<void> {
    const client = await pool.connect();
    try {
      logger.info("Iniciando migrations...");
      await client.query("BEGIN");

      // Tabela de categorias (sem dependências externas)
      await client.query(`
        CREATE TABLE IF NOT EXISTS categories (
          id          SERIAL PRIMARY KEY,
          name        TEXT NOT NULL,
          description TEXT NOT NULL,
          icon        TEXT NOT NULL DEFAULT 'car',
          base_fare   NUMERIC(10,2) NOT NULL DEFAULT 3.00,
          price_per_km     NUMERIC(10,2) NOT NULL DEFAULT 1.50,
          price_per_minute NUMERIC(10,2) NOT NULL DEFAULT 0.30,
          min_fare    NUMERIC(10,2) NOT NULL DEFAULT 6.00,
          multiplier  NUMERIC(4,2)  NOT NULL DEFAULT 1.00
        )
      `);

      // Tabela de usuários
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id             SERIAL PRIMARY KEY,
          name           TEXT NOT NULL,
          cpf            TEXT UNIQUE,
          email          TEXT,
          phone          TEXT,
          password_hash  TEXT,
          google_id      TEXT,
          apple_id       TEXT,
          refresh_token  TEXT,
          role           TEXT NOT NULL DEFAULT 'passenger',
          avatar_url     TEXT,
          fcm_token      TEXT,
          is_active      BOOLEAN NOT NULL DEFAULT TRUE,
          wallet_balance NUMERIC(10,2) NOT NULL DEFAULT 0.00,
          created_at     TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);

      // Perfis de motorista
      await client.query(`
        CREATE TABLE IF NOT EXISTS driver_profiles (
          id                    SERIAL PRIMARY KEY,
          user_id               INTEGER REFERENCES users(id),
          category_id           INTEGER REFERENCES categories(id),
          vehicle_model         TEXT NOT NULL DEFAULT '',
          vehicle_plate         TEXT NOT NULL DEFAULT '',
          is_online             BOOLEAN NOT NULL DEFAULT FALSE,
          rating                NUMERIC(3,2) NOT NULL DEFAULT 5.00,
          total_rides           INTEGER NOT NULL DEFAULT 0,
          total_trips_accepted  INTEGER NOT NULL DEFAULT 0,
          total_trips_cancelled INTEGER NOT NULL DEFAULT 0,
          acceptance_rate       NUMERIC(5,2) NOT NULL DEFAULT 100.00,
          cancellation_rate     NUMERIC(5,2) NOT NULL DEFAULT 0.00,
          last_known_lat        NUMERIC(10,7),
          last_known_lng        NUMERIC(10,7),
          last_location_at      TIMESTAMP,
          subscription_status   TEXT NOT NULL DEFAULT 'inactive',
          subscription_expires_at TIMESTAMP,
          approval_status       TEXT NOT NULL DEFAULT 'pending',
          cnh_url               TEXT,
          crlv_url              TEXT,
          rejection_reason      TEXT,
          created_at            TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);

      // Notificações
      await client.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id         SERIAL PRIMARY KEY,
          user_id    INTEGER REFERENCES users(id),
          title      TEXT NOT NULL,
          body       TEXT NOT NULL,
          type       TEXT NOT NULL DEFAULT 'general',
          is_read    BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);

      // Corridas
      await client.query(`
        CREATE TABLE IF NOT EXISTS rides (
          id                   SERIAL PRIMARY KEY,
          passenger_id         INTEGER NOT NULL REFERENCES users(id),
          driver_id            INTEGER REFERENCES users(id),
          category_id          INTEGER NOT NULL REFERENCES categories(id),
          status               TEXT NOT NULL DEFAULT 'searching',
          origin_address       TEXT NOT NULL,
          origin_lat           NUMERIC(10,7) NOT NULL,
          origin_lng           NUMERIC(10,7) NOT NULL,
          destination_address  TEXT NOT NULL,
          destination_lat      NUMERIC(10,7) NOT NULL,
          destination_lng      NUMERIC(10,7) NOT NULL,
          estimated_distance   NUMERIC(8,2) NOT NULL,
          estimated_duration   INTEGER NOT NULL,
          estimated_fare       NUMERIC(10,2) NOT NULL,
          final_fare           NUMERIC(10,2),
          surge_price_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.00,
          polyline             TEXT,
          verification_pin     TEXT,
          trip_share_token     TEXT,
          scheduled_for        TIMESTAMP,
          started_at           TIMESTAMP,
          completed_at         TIMESTAMP,
          cancellation_reason  TEXT,
          created_at           TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);

      // Avaliações
      await client.query(`
        CREATE TABLE IF NOT EXISTS ratings (
          id           SERIAL PRIMARY KEY,
          ride_id      INTEGER NOT NULL REFERENCES rides(id),
          from_user_id INTEGER NOT NULL REFERENCES users(id),
          to_user_id   INTEGER NOT NULL REFERENCES users(id),
          rating       INTEGER NOT NULL,
          comment      TEXT,
          created_at   TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);

      // Transações de carteira
      await client.query(`
        CREATE TABLE IF NOT EXISTS wallet_transactions (
          id          SERIAL PRIMARY KEY,
          user_id     INTEGER NOT NULL REFERENCES users(id),
          ride_id     INTEGER,
          type        TEXT NOT NULL,
          amount      NUMERIC(10,2) NOT NULL,
          description TEXT NOT NULL,
          created_at  TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);

      // Mensagens em corrida
      await client.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id         SERIAL PRIMARY KEY,
          ride_id    INTEGER NOT NULL REFERENCES rides(id),
          sender_id  INTEGER NOT NULL REFERENCES users(id),
          content    TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);

      // Eventos de SOS/pânico
      await client.query(`
        CREATE TABLE IF NOT EXISTS sos_events (
          id          SERIAL PRIMARY KEY,
          user_id     INTEGER NOT NULL REFERENCES users(id),
          ride_id     INTEGER,
          lat         NUMERIC(10,7),
          lng         NUMERIC(10,7),
          message     TEXT,
          status      TEXT NOT NULL DEFAULT 'open',
          resolved_at TIMESTAMP,
          resolved_by INTEGER,
          created_at  TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);

      // Endereços salvos
      await client.query(`
        CREATE TABLE IF NOT EXISTS saved_addresses (
          id         SERIAL PRIMARY KEY,
          user_id    INTEGER NOT NULL REFERENCES users(id),
          label      TEXT NOT NULL,
          address    TEXT NOT NULL,
          lat        NUMERIC(10,7) NOT NULL,
          lng        NUMERIC(10,7) NOT NULL,
          is_default BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);

      // Pagamentos de assinatura
      await client.query(`
        CREATE TABLE IF NOT EXISTS subscription_payments (
          id                 SERIAL PRIMARY KEY,
          user_id            INTEGER NOT NULL REFERENCES users(id),
          amount             NUMERIC(10,2) NOT NULL DEFAULT 80.00,
          pix_key            TEXT NOT NULL,
          proof_description  TEXT,
          status             TEXT NOT NULL DEFAULT 'pending',
          confirmed_by       INTEGER,
          confirmed_at       TIMESTAMP,
          created_at         TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);

      // Adiciona colunas novas em tabelas existentes sem quebrar (IF NOT EXISTS)
      const alterColumns = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT",
        "ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS total_trips_accepted INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS total_trips_cancelled INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS acceptance_rate NUMERIC(5,2) NOT NULL DEFAULT 100.00",
        "ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS cancellation_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00",
        "ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS last_known_lat NUMERIC(10,7)",
        "ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS last_known_lng NUMERIC(10,7)",
        "ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS last_location_at TIMESTAMP",
        "ALTER TABLE rides ADD COLUMN IF NOT EXISTS surge_price_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.00",
        "ALTER TABLE rides ADD COLUMN IF NOT EXISTS polyline TEXT",
        "ALTER TABLE rides ADD COLUMN IF NOT EXISTS trip_share_token TEXT",
        "ALTER TABLE rides ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP",
      ];
      for (const sql of alterColumns) {
        try { await client.query(sql); } catch { /* coluna já existe */ }
      }

      await client.query("COMMIT");
      logger.info("✅ Migrations concluídas com sucesso");
    } catch (err) {
      await client.query("ROLLBACK");
      logger.error({ err }, "❌ Erro nas migrations");
      throw err;
    } finally {
      client.release();
    }
  }
  