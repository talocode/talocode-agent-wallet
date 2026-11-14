create table if not exists agents (
  id text primary key,
  user_id text not null,
  name text not null,
  description text not null default '',
  status text not null default 'active',
  created_at timestamptz not null default now()
);
create index if not exists agents_user_idx on agents (user_id);

create table if not exists wallets (
  id text primary key,
  user_id text not null,
  agent_id text,
  public_key text not null,
  ciphertext text not null,
  salt text not null,
  iv text not null,
  network text not null default 'solana-devnet',
  created_at timestamptz not null default now()
);
create index if not exists wallets_user_idx on wallets (user_id);

create table if not exists policies (
  id text primary key,
  user_id text not null,
  agent_id text not null,
  max_tx_lamports text not null,
  daily_lamports text not null,
  monthly_lamports text not null,
  approved_recipients text not null default '',
  allowed_tokens text not null default 'SOL',
  network text not null default 'solana-devnet',
  require_approval boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists policies_user_idx on policies (user_id);

create table if not exists transactions (
  id text primary key,
  user_id text not null,
  agent_id text not null,
  wallet_id text not null,
  recipient text not null,
  amount_lamports text not null,
  token text not null,
  network text not null,
  status text not null,
  signature text,
  idempotency_key text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists tx_idem_idx on transactions (user_id, idempotency_key);
create index if not exists tx_user_idx on transactions (user_id, created_at desc);

create table if not exists api_keys (
  id text primary key,
  user_id text not null,
  name text not null,
  key_hash text not null unique,
  prefix text not null,
  permissions text not null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists api_keys_user_idx on api_keys (user_id);

create table if not exists audit_logs (
  id text primary key,
  user_id text not null,
  action text not null,
  detail text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists audit_user_idx on audit_logs (user_id, created_at desc);
