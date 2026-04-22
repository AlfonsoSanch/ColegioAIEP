const express = require('express');
const router = express.Router();
const { enviarToken } = require('../config/email');
const crypto = require('crypto');

// URL del worker desplegado en Cloudflare Workers
const WORKER_URL = 'https://colegioaiep-production.esteban-sanchezcolarte.workers.dev';

// Funcion para registrar intentos de login usando el worker
async function registrarIntentoLogin(
  rut,
  tipoIntento,
  resultado,
  motivoFallo = null,
  idUsuario = null,
  req = null
) {
  try {
    // Obtener IP correctamente (priorizar IPv4)
    let ip = '0.0.0.0';

    if (req) {
      // Intentar obtener IP real del cliente
      const forwardedFor = req.headers['x-forwarded-for'];
      const realIp = req.headers['x-real-ip'];
      const socketAddress = req.socket?.remoteAddress;
      const expressIp = req.ip;
      
      // Función para convertir IPv6 localhost a IPv4
      const normalizeIp = (address) => {
        if (!address) return null;
        
        // Si es ::1 (IPv6 localhost), convertir a 127.0.0.1
        if (address === '::1' || address === '::ffff:127.0.0.1') {
          return '127.0.0.1';
        }
        
        // Si es IPv6 mapeada a IPv4, extraer solo la parte IPv4
        if (address.startsWith('::ffff:')) {
          return address.substring(7);
        }
        
        // Si es IPv6 válida, mantenerla
        if (address.includes(':')) {
          return address;
        }
        
        // Si es IPv4, mantenerla
        if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(address)) {
          return address;
        }
        
        return null;
      };
      
      // Priorizar headers de proxy
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
      
      // Si no hay IP válida en forwarded, intentar con x-real-ip
      if (ip === '0.0.0.0' && realIp) {
        const normalized = normalizeIp(realIp);
        if (normalized) {
          ip = normalized;
        }
      }
      
      // Si aún no hay IP válida, intentar con socket address
      if (ip === '0.0.0.0' && socketAddress) {
        const normalized = normalizeIp(socketAddress);
        if (normalized) {
          ip = normalized;
        }
      }
      
      // Último recurso: usar req.ip de Express
      if (ip === '0.0.0.0' && expressIp) {
        const normalized = normalizeIp(expressIp);
        if (normalized) {
          ip = normalized;
        }
      }
      
      // Si todo falla y estamos en localhost, usar 127.0.0.1
      if (ip === '0.0.0.0' || ip === '::1') {
        ip = '127.0.0.1';
      }
    }

    // Enviar datos al worker
    const response = await fetch(`${WORKER_URL}/registrar-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rut,
        tipoIntento,
        resultado,
        motivoFallo,
        idUsuario,
        ip,
        userAgent: req ? req.get('User-Agent') || 'Unknown' : 'Unknown'
      })
    });

    if (!response.ok) {
      throw new Error(`Worker error: ${response.status}`);
    }

    const result = await response.json();
    console.log(`Intento de ${tipoIntento} registrado: ${rut} - ${resultado}`);
    return result;

  } catch (error) {
    console.error('Error al registrar intento de login:', error);
    throw error;
  }
}

// Función para obtener usuario por RUT usando el worker
async function obtenerUsuarioPorRut(rut) {
  try {
    const response = await fetch(`${WORKER_URL}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql: `
          SELECT u.id_usuario, u.id_persona, u.password, u.activo,
                 p.rut, p.nombre, p.a_paterno, p.a_materno, p.email
          FROM usuarios u
          INNER JOIN personas p ON u.id_persona = p.id_persona
          WHERE p.rut = $1 AND u.activo = true AND p.activo = true
        `,
        params: [rut]
      })
    });

    if (!response.ok) {
      throw new Error(`Worker error: ${response.status}`);
    }

    const result = await response.json();
    return result[0] || null;
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    throw error;
  }
}

// Función para guardar token usando el worker
async function guardarToken(idUsuario, token, expiresAt) {
  try {
    const response = await fetch(`${WORKER_URL}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql: `
          INSERT INTO tokens (id_usuario, token, fecha_expiracion)
          VALUES ($1, $2, $3)
          RETURNING id_token
        `,
        params: [idUsuario, token, expiresAt]
      })
    });

    if (!response.ok) {
      throw new Error(`Worker error: ${response.status}`);
    }

    const result = await response.json();
    console.log(`Token guardado para usuario ${idUsuario}`);
    return result[0];
  } catch (error) {
    console.error('Error guardando token:', error);
    throw error;
  }
}

// Función para verificar token usando el worker
async function verificarToken(idUsuario, token) {
  try {
    // Primero verificar si el token existe y es válido
    const response = await fetch(`${WORKER_URL}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql: `
          SELECT id_token, fecha_expiracion 
          FROM tokens 
          WHERE id_usuario = $1 AND token = $2 
          AND fecha_expiracion > CURRENT_TIMESTAMP
          ORDER BY id_token DESC 
          LIMIT 1
        `,
        params: [idUsuario, token]
      })
    });

    if (!response.ok) {
      throw new Error(`Worker error: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.length > 0) {
      // Eliminar token usado
      await fetch(`${WORKER_URL}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sql: 'DELETE FROM tokens WHERE id_token = $1',
          params: [result[0].id_token]
        })
      });
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error verificando token:', error);
    throw error;
  }
}

