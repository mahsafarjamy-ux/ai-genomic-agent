-- Private server-only schema. No Supabase client Data API access.

CREATE SCHEMA IF NOT EXISTS bioverse_private AUTHORIZATION postgres;

REVOKE ALL ON SCHEMA bioverse_private FROM PUBLIC, anon, authenticated;


CREATE TABLE IF NOT EXISTS bioverse_private.counselling_consultants (
	id VARCHAR NOT NULL,
	email VARCHAR(255) NOT NULL,
	name VARCHAR(255) NOT NULL,
	credentials VARCHAR(500) NOT NULL,
	bio TEXT NOT NULL,
	timezone VARCHAR(100) NOT NULL,
	duration_minutes INTEGER NOT NULL,
	price_cents INTEGER NOT NULL,
	currency VARCHAR(3) NOT NULL,
	active BOOLEAN NOT NULL,
	revision INTEGER NOT NULL,
	PRIMARY KEY (id),
	UNIQUE (email)
)

;

ALTER TABLE bioverse_private."counselling_consultants" OWNER TO postgres;

ALTER TABLE bioverse_private."counselling_consultants" ENABLE ROW LEVEL SECURITY;


CREATE TABLE IF NOT EXISTS bioverse_private.flow_gate_templates (
	id VARCHAR NOT NULL,
	name VARCHAR NOT NULL,
	description TEXT NOT NULL,
	definition_json JSON NOT NULL,
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
	PRIMARY KEY (id)
)

;

ALTER TABLE bioverse_private."flow_gate_templates" OWNER TO postgres;

ALTER TABLE bioverse_private."flow_gate_templates" ENABLE ROW LEVEL SECURITY;


CREATE TABLE IF NOT EXISTS bioverse_private.flow_projects (
	id VARCHAR NOT NULL,
	name VARCHAR NOT NULL,
	description TEXT NOT NULL,
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
	PRIMARY KEY (id)
)

;

ALTER TABLE bioverse_private."flow_projects" OWNER TO postgres;

ALTER TABLE bioverse_private."flow_projects" ENABLE ROW LEVEL SECURITY;


CREATE TABLE IF NOT EXISTS bioverse_private.users (
	id VARCHAR NOT NULL,
	email VARCHAR(255) NOT NULL,
	name VARCHAR(255) NOT NULL,
	password_hash VARCHAR(255) NOT NULL,
	token VARCHAR(64),
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
	plan VARCHAR(50) NOT NULL,
	stripe_customer_id VARCHAR(100),
	license_key VARCHAR(64),
	PRIMARY KEY (id),
	UNIQUE (email),
	UNIQUE (token)
)

;

ALTER TABLE bioverse_private."users" OWNER TO postgres;

ALTER TABLE bioverse_private."users" ENABLE ROW LEVEL SECURITY;


CREATE TABLE IF NOT EXISTS bioverse_private.counselling_consents (
	id VARCHAR NOT NULL,
	user_id VARCHAR NOT NULL,
	version VARCHAR(100) NOT NULL,
	text TEXT NOT NULL,
	accepted_at INTEGER NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(user_id) REFERENCES bioverse_private.users (id)
)

;

CREATE INDEX IF NOT EXISTS ix_bioverse_private_counselling_consents_user_id ON bioverse_private.counselling_consents (user_id);

ALTER TABLE bioverse_private."counselling_consents" OWNER TO postgres;

ALTER TABLE bioverse_private."counselling_consents" ENABLE ROW LEVEL SECURITY;


CREATE TABLE IF NOT EXISTS bioverse_private.counselling_profiles (
	user_id VARCHAR NOT NULL,
	verified_email VARCHAR(255),
	code_hash VARCHAR(255),
	code_expires INTEGER NOT NULL,
	sent_at INTEGER NOT NULL,
	attempts INTEGER NOT NULL,
	PRIMARY KEY (user_id),
	FOREIGN KEY(user_id) REFERENCES bioverse_private.users (id)
)

;

ALTER TABLE bioverse_private."counselling_profiles" OWNER TO postgres;

ALTER TABLE bioverse_private."counselling_profiles" ENABLE ROW LEVEL SECURITY;


CREATE TABLE IF NOT EXISTS bioverse_private.counselling_referrals (
	id VARCHAR NOT NULL,
	user_id VARCHAR NOT NULL,
	referrer_name VARCHAR(255) NOT NULL,
	referrer_email VARCHAR(255) NOT NULL,
	reference VARCHAR(500) NOT NULL,
	created_at INTEGER NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(user_id) REFERENCES bioverse_private.users (id)
)

;

CREATE INDEX IF NOT EXISTS ix_bioverse_private_counselling_referrals_user_id ON bioverse_private.counselling_referrals (user_id);

ALTER TABLE bioverse_private."counselling_referrals" OWNER TO postgres;

ALTER TABLE bioverse_private."counselling_referrals" ENABLE ROW LEVEL SECURITY;


CREATE TABLE IF NOT EXISTS bioverse_private.counselling_slots (
	id VARCHAR NOT NULL,
	consultant_id VARCHAR NOT NULL,
	starts_at INTEGER NOT NULL,
	ends_at INTEGER NOT NULL,
	booking_id VARCHAR,
	PRIMARY KEY (id),
	UNIQUE (booking_id),
	FOREIGN KEY(consultant_id) REFERENCES bioverse_private.counselling_consultants (id)
)

;

CREATE INDEX IF NOT EXISTS ix_bioverse_private_counselling_slots_starts_at ON bioverse_private.counselling_slots (starts_at);

CREATE INDEX IF NOT EXISTS ix_bioverse_private_counselling_slots_consultant_id ON bioverse_private.counselling_slots (consultant_id);

