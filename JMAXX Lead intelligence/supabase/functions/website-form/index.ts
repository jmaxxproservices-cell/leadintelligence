import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Form-Signature",
};

interface FormSubmission {
  name: string;
  phone: string;
  email?: string;
  city: string;
  service?: string;
  message?: string;
  form_id?: string;
  timestamp?: string;
}

// Swiss phone number normalization
function normalizeSwissPhone(phone?: string): string | null {
  if (!phone) return null;

  let cleaned = phone.replace(/[^\d+]/g, '').trim();

  if (!cleaned || cleaned.length < 4) return null;

  if (cleaned.startsWith('+41')) {
    const digits = cleaned.replace('+', '');
    if (digits.length === 11 || digits.length === 12) {
      return cleaned;
    }
    return null;
  }

  if (cleaned.startsWith('0041')) {
    const rest = cleaned.slice(4);
    const normalized = '+41' + (rest.startsWith('0') ? rest.slice(1) : rest);
    if (normalized.length >= 12 && normalized.length <= 13) {
      return normalized;
    }
    return null;
  }

  if (cleaned.startsWith('0')) {
    const digits = cleaned.slice(1);
    const normalized = '+41' + digits;
    if (normalized.length >= 12 && normalized.length <= 13) {
      return normalized;
    }
  }

  if (cleaned.length === 9 || cleaned.length === 10) {
    const normalized = '+41' + cleaned;
    if (normalized.length === 12 || normalized.length === 13) {
      return normalized;
    }
  }

  if (phone.includes('+')) {
    return phone.replace(/[^\d+]/g, '');
  }

  return null;
}

