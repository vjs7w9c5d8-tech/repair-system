-- 在同一交易中建立資料表與存取規則，讓它們一併生效。
begin;

-- 建立報修資料表。識別碼與建立時間由資料庫產生。
create table public.repair_requests (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    reporter_name text not null,
    location text not null,
    category text not null,
    description text not null,
    urgency text not null default '中',
    status text not null default '待處理',

    -- CHECK：文字須含非空白字元。上限依序為姓名 80、地點 120、說明 2,000 字元。
    constraint repair_requests_reporter_name_check
        check (char_length(reporter_name) between 1 and 80 and reporter_name ~ '[^[:space:]]'),
    constraint repair_requests_location_check
        check (char_length(location) between 1 and 120 and location ~ '[^[:space:]]'),
    constraint repair_requests_description_check
        check (char_length(description) between 1 and 2000 and description ~ '[^[:space:]]'),

    -- CHECK：類別、緊急程度與處理狀態只能使用下列選項。
    constraint repair_requests_category_check
        check (category in ('設備', '網路', '環境', '其他')),
    constraint repair_requests_urgency_check
        check (urgency in ('低', '中', '高')),
    constraint repair_requests_status_check
        check (status in ('待處理', '處理中', '已完成'))
);

-- GRANT：清除 API 角色及 PUBLIC 在此表的預設授權，再只開放 anon 讀取。
revoke all privileges on table public.repair_requests from public, anon, authenticated, service_role;
grant select on table public.repair_requests to anon;

-- GRANT：anon 只能新增表單欄位，可省略緊急程度以採用預設值。
-- 識別碼、建立時間及初始狀態由資料庫填入。此處不授予修改或刪除權限。
grant insert (reporter_name, location, category, description, urgency)
    on table public.repair_requests to anon;

-- RLS：所有使用 anon 角色的訪客都可讀取整份清單。
alter table public.repair_requests enable row level security;

create policy repair_requests_anon_select
    on public.repair_requests
    for select
    to anon
    using (true);

-- RLS：新增後的資料列必須為「待處理」。此處不建立修改或刪除政策。
create policy repair_requests_anon_insert
    on public.repair_requests
    for insert
    to anon
    with check (status = '待處理');

-- 建表、約束、授權與政策一併提交。
commit;