ALTER TABLE bioverse_private."counselling_slots" OWNER TO postgres;

ALTER TABLE bioverse_private."counselling_slots" ENABLE ROW LEVEL SECURITY;


CREATE TABLE IF NOT EXISTS bioverse_private.device_activations (
	id VARCHAR NOT NULL,
	user_id VARCHAR NOT NULL,
	device_id VARCHAR(128) NOT NULL,
	device_label VARCHAR(255) NOT NULL,
	activated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(user_id) REFERENCES bioverse_private.users (id)
)

;

ALTER TABLE bioverse_private."device_activations" OWNER TO postgres;

ALTER TABLE bioverse_private."device_activations" ENABLE ROW LEVEL SECURITY;


CREATE TABLE IF NOT EXISTS bioverse_private.flow_samples (
	id VARCHAR NOT NULL,
	project_id VARCHAR NOT NULL,
	name VARCHAR NOT NULL,
	group_label VARCHAR NOT NULL,
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(project_id) REFERENCES bioverse_private.flow_projects (id)
)

;

ALTER TABLE bioverse_private."flow_samples" OWNER TO postgres;

ALTER TABLE bioverse_private."flow_samples" ENABLE ROW LEVEL SECURITY;


CREATE TABLE IF NOT EXISTS bioverse_private.counselling_bookings (
	id VARCHAR NOT NULL,
	user_id VARCHAR NOT NULL,
	slot_id VARCHAR NOT NULL,
	consent_id VARCHAR NOT NULL,
	status VARCHAR(40) NOT NULL,
	price_cents INTEGER NOT NULL,
	currency VARCHAR(3) NOT NULL,
	created_at INTEGER NOT NULL,
	stripe_session_id VARCHAR(255),
	checkout_url TEXT,
	expires_at INTEGER NOT NULL,
	PRIMARY KEY (id),
	UNIQUE (stripe_session_id),
	FOREIGN KEY(slot_id) REFERENCES bioverse_private.counselling_slots (id),
	FOREIGN KEY(consent_id) REFERENCES bioverse_private.counselling_consents (id),
	FOREIGN KEY(user_id) REFERENCES bioverse_private.users (id)
)

;

CREATE INDEX IF NOT EXISTS ix_bioverse_private_counselling_bookings_user_id ON bioverse_private.counselling_bookings (user_id);

ALTER TABLE bioverse_private."counselling_bookings" OWNER TO postgres;

ALTER TABLE bioverse_private."counselling_bookings" ENABLE ROW LEVEL SECURITY;


CREATE TABLE IF NOT EXISTS bioverse_private.flow_files (
	id VARCHAR NOT NULL,
	sample_id VARCHAR NOT NULL,
	filename VARCHAR NOT NULL,
	file_path VARCHAR NOT NULL,
	fcs_version VARCHAR NOT NULL,
	cytometer VARCHAR NOT NULL,
	acquisition_date VARCHAR NOT NULL,
	event_count INTEGER NOT NULL,
	channel_count INTEGER NOT NULL,
	metadata_json JSON NOT NULL,
	compensation_json JSON,
	uploaded_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(sample_id) REFERENCES bioverse_private.flow_samples (id)
)

;

ALTER TABLE bioverse_private."flow_files" OWNER TO postgres;

ALTER TABLE bioverse_private."flow_files" ENABLE ROW LEVEL SECURITY;


CREATE TABLE IF NOT EXISTS bioverse_private.flow_gates (
	id VARCHAR NOT NULL,
	file_id VARCHAR NOT NULL,
	parent_gate_id VARCHAR,
	name VARCHAR NOT NULL,
	gate_type VARCHAR NOT NULL,
	x_channel VARCHAR NOT NULL,
	y_channel VARCHAR NOT NULL,
	definition_json JSON NOT NULL,
	transform_json JSON NOT NULL,
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(parent_gate_id) REFERENCES bioverse_private.flow_gates (id),
	FOREIGN KEY(file_id) REFERENCES bioverse_private.flow_files (id)
)

;

ALTER TABLE bioverse_private."flow_gates" OWNER TO postgres;

ALTER TABLE bioverse_private."flow_gates" ENABLE ROW LEVEL SECURITY;


CREATE TABLE IF NOT EXISTS bioverse_private.flow_reports (
	id VARCHAR NOT NULL,
	project_id VARCHAR,
	file_id VARCHAR,
	report_type VARCHAR NOT NULL,
	format VARCHAR NOT NULL,
	file_path VARCHAR NOT NULL,
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(file_id) REFERENCES bioverse_private.flow_files (id),
	FOREIGN KEY(project_id) REFERENCES bioverse_private.flow_projects (id)
)

;

ALTER TABLE bioverse_private."flow_reports" OWNER TO postgres;

ALTER TABLE bioverse_private."flow_reports" ENABLE ROW LEVEL SECURITY;


CREATE TABLE IF NOT EXISTS bioverse_private.flow_results (
	id VARCHAR NOT NULL,
	file_id VARCHAR NOT NULL,
	gate_id VARCHAR NOT NULL,
	count INTEGER NOT NULL,
	percent_of_parent FLOAT NOT NULL,
	percent_of_total FLOAT NOT NULL,
	computed_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(gate_id) REFERENCES bioverse_private.flow_gates (id),
	FOREIGN KEY(file_id) REFERENCES bioverse_private.flow_files (id)
)

;

ALTER TABLE bioverse_private."flow_results" OWNER TO postgres;

ALTER TABLE bioverse_private."flow_results" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA bioverse_private FROM PUBLIC, anon, authenticated;

REVOKE ALL ON ALL SEQUENCES IN SCHEMA bioverse_private FROM PUBLIC, anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA bioverse_private REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
