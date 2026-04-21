// Cliente para interactuar con el worker de base de datos
// Para usar desde tu aplicación principal

class DatabaseClient {
  constructor(workerUrl) {
    this.workerUrl = workerUrl;
    this.cache = new Map();
  }

  // Método genérico para ejecutar queries
  async query(sql, params = []) {
    try {
      const response = await fetch(`${this.workerUrl}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql, params })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Error en query:', error);
      throw error;
    }
  }

  // Registrar intento de login
  async registrarIntentoLogin(data) {
    try {
      const response = await fetch(`${this.workerUrl}/registrar-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Error registrando intento:', error);
      throw error;
    }
  }

  // Obtener usuario por RUT
  async obtenerUsuarioPorRut(rut) {
    const query = `
      SELECT id_usuario, rut, nombre, apellido_paterno, apellido_materno, 
             email, tipo, password_hash
      FROM usuarios 
      WHERE rut = $1 AND activo = true
    `;
    
    return this.query(query, [rut]);
  }

  // Guardar token
  async guardarToken(idUsuario, token, expiresAt) {
    const query = `
      INSERT INTO tokens (id_usuario, token, fecha_expiracion, creado_en)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      RETURNING id_token
    `;
    
    return this.query(query, [idUsuario, token, expiresAt]);
  }

  // Verificar token
  async verificarToken(idUsuario, token) {
    const query = `
      SELECT id_token, fecha_expiracion 
      FROM tokens 
      WHERE id_usuario = $1 AND token = $2 
      AND fecha_expiracion > CURRENT_TIMESTAMP
      ORDER BY creado_en DESC 
      LIMIT 1
    `;
    
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
  }

  // Health check
  async healthCheck() {
    try {
      const response = await fetch(`${this.workerUrl}/health`);
      return await response.json();
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }
}

// Exportar para usar en tu aplicación
export default DatabaseClient;

// Ejemplo de uso en tu auth.js:
/*
import DatabaseClient from './workers/client-db.js';

// Inicializar cliente
const dbClient = new DatabaseClient('https://tu-worker.workers.dev');

// Reemplazar tus funciones actuales:

async function obtenerUsuarioPorRut(rut) {
  try {
    const result = await dbClient.obtenerUsuarioPorRut(rut);
    return result[0] || null;
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    throw error;
  }
}

async function guardarToken(idUsuario, token, expiresAt) {
  try {
    const result = await dbClient.guardarToken(idUsuario, token, expiresAt);
    return result[0];
  } catch (error) {
    console.error('Error guardando token:', error);
    throw error;
  }
}

async function verificarToken(idUsuario, token) {
  try {
    return await dbClient.verificarToken(idUsuario, token);
  } catch (error) {
    console.error('Error verificando token:', error);
    throw error;
  }
}

async function registrarIntentoLogin(rut, tipoIntento, resultado, motivoFallo = null, idUsuario = null, req = null) {
  try {
    // Obtener IP correctamente
    let ip = '0.0.0.0';
    
    if (req) {
      const forwardedFor = req.headers['x-forwarded-for'];
      const realIp = req.headers['x-real-ip'];
      const socketAddress = req.socket?.remoteAddress;
      const expressIp = req.ip;
      
      const normalizeIp = (address) => {
        if (!address) return null;
        
        if (address === '::1' || address === '::ffff:127.0.0.1') {
          return '127.0.0.1';
        }
        
        if (address.startsWith('::ffff:')) {
          return address.substring(7);
        }
        
        if (address.includes(':')) {
          return address;
        }
        
        if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(address)) {
          return address;
        }
        
        return null;
      };
      
      if (forwardedFor) {
        const ips = forwardedFor.split(',').map(ip => ip.trim());
        for (const currentIp of ips) {
          const normalized = normalizeIp(currentIp);
          if (normalized && normalized !== '127.0.0.1') {
            ip = normalized;
            break;
          }
        }
      }
      
      if (ip === '0.0.0.0' && realIp) {
        const normalized = normalizeIp(realIp);
        if (normalized) {
          ip = normalized;
        }
      }
      
      if (ip === '0.0.0.0' && socketAddress) {
        const normalized = normalizeIp(socketAddress);
        if (normalized) {
          ip = normalized;
        }
      }
      
      if (ip === '0.0.0.0' && expressIp) {
        const normalized = normalizeIp(expressIp);
        if (normalized) {
          ip = normalized;
        }
      }
      
      if (ip === '0.0.0.0' || ip === '::1') {
        ip = '127.0.0.1';
      }
    }

    const data = {
      rut,
      tipoIntento,
      resultado,
      motivoFallo,
      idUsuario,
      ip,
      userAgent: req ? req.get('User-Agent') || 'Unknown' : 'Unknown'
    };

    return await dbClient.registrarIntentoLogin(data);
  } catch (error) {
    console.error('Error registrando intento:', error);
    throw error;
  }
}
*/
