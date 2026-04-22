// Worker para PostgreSQL con Neon Serverless Driver
// Compatible con Cloudflare Workers y entornos serverless

import { neon } from '@neondatabase/serverless';

// Configuración desde variables de entorno (credenciales reales de Neon)
const NEON_DATABASE_URL = 'postgresql://neondb_owner:npg_AFeUblfLt1Z9@ep-spring-waterfall-am602rpp-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require';

// Inicializar cliente Neon serverless
const sql = neon(NEON_DATABASE_URL);

// Cache para conexiones (opcional)
let connectionCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

class DatabaseWorker {
  constructor() {
    this.pool = null;
  }

  // Inicializar conexión
  async init() {
    try {
      // Test de conexión
      const result = await this.query('SELECT NOW() as test');
      console.log('✅ Worker DB conectado:', result[0].test);
      return true;
    } catch (error) {
      console.error('❌ Error conectando a DB:', error);
      return false;
    }
  }

  // Ejecutar query con manejo de errores
  async query(sqlQuery, params = []) {
    try {
      const cacheKey = `${sqlQuery}:${JSON.stringify(params)}`;
      const cached = connectionCache.get(cacheKey);
      
      // Verificar cache (solo para SELECT)
      if (cached && sqlQuery.trim().toUpperCase().startsWith('SELECT')) {
        if (Date.now() - cached.timestamp < CACHE_TTL) {
          return cached.result;
        }
      }

      // Ejecutar query
      const result = await sql(sqlQuery, params);
      
      // Cachear resultado
      connectionCache.set(cacheKey, {
        result,
        timestamp: Date.now()
      });

      // Limpiar cache antiguo
      if (connectionCache.size > 100) {
        const now = Date.now();
        for (const [key, value] of connectionCache.entries()) {
          if (now - value.timestamp > CACHE_TTL) {
            connectionCache.delete(key);
          }
        }
      }

      return result;
    } catch (error) {
      console.error('❌ Error en query:', error);
      throw new Error(`Database error: ${error.message}`);
    }
  }

  // Métodos específicos para tu aplicación
  async registrarIntentoLogin(data) {
    const { rut, tipoIntento, resultado, motivoFallo, idUsuario, ip, userAgent } = data;
    
    const query = `
      INSERT INTO intento_login 
      (id_usuario, rut_ingresado, ip_origen, resultado, motivo_fallo, user_agent, fecha_intento)
      VALUES 
      ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      RETURNING id_intento
    `;
    
    const params = [idUsuario, rut, ip, resultado.toLowerCase(), motivoFallo, userAgent];
    
    try {
      const result = await this.query(query, params);
      console.log(`✅ Intento de login registrado: ${rut} - ${resultado}`);
      return result[0];
    } catch (error) {
      console.error('❌ Error registrando intento:', error);
      throw error;
    }
  }

  async obtenerUsuarioPorRut(rut) {
    const query = `
      SELECT id_usuario, rut, nombre, apellido_paterno, apellido_materno, 
             email, tipo, password_hash
      FROM usuarios 
      WHERE rut = $1 AND activo = true
    `;
    
    try {
      const result = await this.query(query, [rut]);
      return result[0] || null;
    } catch (error) {
      console.error('❌ Error obteniendo usuario:', error);
      throw error;
    }
  }

  async guardarToken(idUsuario, token, expiresAt) {
    const query = `
      INSERT INTO tokens (id_usuario, token, fecha_expiracion, creado_en)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      RETURNING id_token
    `;
    
    try {
      const result = await this.query(query, [idUsuario, token, expiresAt]);
      console.log(`✅ Token guardado para usuario ${idUsuario}`);
      return result[0];
    } catch (error) {
      console.error('❌ Error guardando token:', error);
      throw error;
    }
  }

  async verificarToken(idUsuario, token) {
    const query = `
      SELECT id_token, fecha_expiracion 
      FROM tokens 
      WHERE id_usuario = $1 AND token = $2 
      AND fecha_expiracion > CURRENT_TIMESTAMP
      ORDER BY creado_en DESC 
      LIMIT 1
    `;
    
    try {
      const result = await this.query(query, [idUsuario, token]);
      
      if (result.length > 0) {
        // Eliminar token usado
        await this.query(
          'DELETE FROM tokens WHERE id_token = $1', 
          [result[0].id_token]
        );
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Error verificando token:', error);
      throw error;
    }
  }

  // Métodos de estadísticas
  async obtenerEstadisticasLogin(ultimosDias = 7) {
    const query = `
      SELECT 
        COUNT(*) as total_intentos,
        COUNT(CASE WHEN resultado = 'exito' THEN 1 END) as exitosos,
        COUNT(CASE WHEN resultado = 'fallo' THEN 1 END) as fallidos,
        DATE(fecha_intento) as fecha
      FROM intento_login 
      WHERE fecha_intento >= CURRENT_DATE - INTERVAL '${ultimosDias} days'
      GROUP BY DATE(fecha_intento)
      ORDER BY fecha DESC
    `;
    
    try {
      return await this.query(query);
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error);
      throw error;
    }
  }

  // Health check
  async healthCheck() {
    try {
      const result = await this.query('SELECT 1 as health');
      return { status: 'healthy', timestamp: new Date().toISOString() };
    } catch (error) {
      return { status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() };
    }
  }

  // Cerrar conexiones
  async close() {
    connectionCache.clear();
    console.log('🔌 Worker DB cerrado');
  }
}

// Exportar para uso en Cloudflare Workers
export default {
  async fetch(request, env, ctx) {
    const db = new DatabaseWorker();
    
    try {
      // Inicializar si es necesario
      await db.init();
      
      // Parsear request
      const { method, url } = request;
      const body = await request.json().catch(() => ({}));
      
      // Router simple
      if (url.includes('/query')) {
        const { sql: sqlQuery, params } = body;
        const result = await db.query(sqlQuery, params);
        
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (url.includes('/registrar-login')) {
        const result = await db.registrarIntentoLogin(body);
        
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (url.includes('/health')) {
        const health = await db.healthCheck();
        
        return new Response(JSON.stringify(health), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return new Response('Not found', { status: 404 });
      
    } catch (error) {
      console.error('❌ Error en worker:', error);
      
      return new Response(JSON.stringify({ 
        error: error.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
