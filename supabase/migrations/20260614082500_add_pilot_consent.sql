-- Migration: Add consent auditing columns to public.pilot_applications
ALTER TABLE public.pilot_applications 
ADD COLUMN IF NOT EXISTS consent_granted boolean DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS consent_timestamp timestamp with time zone,
ADD COLUMN IF NOT EXISTS consent_ip text;

-- Add comment explaining columns for privacy audits
COMMENT ON COLUMN public.pilot_applications.consent_granted IS 'Explicit user consent check status at signup';
COMMENT ON COLUMN public.pilot_applications.consent_timestamp IS 'Timestamp of when explicit consent was granted';
COMMENT ON COLUMN public.pilot_applications.consent_ip IS 'IP address from which explicit consent was recorded';
