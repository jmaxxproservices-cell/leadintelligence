import { Lead } from '../types';
import { recordContactAttempt } from './eventSystem';

export interface MessageTemplate {
  subject?: string;
  body: string;
  variables: Record<string, string>;
}

export interface WhatsAppMessage {
  phone: string;
  message: string;
  link?: string;
}

export interface EmailTemplate {
  to: string;
  subject: string;
  body: string;
  html?: string;
}

const WHATSAPP_BUSINESS_ACCOUNT = import.meta.env.VITE_WHATSAPP_BUSINESS_ACCOUNT || '';
const WHATSAPP_API_KEY = import.meta.env.VITE_WHATSAPP_API_KEY || '';

function interpolateTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || '');
}

export function generateWhatsAppMessage(lead: Lead): WhatsAppMessage {
  const variables = {
    contact_name: lead.contact_name || 'Cliente',
    service_type: lead.service_type || 'servicio',
    city: lead.city || 'su zona',
    title: lead.title,
  };

  const templates: Record<string, string> = {
    renovation: `¡Hola {{contact_name}}!

Gracias por su interés en nuestros servicios de renovación en {{city}}.

Hemos recibido su solicitud sobre: "{{title}}"

Me gustaría coordinar una visita gratuita para evaluar el proyecto y preparar un presupuesto detallado.

¿Tiene disponibilidad esta semana?

Saludos,
Equipo JMAXX`,

    construction: `¡Hola {{contact_name}}!

Recibimos su consulta sobre construcción en {{city}}.

Para poder ofrecerle un presupuesto preciso, necesitamos algunos detalles adicionales sobre el proyecto: "{{title}}"

¿Podríamos agendar una llamada de 10 minutos?

Un saludo,
Equipo JMAXX`,

    default: `¡Hola {{contact_name}}!

Gracias por contactarnos. Hemos recibido su solicitud sobre: "{{title}}"

Nos pondremos en contacto pronto para coordinar una visita en {{city}}.

Saludos cordiales,
Equipo JMAXX`,
  };

  const templateKey = lead.service_type?.toLowerCase() || 'default';
  const template = templates[templateKey] || templates.default;
  const message = interpolateTemplate(template, variables);

  const cleanPhone = (lead.phone || '').replace(/[^0-9]/g, '');
  const formattedPhone = cleanPhone.startsWith('41') ? `+${cleanPhone}` : `+41${cleanPhone.replace(/^0/, '')}`;

  return {
    phone: formattedPhone,
    message,
    link: `https://wa.me/${formattedPhone.replace('+', '')}?text=${encodeURIComponent(message)}`,
  };
}

export function generateEmailTemplate(lead: Lead): EmailTemplate {
  const variables = {
    contact_name: lead.contact_name || 'Cliente',
    service_type: lead.service_type || 'servicio',
    city: lead.city || 'su zona',
    title: lead.title,
    description: lead.description || 'Sin descripción detallada',
  };

  const subject = `Solicitud: ${lead.title} - JMAXX Servicios`;

  const body = `Estimado/a ${variables.contact_name},

Gracias por su interés en nuestros servicios.

Hemos recibido su solicitud sobre: "${lead.title}"

Descripción del proyecto:
${variables.description}

Ubicación: ${variables.city}

Para poder ofrecerle un presupuesto personalizado, nos gustaría:
1. Coordinar una visita gratuita al lugar
2. Entender mejor sus necesidades específicas
3. Presentarle nuestras opciones y garantías

¿Tiene disponibilidad para una breve llamada esta semana?

Puede contactarnos directamente respondiendo a este email o llamando al +41 XX XXX XX XX.

Saludos cordiales,

Equipo JMAXX Servicios
Tel: +41 XX XXX XX XX
Email: info@jmaxx.ch
Web: www.jmaxx.ch`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
      <h1 style="margin: 0;">JMAXX</h1>
      <p style="margin: 5px 0 0 0;">Servicios Profesionales</p>
    </div>

    <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px;">
      <p>Estimado/a <strong>${variables.contact_name}</strong>,</p>

      <p>Gracias por su interés en nuestros servicios.</p>

      <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
        <h3 style="margin-top: 0; color: #2563eb;">${lead.title}</h3>
        <p style="margin-bottom: 0;"><strong>Ubicación:</strong> ${variables.city}</p>
      </div>

      <p>Para ofrecerle un presupuesto personalizado, nos gustaría coordinar una visita gratuita.</p>

      <p>¿Tiene disponibilidad esta semana?</p>

      <div style="margin: 30px 0;">
        <a href="tel:+41XXXXXXXX" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Llamar Ahora
        </a>
      </div>

      <p>Saludos cordiales,<br><strong>Equipo JMAXX</strong></p>
    </div>

    <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
      <p>JMAXX Servicios | Suiza</p>
    </div>
  </div>
</body>
</html>`;

  return {
    to: lead.email || '',
    subject,
    body,
    html,
  };
}

export function generateQuoteData(lead: Lead): {
  leadId: string;
  title: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientAddress: string;
  serviceType: string;
  description: string;
  suggestedItems: Array<{
    description: string;
    quantity: number;
    unit: string;
    estimatedPrice: number;
  }>;
} {
  const baseRates: Record<string, { unit: string; priceRange: [number, number] }> = {
    renovation: { unit: 'm²', priceRange: [800, 1500] },
    construction: { unit: 'm²', priceRange: [2500, 4000] },
    painting: { unit: 'm²', priceRange: [25, 50] },
    plumbing: { unit: 'hora', priceRange: [120, 180] },
    electrical: { unit: 'hora', priceRange: [100, 150] },
    cleaning: { unit: 'm²', priceRange: [15, 30] },
    heating: { unit: 'unidad', priceRange: [5000, 15000] },
    solar: { unit: 'kWp', priceRange: [2000, 3500] },
  };

  const serviceType = (lead.service_type || 'renovation').toLowerCase();
  const rate = baseRates[serviceType] || baseRates.renovation;

  return {
    leadId: lead.id,
    title: `Presupuesto: ${lead.title}`,
    clientName: lead.contact_name || 'Cliente',
    clientEmail: lead.email || '',
    clientPhone: lead.phone || '',
    clientAddress: [lead.city, lead.canton].filter(Boolean).join(', '),
    serviceType,
    description: lead.description || '',
    suggestedItems: [
      {
        description: `${lead.title} - Trabajos principales`,
        quantity: 1,
        unit: 'unidad',
        estimatedPrice: rate.priceRange[0] * 10,
      },
      {
        description: 'Visita técnica y evaluación',
        quantity: 1,
        unit: 'unidad',
        estimatedPrice: 150,
      },
      {
        description: 'Gestión de permisos (si aplica)',
        quantity: 1,
        unit: 'unidad',
        estimatedPrice: 300,
      },
    ],
  };
}

export async function sendWhatsAppMessage(lead: Lead): Promise<{
  success: boolean;
  link?: string;
  error?: string;
}> {
  const waMessage = generateWhatsAppMessage(lead);

  await recordContactAttempt(lead.id, 'whatsapp');

  if (!WHATSAPP_API_KEY || !WHATSAPP_BUSINESS_ACCOUNT) {
    return {
      success: true,
      link: waMessage.link,
    };
  }

  return {
    success: true,
    link: waMessage.link,
  };
}

export async function sendEmail(lead: Lead): Promise<{
  success: boolean;
  preview?: EmailTemplate;
  error?: string;
}> {
  const emailTemplate = generateEmailTemplate(lead);

  await recordContactAttempt(lead.id, 'email');

  return {
    success: true,
    preview: emailTemplate,
  };
}