/*async function registrarIntentoLogin(rut, tipoIntento, resultado, motivoFallo = null, idUsuario = null, req = null) {
  try {
    const connection = await sql.connect(config);
    const request = new sql.Request();
    
    request.input('id_usuario', sql.Int, idUsuario);
    request.input('rut_ingresado', sql.VarChar, rut);
    request.input('ip_origen', sql.VarChar, req ? (req.ip || req.connection.remoteAddress || '0.0.0.0') : '0.0.0.0');
    request.input('resultado', sql.VarChar, resultado.toLowerCase()); // 'exito' o 'fallo'
    request.input('motivo_fallo', sql.VarChar, motivoFallo);
    request.input('user_agent', sql.VarChar, req ? (req.get('User-Agent') || 'Unknown') : 'Unknown');
    
    await request.query(`
      INSERT INTO intento_login (id_usuario, rut_ingresado, ip_origen, resultado, motivo_fallo, user_agent)
      VALUES (@id_usuario, @rut_ingresado, @ip_origen, @resultado, @motivo_fallo, @user_agent)
    `);
    
    await connection.close();
    console.log(`Intento de ${tipoIntento} registrado: ${rut} - ${resultado}`);
  } catch (error) {
    console.error('Error al registrar intento de login:', error);
  }
}*/

// Funcion para generar token aleatorio
function generarToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Funcion para guardar token en base de datos y enviar correo (usando worker)
async function guardarTokenConEmail(idUsuario, email, nombre) {
  try {
    const token = generarToken();
    const fechaExpiracion = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos
    
    // Usar la función del worker para guardar el token
    const resultado = await guardarToken(idUsuario, token, fechaExpiracion);
    
    if (!resultado) {
      throw new Error('Error al guardar token en worker');
    }
    
    // Enviar correo con el token
    const emailEnviado = await enviarToken(email, token, nombre);
    
    if (emailEnviado) {
      console.log(`Token enviado exitosamente a ${email}`);
    } else {
      console.log(`Error al enviar token a ${email}`);
    }
    
    return token;
  } catch (error) {
    console.error('Error al guardar token:', error);
    return null;
  }
}

// Ruta para mostrar el formulario de login
router.get('/login', (req, res) => {
  res.render('login', { error: null, showToken: false, message: null, email: null });
});

