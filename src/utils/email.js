import { Resend } from 'resend';

let resendClient = null;

function getResendClient() {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      resendClient = new Resend(apiKey);
    }
  }
  return resendClient;
}

export async function sendResetEmail({ to, resetUrl }) {
  const client = getResendClient();

  if (!client) {
    console.log(`[EMAIL MOCK] Reset email to ${to}: ${resetUrl}`);
    return { id: 'mock-email-id' };
  }

  const { data, error } = await client.emails.send({
    from: 'PetLife <noreply@petlife.app>',
    to: [to],
    subject: 'Redefinir sua senha — PetLife',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Redefinir Senha</h2>
        <p>Voce solicitou a redefinicao da sua senha no PetLife.</p>
        <p>Clique no link abaixo para criar uma nova senha:</p>
        <a href="${resetUrl}"
           style="display: inline-block; padding: 12px 24px; background: #7C3AED; color: white; text-decoration: none; border-radius: 8px; margin: 16px 0;">
          Redefinir Senha
        </a>
        <p style="color: #666; font-size: 14px;">
          Este link expira em 1 hora. Se voce nao solicitou esta alteracao, ignore este email.
        </p>
      </div>
    `,
  });

  if (error) {
    console.error('Failed to send reset email:', error);
    throw new Error('Failed to send email');
  }

  return data;
}

// For testing: allow injecting a mock
export function setResendClient(client) {
  resendClient = client;
}
