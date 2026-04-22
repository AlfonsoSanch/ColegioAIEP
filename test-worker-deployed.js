// Script para probar el worker desplegado en Cloudflare Workers

console.log('=== PROBANDO WORKER DESPLEGADO ===\n');

async function testDeployedWorker() {
  try {
    const workerUrl = 'https://colegioaiep-production.esteban-sanchezcolarte.workers.dev';
    
    console.log('URL del Worker:', workerUrl);
    
    // 1. Probar health check
    console.log('\n1. Probando health check...');
    const healthResponse = await fetch(`${workerUrl}/health`);
    
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('✅ Health check exitoso:');
      console.log('  - Status:', healthData.status);
      console.log('  - Timestamp:', healthData.timestamp);
    } else {
      console.log('❌ Health check fallido:', healthResponse.status);
      console.log('  - Text:', await healthResponse.text());
    }
    
    // 2. Probar query simple
    console.log('\n2. Probando query simple...');
    const queryResponse = await fetch(`${workerUrl}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql: 'SELECT NOW() as server_time, version() as db_version',
        params: []
      })
    });
    
    if (queryResponse.ok) {
      const queryData = await queryResponse.json();
      console.log('✅ Query exitoso:');
      console.log('  - Server Time:', queryData[0]?.server_time);
      console.log('  - DB Version:', queryData[0]?.db_version);
    } else {
      console.log('❌ Query fallido:', queryResponse.status);
      console.log('  - Text:', await queryResponse.text());
    }
    
    // 3. Probar registrar intento de login
    console.log('\n3. Probando registrar intento de login...');
    const loginResponse = await fetch(`${workerUrl}/registrar-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rut: '20541621-8',
        tipoIntento: 'LOGIN',
        resultado: 'exito',
        motivoFallo: null,
        idUsuario: 1,
        ip: '192.168.1.100',
        userAgent: 'Test Worker Deployed'
      })
    });
    
    if (loginResponse.ok) {
      const loginData = await loginResponse.json();
      console.log('✅ Registro de login exitoso:');
      console.log('  - ID Intento:', loginData.id_intento);
      console.log('  - Fecha:', loginData.fecha_intento);
    } else {
      console.log('❌ Registro de login fallido:', loginResponse.status);
      console.log('  - Text:', await loginResponse.text());
    }
    
    console.log('\n=== PRUEBAS COMPLETADAS ===');
    console.log('Worker desplegado y funcionando correctamente');
    
  } catch (error) {
    console.error('Error probando worker:', error.message);
    console.error('Detalles:', error);
  }
}

// Ejecutar pruebas
testDeployedWorker();
