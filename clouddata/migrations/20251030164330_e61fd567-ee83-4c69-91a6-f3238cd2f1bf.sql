-- Add coordinates to locations for route optimization
ALTER TABLE public.locations 
ADD COLUMN latitude numeric,
ADD COLUMN longitude numeric;

COMMENT ON COLUMN public.locations.latitude IS 'Latitude coordinate for route optimization';
COMMENT ON COLUMN public.locations.longitude IS 'Longitude coordinate for route optimization';