// Canton inference from city
function inferCanton(city: string | null): string | null {
  if (!city) return null;

  const cityToCanton: Record<string, string> = {
    'zurich': 'ZH', 'zürich': 'ZH',
    'geneva': 'GE', 'genève': 'GE', 'geneve': 'GE',
    'basel': 'BS', 'bale': 'BS', 'bâle': 'BS',
    'lausanne': 'VD',
    'bern': 'BE', 'berne': 'BE',
    'luzern': 'LU', 'lucerne': 'LU',
    'stgallen': 'SG', 'st. gallen': 'SG', 'st gallen': 'SG',
    'lugano': 'TI',
    'winterthur': 'ZH',
    'biel': 'BE', 'bienne': 'BE',
    'thun': 'BE',
    'fribourg': 'FR', 'freiburg': 'FR',
    'schaffhausen': 'SH',
    'chur': 'GR',
    'neuchtel': 'NE', 'neuchâtel': 'NE',
    'zoug': 'ZG', 'zug': 'ZG',
    'aarau': 'AG',
    'baden': 'AG',
    'olten': 'SO',
    'solothurn': 'SO',
    'frauenfeld': 'TG',
    'bellinzona': 'TI',
    'nyon': 'VD',
    'vevey': 'VD',
    'montreux': 'VD',
    'sion': 'VS',
    'martigny': 'VS',
    'brig': 'VS',
    'visp': 'VS',
  };

  const normalized = city.toLowerCase().trim();

  if (cityToCanton[normalized]) {
    return cityToCanton[normalized];
  }

  for (const [cityName, canton] of Object.entries(cityToCanton)) {
    if (normalized.includes(cityName) || cityName.includes(normalized)) {
      return canton;
    }
  }

  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { name, phone, email, city, service, message, form_id } = body as FormSubmission;

    // Validate required fields
    if (!name || !phone || !city) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields',
          required: ['name', 'phone', 'city'],
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize phone
    const normalizedPhone = normalizeSwissPhone(phone);
    if (!normalizedPhone) {
      return new Response(
        JSON.stringify({
          error: 'Invalid phone number format',
          message: 'Please provide a valid Swiss phone number',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for duplicate within 10 minutes
    const windowStart = new Date(Date.now() - 10 * 60 * 1000);

    // Check by email
    if (email) {
      const { data: existingByEmail } = await supabase
        .from('leads')
        .select('id')
        .eq('email', email.toLowerCase())
        .gte('created_at', windowStart.toISOString())
        .maybeSingle();

      if (existingByEmail) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Form received - we already have your recent submission',
            duplicate: true,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check by phone
    const { data: existingByPhone } = await supabase
      .from('leads')
      .select('id')
      .eq('phone', normalizedPhone)
      .gte('created_at', windowStart.toISOString())
      .maybeSingle();

    if (existingByPhone) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Form received - we already have your recent submission',
          duplicate: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Infer canton
    const canton = inferCanton(city);

    // Generate title
    const titleParts = [];
    if (service) {
      titleParts.push(service);
    } else {
      titleParts.push('Website inquiry');
    }
    titleParts.push(`in ${city}`);
    if (name) {
      titleParts.push(`from ${name}`);
    }
    const title = titleParts.join(' ');

    // Generate external ID
    const externalId = `web-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // Insert the lead
    const { data: newLead, error: insertError } = await supabase
      .from('leads')
      .insert({
        external_id: externalId,
        external_url: 'https://jmaxxproservices.com',
        source: 'website',
        title,
        description: message || null,
        city,
        canton,
        service_type: service || null,
        contact_name: name,
        phone: normalizedPhone,
        email: email || null,
        status: 'new',
        score: 50,
        classification: 'medium',
        raw_data: body,
      })
      .select()
      .single();

    if (insertError || !newLead) {
      console.error('Failed to insert lead:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create lead' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Run scoring
    const { data: rules } = await supabase
      .from('scoring_rules')
      .select('*')
      .eq('is_active', true);

    let urgency = 0;
    let intent = 0;
    let serviceScore = 0;
    let geographic = 0;

    const textToAnalyze = `${title} ${message || ''} ${service || ''}`.toLowerCase();

    if (rules) {
      for (const rule of rules) {
        if (textToAnalyze.includes(rule.pattern.toLowerCase())) {
          switch (rule.category) {
            case 'urgency':
              urgency += rule.score_impact;
              break;
            case 'intent':
              intent += rule.score_impact;
              break;
            case 'service':
              serviceScore += rule.score_impact;
              break;
            case 'geographic':
              geographic += rule.score_impact;
              break;
          }
        }
      }
    }

    // Website leads get bonus for direct contact intent
    intent += 10;

    const totalScore = Math.min(100, Math.max(0, 50 + urgency + intent + serviceScore + geographic));
    const classification = totalScore >= 80 ? 'hot' : totalScore >= 65 ? 'high' : totalScore >= 45 ? 'medium' : 'low';

    // Update lead with score
    const { data: scoredLead } = await supabase
      .from('leads')
      .update({
        score: totalScore,
        classification,
        urgency_detected: urgency > 0,
        last_scored_at: new Date().toISOString(),
      })
      .eq('id', newLead.id)
      .select()
      .single();

    const finalLead = scoredLead || newLead;

    // Generate WhatsApp action
    if (finalLead.phone) {
      const serviceName = service ? `besoin de ${service}` : 'votre demande';
      const waMessage = encodeURIComponent(
        `Bonjour ${name}, je vous contacte concernant ${serviceName} soumise via notre site web. Quand seriez-vous disponible pour en discuter?`
      );
      const waPhone = finalLead.phone.replace(/[^0-9]/g, '');

      await supabase.from('lead_events').insert({
        lead_id: finalLead.id,
        event_type: 'whatsapp_action_ready',
        event_data: {
          phone: waPhone,
          message: decodeURIComponent(waMessage),
          whatsapp_url: `https://wa.me/${waPhone}?text=${waMessage}`,
        },
      });
    }

    // Log creation event
    await supabase.from('lead_events').insert({
      lead_id: finalLead.id,
      event_type: 'created',
      event_data: {
        connector: 'website',
        source: 'jmaxxproservices.com',
        form_id,
        form_data: { name, service, city },
      },
    });

    // If HOT, generate alert
    if (finalLead.classification === 'hot') {
      await supabase.from('lead_events').insert({
        lead_id: finalLead.id,
        event_type: 'hot_lead_detected',
        event_data: {
          score: finalLead.score,
          classification: finalLead.classification,
          connector: 'website',
          connector_type: 'website',
        },
      });

      await supabase.from('notifications').insert({
        type: 'hot_lead',
        title: 'HOT Lead from Website!',
        message: `${finalLead.title} - Score: ${finalLead.score}`,
        priority: 'high',
        data: {
          lead_id: finalLead.id,
          score: finalLead.score,
          source: 'website',
          phone: finalLead.phone,
        },
      });
    }

    // Log ingestion
    await supabase.from('ingestion_logs').insert({
      connector: 'Website Forms',
      source: 'website',
      fetched: 1,
      created: 1,
      duplicates: 0,
      hot_count: finalLead.classification === 'hot' ? 1 : 0,
      errors: null,
    });

    console.log(`[WebsiteForm] Lead created: ${finalLead.id} (${finalLead.classification}) - Score: ${finalLead.score}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Thank you for your submission! We will contact you shortly.',
        leadId: finalLead.id,
        classification: finalLead.classification,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: 'Something went wrong processing your request',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
