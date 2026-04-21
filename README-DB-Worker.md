# Worker para PostgreSQL con Neon y Cloudflare

## 🏗️ **Arquitectura Implementada**

### **Componentes:**
- **Worker Serverless**: `workers/database-worker.js`
- **Cliente**: `workers/client-db.js`
- **Configuración**: `wrangler.toml`
- **Dependencias**: Actualizadas en `package.json`

## 🚀 **Instalación y Configuración**

### **1. Instalar dependencias:**
```bash
npm install @neondatabase/serverless wrangler @cloudflare/workers-types
```

### **2. Configurar Wrangler:**
```bash
npx wrangler login
```

### **3. Configurar variables de entorno:**
```bash
# Para desarrollo
export NEON_DATABASE_URL="postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require"

# O usar wrangler secrets
npx wrangler secret put NEON_DATABASE_URL
```

## 📝 **Uso del Worker**

### **Desde tu aplicación principal:**
```javascript
import DatabaseClient from './workers/client-db.js';

// Inicializar cliente
const dbClient = new DatabaseClient('https://tu-worker.workers.dev');

// Reemplazar funciones existentes
async function obtenerUsuarioPorRut(rut) {
  return await dbClient.obtenerUsuarioPorRut(rut);
}

async function guardarToken(idUsuario, token, expiresAt) {
  return await dbClient.guardarToken(idUsuario, token, expiresAt);
}

async function verificarToken(idUsuario, token) {
  return await dbClient.verificarToken(idUsuario, token);
}

async function registrarIntentoLogin(rut, tipoIntento, resultado, motivoFallo, idUsuario, req) {
  return await dbClient.registrarIntentoLogin({
    rut, tipoIntento, resultado, motivoFallo, idUsuario,
    ip: obtenerIpReal(req),
    userAgent: req.get('User-Agent') || 'Unknown'
  });
}
```

## 🔧 **Comandos de Despliegue**

### **Desarrollo:**
```bash
npm run worker:dev
```

### **Producción:**
```bash
npm run worker:deploy:prod
```

### **Ver logs:**
```bash
npm run worker:tail
```

## ✅ **Ventajas del Worker**

### **Performance:**
- ✅ **Serverless**: Sin costo cuando no se usa
- ✅ **Auto-scaling**: Escala automáticamente
- ✅ **Global**: Distribuido por Cloudflare

### **Neon Features:**
- ✅ **Connection Pooling**: Manejo eficiente de conexiones
- ✅ **Scale to Zero**: Ahorro de costos
- ✅ **Branching**: Desarrollo aislado
- ✅ **Instant Restore**: Recuperación rápida

## 🔒 **Seguridad**

### **Variables de Entorno:**
- Usar `wrangler secret put` para credenciales
- Nunca exponer `NEON_DATABASE_URL` en código

### **IP Detection:**
- Detección robusta de IP real
- Manejo de IPv6 a IPv4
- Soporte para proxies y CDNs

## 📊 **Endpoints del Worker**

### **POST /query**
```json
{
  "sql": "SELECT * FROM usuarios WHERE rut = $1",
  "params": ["12345678-9"]
}
```

### **POST /registrar-login**
```json
{
  "rut": "12345678-9",
  "tipoIntento": "LOGIN",
  "resultado": "exito",
  "motivoFallo": null,
  "idUsuario": 123,
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0..."
}
```

### **GET /health**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## 🔄 **Migración desde SQL Server**

### **Cambios necesarios:**
1. **Reemplazar `mssql` por `@neondatabase/serverless`**
2. **Actualizar sintaxis SQL** (PostgreSQL vs SQL Server)
3. **Cambiar funciones de auth.js** para usar cliente worker
4. **Actualizar variables de entorno**

### **Ejemplo de migración:**
```javascript
// Antes (SQL Server)
const sql = require('mssql/msnodesqlv8');
const connection = await sql.connect(config);

// Después (Neon + Worker)
import DatabaseClient from './workers/client-db.js';
const dbClient = new DatabaseClient(process.env.WORKER_URL);
```

## 🚨 **Consideraciones**

### **Costos:**
- **Neon**: Pago por almacenamiento y compute time
- **Cloudflare Workers**: 100,000 requests/día gratis
- **Edge**: Latencia baja global

### **Limitaciones:**
- **Worker timeout**: 50ms CPU time (ajustable)
- **Request size**: 100MB máximo
- **Concurrent connections**: Depende de plan Neon

## 📝 **Próximos Pasos**

1. **Crear tabla `intento_login`** en Neon
2. **Migrar datos existentes** si es necesario
3. **Actualizar auth.js** para usar worker
4. **Probar en desarrollo** antes de producción
5. **Configurar monitoring** y alertas
