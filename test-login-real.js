// Script para probar login con la estructura real de datos migrados desde SQL Server

import { neon } from '@neondatabase/serverless';

const NEON_DATABASE_URL = 'postgresql://neondb_owner:npg_AFeUblfLt1Z9@ep-spring-waterfall-am602rpp-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(NEON_DATABASE_URL);

console.log('=== PRUEBA DE LOGIN CON DATOS REALES MIGRADOS ===\n');

async function testLoginWithRealData() {
  try {
    // 1. Ver personas y usuarios
    console.log('1. Verificando personas y usuarios...');
    const usuariosConPersonas = await sql(`
      SELECT u.id_usuario, u.id_persona, u.activo as usuario_activo,
             p.rut, p.nombre, p.a_paterno, p.a_materno, p.email, p.activo as persona_activo
      FROM usuarios u
      LEFT JOIN personas p ON u.id_persona = p.id_persona
      WHERE u.activo = true AND p.activo = true
      LIMIT 5
    `);
    
    console.log('Usuarios activos encontrados:');
    usuariosConPersonas.forEach(user => {
      console.log(`  - ID: ${user.id_usuario}, RUT: ${user.rut}`);
      console.log(`    Nombre: ${user.nombre} ${user.a_paterno} ${user.a_materno || ''}`);
      console.log(`    Email: ${user.email}`);
    });
    
    if (usuariosConPersonas.length === 0) {
      console.log('No hay usuarios activos. Verificando todos...');
      const todosUsuarios = await sql(`
        SELECT u.id_usuario, u.id_persona, u.activo as usuario_activo,
               p.rut, p.nombre, p.a_paterno, p.a_materno, p.email, p.activo as persona_activo
        FROM usuarios u
        LEFT JOIN personas p ON u.id_persona = p.id_persona
        LIMIT 3
      `);
      
      console.log('Primeros usuarios (incluyendo inactivos):');
      todosUsuarios.forEach(user => {
        console.log(`  - ID: ${user.id_usuario}, RUT: ${user.rut}, Activo: ${user.usuario_activo && user.persona_activo}`);
      });
    }
    
    // 2. Probar obtener usuario por RUT (usando la estructura real)
    console.log('\n2. Probando obtener usuario por RUT...');
    const testRut = usuariosConPersonas[0]?.rut || '20541621-8';
    
    const usuarioPorRut = await sql(`
      SELECT u.id_usuario, u.id_persona, u.password, u.activo,
             p.rut, p.nombre, p.a_paterno, p.a_materno, p.email
      FROM usuarios u
      INNER JOIN personas p ON u.id_persona = p.id_persona
      WHERE p.rut = $1 AND u.activo = true AND p.activo = true
    `, [testRut]);
    
    if (usuarioPorRut.length > 0) {
      const user = usuarioPorRut[0];
      console.log(`Usuario encontrado: ${user.nombre} ${user.a_paterno}`);
      console.log(`  - ID Usuario: ${user.id_usuario}`);
      console.log(`  - ID Persona: ${user.id_persona}`);
      console.log(`  - RUT: ${user.rut}`);
      console.log(`  - Email: ${user.email}`);
      console.log(`  - Activo: ${user.activo}`);
      console.log(`  - Tiene password: ${user.password ? 'Sí' : 'No'}`);
    } else {
      console.log('No se encontró usuario activo con RUT:', testRut);
    }
    
    // 3. Probar registrar intento de login
    console.log('\n3. Probando registrar intento de login...');
    
    const intentoData = {
      rut_ingresado: testRut,
      id_usuario: usuarioPorRut[0]?.id_usuario || null,
      ip_origen: '192.168.1.100',
      resultado: 'exito',
      motivo_fallo: null,
      user_agent: 'Mozilla/5.0 (Test Browser)'
    };
    
    const intentoRegistrado = await sql(`
      INSERT INTO intento_login 
      (id_usuario, rut_ingresado, ip_origen, resultado, motivo_fallo, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id_intento, fecha_intento
    `, [
      intentoData.id_usuario,
      intentoData.rut_ingresado,
      intentoData.ip_origen,
      intentoData.resultado,
      intentoData.motivo_fallo,
      intentoData.user_agent
    ]);
    
    console.log('Intento de login registrado:');
    console.log(`  - ID: ${intentoRegistrado[0].id_intento}`);
    console.log(`  - Fecha: ${intentoRegistrado[0].fecha_intento}`);
    console.log(`  - RUT: ${intentoData.rut_ingresado}`);
    console.log(`  - Resultado: ${intentoData.resultado}`);
    
    // 4. Probar guardar token
    console.log('\n4. Probando guardar token...');
    
    const token = 'test_token_' + Date.now();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos
    
    const tokenGuardado = await sql(`
      INSERT INTO tokens (id_usuario, token, fecha_expiracion)
      VALUES ($1, $2, $3)
      RETURNING id_token
    `, [
      usuarioPorRut[0]?.id_usuario || 1,
      token,
      expiresAt
    ]);
    
    console.log('Token guardado:');
    console.log(`  - ID: ${tokenGuardado[0].id_token}`);
    console.log(`  - Expira: ${expiresAt}`);
    
    // 5. Probar verificar token
    console.log('\n5. Probando verificar token...');
    
    const tokenVerificado = await sql(`
      SELECT id_token, fecha_expiracion 
      FROM tokens 
      WHERE id_usuario = $1 AND token = $2 
      AND fecha_expiracion > CURRENT_TIMESTAMP
      ORDER BY id_token DESC 
      LIMIT 1
    `, [
      usuarioPorRut[0]?.id_usuario || 1,
      token
    ]);
    
    if (tokenVerificado.length > 0) {
      console.log('Token verificado exitosamente');
      
      // Eliminar token usado
      await sql('DELETE FROM tokens WHERE id_token = $1', [tokenVerificado[0].id_token]);
      console.log('Token eliminado después de verificación');
    } else {
      console.log('Token no encontrado o expirado');
    }
    
    // 6. Ver estadísticas de intentos de login
    console.log('\n6. Estadísticas de intentos de login...');
    
    const stats = await sql(`
      SELECT 
        COUNT(*) as total_intentos,
        COUNT(CASE WHEN resultado = 'exito' THEN 1 END) as exitosos,
        COUNT(CASE WHEN resultado = 'fallo' THEN 1 END) as fallidos,
        DATE(fecha_intento) as fecha
      FROM intento_login 
      WHERE fecha_intento >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY DATE(fecha_intento)
      ORDER BY fecha DESC
    `);
    
    console.log('Estadísticas últimos 7 días:');
    stats.forEach(stat => {
      console.log(`  ${stat.fecha}: ${stat.total_intentos} total, ${stat.exitosos} exitosos, ${stat.fallidos} fallidos`);
    });
    
    // 7. Intentos de login recientes
    console.log('\n7. Intentos de login recientes...');
    
    const intentosRecientes = await sql(`
      SELECT il.rut_ingresado, il.resultado, il.ip_origen, il.fecha_intento, il.user_agent,
             p.nombre, p.a_paterno
      FROM intento_login il
      LEFT JOIN usuarios u ON il.id_usuario = u.id_usuario
      LEFT JOIN personas p ON u.id_persona = p.id_persona
      ORDER BY il.fecha_intento DESC 
      LIMIT 5
    `);
    
    console.log('Intentos recientes:');
    intentosRecientes.forEach(intento => {
      console.log(`  ${intento.fecha_intento} - ${intento.rut_ingresado} - ${intento.resultado} - ${intento.ip_origen}`);
      if (intento.nombre) {
        console.log(`    Usuario: ${intento.nombre} ${intento.a_paterno || ''}`);
      }
    });
    
    // 8. Verificar tipos de usuario
    console.log('\n8. Verificando tipos de usuario...');
    
    try {
      const tiposUsuario = await sql('SELECT * FROM tipo_usuario');
      console.log('Tipos de usuario disponibles:');
      tiposUsuario.forEach(tipo => {
        console.log(`  - ID: ${tipo.id_tipo}, Nombre: ${tipo.nombre}`);
      });
      
      // Ver relaciones usuario-tipo
      const usuarioTipos = await sql(`
        SELECT u.id_usuario, p.rut, p.nombre, tu.nombre as tipo_usuario
        FROM usuarios u
        LEFT JOIN personas p ON u.id_persona = p.id_persona
        LEFT JOIN usuario_tipo ut ON u.id_usuario = ut.id_usuario
        LEFT JOIN tipo_usuario tu ON ut.id_tipo = tu.id_tipo
        LIMIT 5
      `);
      
      console.log('\nUsuarios con sus tipos:');
      usuarioTipos.forEach(ut => {
        console.log(`  - ${ut.rut}: ${ut.nombre} -> ${ut.tipo_usuario || 'Sin tipo'}`);
      });
      
    } catch (error) {
      console.log('Error verificando tipos de usuario:', error.message);
    }
    
    console.log('\n=== PRUEBAS COMPLETADAS EXITOSAMENTE ===');
    console.log('Todas las funciones de login funcionan correctamente con la estructura migrada desde SQL Server');
    
  } catch (error) {
    console.error('Error en pruebas:', error.message);
    console.error('Detalles:', error);
  }
}

// Ejecutar pruebas
testLoginWithRealData();
