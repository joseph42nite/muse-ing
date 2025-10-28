CREATE TYPE user_role AS ENUM ('promoter', 'venue', 'admin');

CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  role user_role NOT NULL,
  promoter_code TEXT UNIQUE, -- chosen by promoter
  created_at TIMESTAMPTZ DEFAULT now()
);


CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  date TIMESTAMPTZ NOT NULL,
  venue_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE CASCADE,
  ticket_price NUMERIC(10,2) NOT NULL,
  total_bookings INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);



CREATE TABLE audience_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  promoter_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  num_people INTEGER NOT NULL CHECK (num_people > 0),
  total_amount NUMERIC(10,2) NOT NULL,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  payment_status TEXT CHECK (payment_status IN ('pending', 'paid', 'failed', 'cancelled', 'refunded')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);



CREATE TABLE venue_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  audience_phone TEXT NOT NULL,
  checked_in BOOLEAN DEFAULT FALSE,
  checkin_time TIMESTAMPTZ,
  verified_by UUID REFERENCES users(id) ON DELETE SET NULL
);



CREATE TABLE razorpay_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES audience_bookings(id) ON DELETE CASCADE,
  razorpay_event TEXT NOT NULL, -- e.g. payment.captured, refund.processed
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);



CREATE TYPE refund_status AS ENUM ('pending', 'approved', 'rejected', 'refunded');

CREATE TABLE refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES audience_bookings(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  reason TEXT,
  status refund_status DEFAULT 'pending',
  admin_notes TEXT,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