// Ruta para procesar el login (primer paso)
router.post('/login', async (req, res) => {
  const { rut, contrasena } = req.body;

  try {
    // Validar que se ingresen ambos campos
    if (!rut || !contrasena) {
      // Registrar intento fallido por campos vacíos
      await registrarIntentoLogin(rut || 'DESCONOCIDO', 'LOGIN', 'FALLO', 'CAMPOS_VACIOS', null, req);
      return res.render('login', { error: 'Por favor ingrese RUT y contraseña', showToken: false, message: null, email: null });
    }

    // Consulta a la base de datos para verificar credenciales usando el worker
    const usuario = await obtenerUsuarioPorRut(rut);
    
    if (usuario && usuario.password === contrasena) {
      // Obtener tipo de usuario (necesario para redirección)
      const response = await fetch(`${WORKER_URL}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sql: `
            SELECT tu.tipo
            FROM usuarios u
            LEFT JOIN usuario_tipo ut ON u.id_usuario = ut.id_usuario
            LEFT JOIN tipo_usuario tu ON ut.id_tipo_usuario = tu.id_tipo_usuario
            WHERE u.id_usuario = $1
          `,
          params: [usuario.id_usuario]
        })
      });
      
      const tipoResult = await response.json();
      const tipoUsuario = tipoResult[0]?.tipo || 'Usuario';
      
      // Registrar intento exitoso de login (primer paso)
      await registrarIntentoLogin(rut, 'LOGIN', 'EXITO', null, usuario.id_usuario, req);
      
      // Generar y guardar token con email
      const token = await guardarTokenConEmail(usuario.id_usuario, usuario.email, usuario.nombre);
      
      if (token) {
        // Guardar datos temporales en sesión
        req.session.tempUser = {
          id_usuario: usuario.id_usuario,
          rut: usuario.rut,
          nombre: usuario.nombre,
          apellido_paterno: usuario.a_paterno,
          apellido_materno: usuario.a_materno,
          tipo: tipoUsuario,
          email: usuario.email
        };
        
        // Mostrar formulario de token
        res.render('login', { 
          error: null, 
          showToken: true, 
          email: usuario.email,
          message: 'Se ha enviado un token de verificación a su correo'
        });
      } else {
        // Registrar intento fallido por error al generar token
        await registrarIntentoLogin(rut, 'LOGIN', 'FALLO', 'ERROR_TOKEN_GENERACION', usuario.id_usuario, req);
        res.render('login', { error: 'Error al generar token', showToken: false, message: null, email: null });
      }
    } else {
      // Credenciales incorrectas
      await registrarIntentoLogin(rut, 'LOGIN', 'FALLO', 'CREDENCIALES_INVALIDAS', null, req);
      res.render('login', { error: 'RUT o contraseña incorrectos', showToken: false, message: null, email: null });
    }
  } catch (err) {
    console.error('Error en la consulta:', err);
    res.render('login', { error: 'Error del servidor. Intente nuevamente.', showToken: false, message: null, email: null });
  }
});

// Ruta para verificar token
router.post('/verify-token', async (req, res) => {
  const { token } = req.body;

  try {
    if (!req.session.tempUser) {
      return res.redirect('/auth/login');
    }

    const tempUser = req.session.tempUser;
    
    // Verificar token
    const tokenValido = await verificarToken(tempUser.id_usuario, token);
    
    if (tokenValido) {
      // Registrar intento exitoso de verificación de token
      await registrarIntentoLogin(tempUser.rut, 'TOKEN', 'EXITO', null, tempUser.id_usuario, req);
      
      // Crear sesión definitiva del usuario
      req.session.usuario = {
        id_usuario: tempUser.id_usuario,
        rut: tempUser.rut,
        nombre: tempUser.nombre,
        apellido_paterno: tempUser.apellido_paterno,
        apellido_materno: tempUser.apellido_materno,
        tipo: tempUser.tipo
      };
      
      // Limpiar datos temporales
      delete req.session.tempUser;
      
      // Redirigir según el tipo de usuario
      if (tempUser.tipo === 'Administrador') {
        res.redirect('/auth/dashadmin');
      } else if (tempUser.tipo === 'Docente') {
        res.redirect('/auth/teacher-dashboard');
      } else if (tempUser.tipo === 'Apoderado') {
        res.redirect('/auth/parent-dashboard');
      } else {
        res.redirect('/auth/dashboard');
      }
    } else {
      // Registrar intento fallido de verificación de token
      await registrarIntentoLogin(tempUser.rut, 'TOKEN', 'FALLO', 'TOKEN_INVALIDO_O_EXPIRADO', tempUser.id_usuario, req);
      
      // Token inválido
      res.render('login', { 
        error: 'Token inválido o expirado', 
        showToken: true, 
        email: tempUser.email,
        message: null
      });
    }
  } catch (err) {
    console.error('Error al verificar token:', err);
    res.render('login', { 
      error: 'Error al verificar token', 
      showToken: true, 
      email: req.session.tempUser?.email,
      message: null
    });
  }
});

// Ruta para mostrar el dashboard
router.get('/dashboard', (req, res) => {
  if (!req.session.usuario) {
    return res.redirect('/auth/login');
  }
  res.render('dashboard', { usuario: req.session.usuario });
});

// Ruta para mostrar el dashboard de administrador
router.get('/dashadmin', (req, res) => {
  if (!req.session.usuario || req.session.usuario.tipo !== 'Administrador') {
    return res.redirect('/auth/login');
  }
  res.render('admin/dashadmin', { usuario: req.session.usuario });
});

// Ruta para mostrar el dashboard de docentes
router.get('/teacher-dashboard', (req, res) => {
  if (!req.session.usuario || req.session.usuario.tipo !== 'Docente') {
    return res.redirect('/auth/login');
  }
  res.render('teacher/dash-teacher', { usuario: req.session.usuario });
});

// Ruta para mostrar el dashboard de apoderados
router.get('/parent-dashboard', (req, res) => {
  if (!req.session.usuario || req.session.usuario.tipo !== 'Apoderado') {
    return res.redirect('/auth/login');
  }
  res.render('parent/dash-parent', { usuario: req.session.usuario });
});

// Ruta para cerrar sesión
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/auth/login');
  });
});

module.exports = router;
