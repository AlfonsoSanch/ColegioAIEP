const express = require('express');
const sql = require('mssql/msnodesqlv8');
const router = express.Router();
const config = require('../config/database');
const { enviarToken } = require('../config/email');
const crypto = require('crypto');

// Funcion para registrar intentos de login

async function registrarIntentoLogin(
  rut,
  tipoIntento,
  resultado,
  motivoFallo = null,
  idUsuario = null,
  req = null
) {
  try {
    const connection = await sql.connect(config);
    const request = new sql.Request();

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

    request.input('id_usuario', sql.Int, idUsuario);
    request.input('rut_ingresado', sql.VarChar, rut);
    request.input('ip_origen', sql.VarChar, ip);
    request.input('resultado', sql.VarChar, resultado.toLowerCase());
    request.input('motivo_fallo', sql.VarChar, motivoFallo);
    request.input(
      'user_agent',
      sql.VarChar,
      req ? req.get('User-Agent') || 'Unknown' : 'Unknown'
    );

    await request.query(`
      INSERT INTO intento_login 
      (id_usuario, rut_ingresado, ip_origen, resultado, motivo_fallo, user_agent)
      VALUES 
      (@id_usuario, @rut_ingresado, @ip_origen, @resultado, @motivo_fallo, @user_agent)
    `);

    await connection.close();
    console.log(`Intento de ${tipoIntento} registrado: ${rut} - ${resultado}`);
  } catch (error) {
    console.error('Error al registrar intento de login:', error);
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

// Funcion para guardar token en base de datos y enviar correo
async function guardarToken(idUsuario, email, nombre) {
  try {
    const connection = await sql.connect(config);
    const request = new sql.Request();
    
    const token = generarToken();
    const fechaExpiracion = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos
    
    request.input('id_usuario', sql.Int, idUsuario);
    request.input('token', sql.VarChar, token);
    request.input('fecha_expiracion', sql.DateTime, fechaExpiracion);
    
    await request.query(`
      INSERT INTO tokens (id_usuario, token, fecha_expiracion)
      VALUES (@id_usuario, @token, @fecha_expiracion)
    `);
    
    await connection.close();
    
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

// Funcion para verificar token
async function verificarToken(idUsuario, tokenIngresado) {
  try {
    const connection = await sql.connect(config);
    const request = new sql.Request();
    
    request.input('id_usuario', sql.Int, idUsuario);
    request.input('token', sql.VarChar, tokenIngresado);
    request.input('fecha_actual', sql.DateTime, new Date());
    
    const result = await request.query(`
      SELECT id_token FROM tokens 
      WHERE id_usuario = @id_usuario 
      AND token = @token 
      AND fecha_expiracion > @fecha_actual
    `);
    
    await connection.close();
    return result.recordset.length > 0;
  } catch (error) {
    console.error('Error al verificar token:', error);
    return false;
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

    // Consulta a la base de datos para verificar credenciales
    const connection = await sql.connect(config);
    const request = new sql.Request();
    
    request.input('rut', sql.VarChar, rut);
    request.input('password', sql.VarChar, contrasena);

    const result = await request.query(`
      SELECT u.id_usuario, p.nombre, p.a_paterno, p.a_materno, p.rut, p.email, tu.tipo
      FROM usuarios u
      INNER JOIN personas p ON u.id_persona = p.id_persona
      LEFT JOIN usuario_tipo ut ON u.id_usuario = ut.id_usuario
      LEFT JOIN tipo_usuario tu ON ut.id_tipo_usuario = tu.id_tipo_usuario
      WHERE p.rut = @rut AND u.password = @password AND u.activo = 1
    `);
    
    await connection.close();
    
    if (result.recordset.length > 0) {
      const userData = result.recordset[0];
      
      // Registrar intento exitoso de login (primer paso)
      await registrarIntentoLogin(rut, 'LOGIN', 'EXITO', null, userData.id_usuario, req);
      
      // Generar y guardar token
      const token = await guardarToken(userData.id_usuario, userData.email, userData.nombre);
      
      if (token) {
        // Guardar datos temporales en sesión
        req.session.tempUser = {
          id_usuario: userData.id_usuario,
          rut: userData.rut,
          nombre: userData.nombre,
          apellido_paterno: userData.a_paterno,
          apellido_materno: userData.a_materno,
          tipo: userData.tipo || 'Usuario',
          email: userData.email
        };
        
        // Mostrar formulario de token
        res.render('login', { 
          error: null, 
          showToken: true, 
          email: userData.email,
          message: 'Se ha enviado un token de verificación a su correo'
        });
      } else {
        // Registrar intento fallido por error al generar token
        await registrarIntentoLogin(rut, 'LOGIN', 'FALLO', 'ERROR_TOKEN_GENERACION', userData.id_usuario, req);
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
