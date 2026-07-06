# JMAXX Lead Intelligence - Production Deployment Guide

## 1. Application Status

**Build Status:** READY
- Build output: `dist/` folder (522KB JS, 29KB CSS)
- All dependencies installed
- Supabase connection configured

**Supabase Project:** CONNECTED
- URL: `https://ffnehjvnbdayzlwxttjh.supabase.co`
- Region: Auto-assigned
- Edge Functions: 1 deployed (`website-form`)
- Database Tables: 17 tables with RLS enabled

---

## 2. Connect to Your Existing Supabase Project

Your application is **already connected** to the Supabase project. The credentials are in `.env`:

```
VITE_SUPABASE_URL=https://ffnehjvnbdayzlwxttjh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Database Schema Status:**
| Table | Rows | RLS |
|-------|------|-----|
| leads | 16 | ON |
| lead_events | 13 | ON |
| scoring_rules | 31 | ON |
| scheduler_jobs | 5 | ON |
| system_health | 5 | ON |
| notifications | 0 | ON |
| ingestion_logs | 0 | ON |

**No additional configuration needed** - the connection is live.

---

## 3. Authentication Configuration

### Current State
The application currently operates in **single-tenant mode** (no login required). This is configured correctly for your use case:
- All RLS policies allow anonymous access
- Data is shared (no user_id columns)
- Direct access without authentication

### If You Need Authentication Later
To add authentication (sign-in/sign-up), follow these steps:

1. **Enable Supabase Auth** (Dashboard > Authentication > Providers)
   - Email/Password (enabled by default)
   - Disable email confirmation (not needed for internal tool)

2. **Create Auth Context** (frontend):
```typescript
// src/contexts/AuthContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

3. **Wrap App with AuthProvider**
4. **Add Protected Routes**
5. **Update RLS Policies** to use `auth.uid()` instead of anonymous access

**Recommendation:** Keep single-tenant mode for now since this is an internal CRM.

---

## 4. Shopify Contact/Calculator Form Integration

### Your Webhook Endpoint
```
POST https://ffnehjvnbdayzlwxttjh.supabase.co/functions/v1/website-form
Content-Type: application/json
```

### Required Fields
| Field | Required | Description |
|-------|----------|-------------|
| name | YES | Contact name |
| phone | YES | Swiss phone number |
| city | YES | City name |
| email | NO | Email address |
| service | NO | Service type |
| message | NO | Inquiry details |

### Shopify Integration Methods

#### Method A: Shopify Form Redirect (Easiest)
Add this to your Shopify contact form:

```html
<!-- In your Shopify theme.liquid or contact form section -->
<form id="jmaxx-contact-form" action="https://ffnehjvnbdayzlwxttjh.supabase.co/functions/v1/website-form" method="POST">
  <input type="hidden" name="form_type" value="contact">
  
  <label>Name (required)</label>
  <input type="text" name="name" required>
  
  <label>Phone (required)</label>
  <input type="tel" name="phone" required placeholder="079 123 45 67">
  
  <label>Email</label>
  <input type="email" name="email">
  
  <label>City (required)</label>
  <input type="text" name="city" required>
  
  <label>Service</label>
  <select name="service">
    <option value="">Select a service</option>
    <option value="Nettoyage">Nettoyage</option>
    <option value="Demenagement">Demenagement</option>
    <option value="Services generaux">Services generaux</option>
  </select>
  
  <label>Message</label>
  <textarea name="message"></textarea>
  
  <button type="submit">Envoyer</button>
</form>
```

#### Method B: JavaScript Fetch (Recommended)
Add this script to your Shopify theme:

```html
<!-- Add to theme.liquid before </body> -->
<script>
document.addEventListener('DOMContentLoaded', function() {
  // Find your existing Shopify form
  const form = document.querySelector('form[action*="contact"]');
  
  if (form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const formData = new FormData(form);
      
      // Map Shopify form fields to webhook fields
      const payload = {
        name: formData.get('contact[name]') || formData.get('name'),
        phone: formData.get('contact[phone]') || formData.get('phone'),
        email: formData.get('contact[email]') || formData.get('email'),
        city: formData.get('contact[city]') || 'Not specified',
        service: formData.get('contact[service]') || formData.get('service'),
        message: formData.get('contact[message]') || formData.get('message')
      };
      
      try {
        const response = await fetch(
          'https://ffnehjvnbdayzlwxttjh.supabase.co/functions/v1/website-form',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          }
        );
        
        const result = await response.json();
        
        if (result.success) {
          alert('Merci! Nous vous contacterons bientot.');
          form.reset();
        } else {
          alert('Erreur: ' + (result.message || 'Veuillez reessayer.'));
        }
      } catch (error) {
        alert('Erreur de connexion. Veuillez reessayer.');
        console.error('Form submission error:', error);
      }
    });
  }
});
</script>
```

#### Method C: Calculator Quote Form
For your calculator quote requests:

```html
<script>
// After calculator shows quote, attach lead capture
function submitQuoteRequest(quoteData) {
  const payload = {
    name: quoteData.customerName,
    phone: quoteData.customerPhone,
    email: quoteData.customerEmail,
    city: quoteData.customerCity,
    service: quoteData.serviceType,
    message: `Quote request from calculator: ${quoteData.quotePrice} CHF`
  };
  
  fetch('https://ffnehjvnbdayzlwxttjh.supabase.co/functions/v1/website-form', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(response => response.json())
    .then(result => {
      if (result.success) {
        console.log('Lead created:', result.leadId);
      }
    });
}
</script>
```

