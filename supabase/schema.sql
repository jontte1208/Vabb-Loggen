create table if not exists children (
  id          bigint primary key generated always as identity,
  name        text    not null,
  initials    text    not null,
  age         integer,
  accent      text    not null default '#2C4A3E',
  accent_soft text    not null default '#E4ECE7',
  created_at  timestamptz default now()
);

create table if not exists entries (
  id         bigint primary key generated always as identity,
  child_id   bigint references children(id) on delete cascade,
  date       date    not null,
  extent     numeric(3,2) not null check (extent in (0.25, 0.5, 0.75, 1)),
  reason     text,
  created_at timestamptz default now()
);

create index if not exists entries_date_idx     on entries(date desc);
create index if not exists entries_child_id_idx on entries(child_id);
