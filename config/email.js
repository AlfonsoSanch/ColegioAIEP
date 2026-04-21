const nodemailer = require('nodemailer');


const emailConfig = {
  service: 'gmail', //en caso de tener otro correo, outlook, yahoo, etc.
  auth: {
    user: process.env.EMAIL_USER, // las dos variables de entorno
    pass: process.env.EMAIL_PASS 
  }
};


const transporter = nodemailer.createTransport(emailConfig);

// Función que envia el token al correo
async function enviarToken(email, token, nombre) {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER || 'tu-correo@gmail.com',
      to: email,
      subject: 'Token de Verificación - Sistema Colegio AIEP',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">Colegio AIEP</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Sistema de Autenticación</p>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
            <h2 style="color: #333; margin-top: 0;">Token de Verificación</h2>
            
            <p style="color: #666; line-height: 1.6;">
              Hola <strong>${nombre}</strong>,<br><br>
              Has iniciado sesión en el sistema del Colegio AIEP. Para completar tu autenticación, 
              ingresa el siguiente token de verificación:
            </p>
            
            <div style="background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
              <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">TU TOKEN DE VERIFICACIÓN:</p>
              <h3 style="margin: 0; color: #667eea; font-size: 24px; letter-spacing: 3px; font-weight: bold;">${token}</h3>
            </div>
            
            <p style="color: #666; line-height: 1.6;">
              <strong>Importante:</strong> Este token expirará en <strong>15 minutos</strong>. 
              Si no solicitaste este token, ignora este correo.
            </p>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 20px 0; border-radius: 5px;">
              <p style="margin: 0; color: #856404; font-size: 14px;">
                <strong>Seguridad:</strong> Nunca compartas tu token con otras personas. 
                El equipo de soporte de Colegio AIEP nunca te pedirá tu token.
              </p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
            
            <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
              Este es un correo automático, por favor no responder.<br>
              © 2024 Colegio AIEP - Todos los derechos reservados.
            </p>
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Correo enviado exitosamente:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error al enviar correo:', error);
    return false;
  }
}

module.exports = {
  transporter,
  enviarToken
};