### Phone Number Handling
The webhook automatically normalizes Swiss phone numbers:
| Input | Output |
|-------|--------|
| `079 123 45 67` | `+41791234567` |
| `0041 79 123 45 67` | `+41791234567` |
| `+41 79 123 45 67` | `+41791234567` |

---

## 5. Testing the First Real Lead

### Test via cURL
```bash
curl -X POST \
  https://ffnehjvnbdayzlwxttjh.supabase.co/functions/v1/website-form \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jean Dupont",
    "phone": "079 123 45 67",
    "email": "jean.dupont@example.com",
    "city": "Lausanne",
    "service": "Nettoyage professionnel",
    "message": "Je souhaite un devis pour un nettoyage complet de mon appartement."
  }'
```

### Expected Response
```json
{
  "success": true,
  "message": "Thank you for your submission! We will contact you shortly.",
  "leadId": "uuid-here",
  "classification": "medium"
}
```

### Verify in Dashboard
1. Open the application
2. Go to **Operations** (/operations)
3. The new lead should appear at the top
4. Check **Leads** (/leads) for the full list
5. View lead details to see:
   - Normalized phone number
   - Classification score
   - WhatsApp quick action link

### Pipeline Flow Verification
| Step | Where to Check |
|------|---------------|
| Form received | Edge function logs (Supabase Dashboard > Edge Functions > Logs) |
| Lead created | Database > leads table |
| Phone normalized | Lead details - phone field |
| Scored | Lead details - score field (0-100) |
| Classified | Lead details - classification (hot/high/medium/low) |
| HOT alert (if score >= 80) | Notifications, lead_events table |
| WhatsApp action | lead_events for the lead |

---

## 6. Daily Access from Your Browser

### Current Access
The application runs in development mode on your local machine. For production access, deploy it.

### Access After Deployment
Once deployed, access your app at:
- **Production URL:** `https://crm.jmaxxproservices.com`
- **Supabase Dashboard:** `https://supabase.com/dashboard/project/ffnehjvnbdayzlwxttjh`
- **Metrics:** Dashboard > Analytics

### Daily Routine
1. **Open the CRM:** `https://crm.jmaxxproservices.com`
2. **Check Dashboard** (/) for:
   - New leads count
   - HOT leads (red alert box)
   - Revenue overview
3. **Review Operations** (/operations) for:
   - Today's leads
   - Priority order
   - Quick actions
4. **Process Leads:**
   - Click lead to view details
   - Use WhatsApp button to contact
   - Update status after contact
   - Add notes
5. **Check Analytics** (/analytics) weekly for:
   - Conversion rates
   - Revenue by source
   - Lead sources

### Mobile Access
The app is responsive and works on mobile browsers. Add to home screen:
1. Open `https://crm.jmaxxproservices.com` in mobile browser
2. Tap "Add to Home Screen"
3. Access as an app icon

---

## 7. Deploy to crm.jmaxxproservices.com

### Option A: Vercel (Recommended - Free)

1. **Install Vercel CLI:**
```bash
npm i -g vercel
```

2. **Deploy:**
```bash
vercel --prod
```

3. **Configure Custom Domain:**
   - Go to Vercel Dashboard > Settings > Domains
   - Add `crm.jmaxxproservices.com`
   - Vercel will provide DNS records to add to your domain

4. **DNS Configuration:**
```
crm.jmaxxproservices.com -> CNAME -> cname.vercel-dns.com
```

### Option B: Netlify (Free)

1. **Create netlify.toml:**
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

2. **Deploy via CLI:**
```bash
npm i -g netlify-cli
netlify deploy --prod
```

3. **Configure Domain:**
   - Netlify Dashboard > Domain settings
   - Add custom domain
   - Update DNS records

### Option C: Supabase Hosting

Supabase does not host frontend apps directly. Use Vercel or Netlify.

### Environment Variables
On your hosting platform, add:
```
VITE_SUPABASE_URL=https://ffnehjvnbdayzlwxttjh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmbmVoanZuYmRheXpsd3h0dGpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMTIzMDQsImV4cCI6MjA5ODU4ODMwNH0.oxQfTJ16lUTQ5s7vQzjh3Dopq-3lAx2cvyySeCFbzLg
```

---

## Quick Reference

### URLs
| Service | URL |
|---------|-----|
| **App (local)** | http://localhost:5173 |
| **App (prod)** | https://crm.jmaxxproservices.com |
| **Webhook** | POST https://ffnehjvnbdayzlwxttjh.supabase.co/functions/v1/website-form |
| **Supabase Dashboard** | https://supabase.com/dashboard/project/ffnehjvnbdayzlwxttjh |

### Pages
| Route | Description |
|-------|-------------|
| `/` | Dashboard - Overview |
| `/operations` | Operations - Today's priorities |
| `/leads` | All leads list |
| `/leads/:id` | Lead details |
| `/pipeline` | Kanban board |
| `/validation` | System health check |
| `/analytics` | Revenue metrics |
| `/website-integration` | Integration docs |

### Validation
Run `/validation` page to check:
- Database connectivity
- Webhook endpoint
- All tables
- Scoring rules
- Notifications setup

---

## Next Steps

1. [ ] Deploy to Vercel/Netlify with environment variables
2. [ ] Configure DNS for crm.jmaxxproservices.com
3. [ ] Add form integration to Shopify site
4. [ ] Submit test lead via webhook
5. [ ] Verify lead appears in dashboard
6. [ ] Test WhatsApp quick action
7. [ ] Bookmark CRM URL for daily use

---

## Support

**Edge Function Logs:** Supabase Dashboard > Edge Functions > website-form > Logs  
**Database Logs:** Supabase Dashboard > Logs > Postgres  
**Build Errors:** Check `npm run build` output  
**Runtime Errors:** Use browser developer console (F12)
