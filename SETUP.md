# 医師シフト管理システム - 完全セットアップガイド

Supabase + React + TypeScript を使用した医師シフト管理システムの構築ガイド。

---

## 📋 目次

1. [システム構成](#システム構成)
2. [Supabase スキーマ投入](#supabase-スキーマ投入)
3. [フロントエンド設定](#フロントエンド設定)
4. [初期化手順](#初期化手順)
5. [動作確認](#動作確認)

---

## 🏗️ システム構成

### 全体構成

| レイヤー | 技術 | 役割 |
|---|---|---|
| フロントエンド | React + TypeScript + Vite | カレンダーUI・集計表示 |
| 認証 | Supabase Auth | 医師ごとのログイン |
| DB | Supabase Postgres | 当直・外勤データ |
| 権限制御 | RLS (Row Level Security) | 「全員閲覧可・編集は管理者のみ」を DB レベルで強制 |
| リアルタイム | Supabase Realtime | 管理者の割り振りが各自の画面に即反映 |

### ユーザーロール

| ロール | 権限 |
|---|---|
| **医師** | ✅ 閲覧（自分・全体のシフト）/ ✅ 月別回数確認 / ❌ 編集 |
| **管理者** | ✅ 閲覧 / ✅ 編集（割り当て・削除） / ✅ 医師管理 |

---

## 🗄️ Supabase スキーマ投入

### 前提条件

- Supabase アカウント作成済み
- プロジェクト作成済み

### ステップ 1: テーブル作成

Supabase ダッシュボード → **SQL Editor** → **新規クエリ** で以下を実行：

```sql
-- 1. 医師プロフィール(auth.users と1対1)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'doctor' check (role in ('doctor', 'admin')),
  is_active boolean not null default true,
  created_at timestamptz default now()
);

-- 2. 勤務種別マスタ(当直・外勤を拡張可能に)
create table shift_types (
  id serial primary key,
  name text not null,
  color text not null default '#3b82f6',
  sort_order int default 0
);

insert into shift_types (name, color, sort_order) values
  ('当直', '#ef4444', 1),
  ('外勤', '#3b82f6', 2);

-- 3. シフト割り当て本体
create table assignments (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references profiles(id),
  shift_type_id int not null references shift_types(id),
  duty_date date not null,
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique (doctor_id, shift_type_id, duty_date)
);

create index idx_assignments_date on assignments(duty_date);
create index idx_assignments_doctor on assignments(doctor_id);
```

✅ すべて正常に実行されれば OK。

---

### ステップ 2: RLS (Row Level Security) 有効化とポリシー設定

**新規クエリ** で以下を実行：

```sql
-- RLS を有効化
alter table profiles enable row level security;
alter table assignments enable row level security;
alter table shift_types enable row level security;

-- 管理者判定用の関数(ポリシー内の再帰を避ける)
create or replace function is_admin()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ===== profiles テーブル =====
-- 閲覧:ログイン済みなら全員 OK
create policy "read_all_profiles"
  on profiles for select
  to authenticated
  using (true);

-- 編集:管理者のみ
create policy "admin_manage_profiles"
  on profiles for update
  to authenticated
  using (is_admin())
  with check (is_admin());

-- ===== assignments テーブル =====
-- 閲覧:ログイン済みなら全員 OK
create policy "read_all_assignments"
  on assignments for select
  to authenticated
  using (true);

-- 挿入・更新・削除:管理者のみ
create policy "admin_write_assignments"
  on assignments for insert
  to authenticated
  with check (is_admin());

create policy "admin_update_assignments"
  on assignments for update
  to authenticated
  using (is_admin())
  with check (is_admin());

create policy "admin_delete_assignments"
  on assignments for delete
  to authenticated
  using (is_admin());

-- ===== shift_types テーブル =====
-- 閲覧:ログイン済みなら全員 OK
create policy "read_all_shift_types"
  on shift_types for select
  to authenticated
  using (true);
```

✅ すべてのポリシーが作成されれば OK。

---

### ステップ 3: 月別集計ビュー作成

**新規クエリ** で以下を実行：

```sql
create or replace view monthly_counts as
select
  p.id as doctor_id,
  p.full_name,
  st.id as shift_type_id,
  st.name as shift_name,
  to_char(a.duty_date, 'YYYY-MM') as month,
  count(*) as cnt
from assignments a
join profiles p on p.id = a.doctor_id
join shift_types st on st.id = a.shift_type_id
group by p.id, p.full_name, st.id, st.name, to_char(a.duty_date, 'YYYY-MM');

-- ビューのアクセス権限を設定
alter view monthly_counts owner to postgres;

create policy "read_monthly_counts"
  on monthly_counts for select
  to authenticated
  using (true);
```

✅ ビューが作成されれば OK。

---

### ステップ 4: 初期管理者の昇格

**新規クエリ** で以下を実行：

#### **方法A：Authentication から ID を確認**

1. Supabase ダッシュボード → **Authentication** → **Users**
2. 自分のメールアドレスをクリック
3. **User UID** をコピー（例：`550e8400-e29b-41d4-a716-446655440000`）

#### **方法B：SQL Editor で ID を確認**

```sql
select id, email from auth.users;
```

自分のメールに対応する `id` をコピー。

#### **方法C：管理者昇格を実行**

確認した ID を使用して以下を実行：

```sql
update profiles set role = 'admin' where id = '550e8400-e29b-41d4-a716-446655440000';
```

（`550e8400-...` を自分の ID に置き換え）

✅ `Rows updated: 1` が表示されれば完璧。

#### **確認**

```sql
select id, full_name, role from profiles where role = 'admin';
```

自分の名前と `admin` ロールが表示されることを確認。

---

## 🎨 フロントエンド設定

### プロジェクト構成

```
shift-management/
├── src/
│   ├── components/
│   │   ├── ProtectedRoute.tsx      # 認証ルート保護
│   │   └── ShiftBadge.tsx          # シフト表示バッジ
│   ├── hooks/
│   │   └── useShifts.ts            # Supabase データ取得
│   ├── lib/
│   │   └── supabaseClient.ts       # Supabase クライアント
│   ├── pages/
│   │   ├── Login.tsx               # ログイン画面
│   │   ├── Calendar.tsx            # シフトカレンダー
│   │   ├── Summary.tsx             # 月別集計
│   │   └── AdminDoctors.tsx        # 医師管理（管理者のみ）
│   ├── store/
│   │   └── authStore.ts            # Zustand 認証状態
│   ├── types.ts                    # TypeScript 型定義
│   ├── App.tsx                     # ルーティング
│   ├── main.tsx                    # エントリーポイント
│   └── style.css                   # Tailwind CSS
├── .env.local                      # 環境変数（.gitignore に含まれる）
├── vite.config.ts                  # Vite 設定
├── tailwind.config.js              # Tailwind CSS 設定
└── package.json
```

### 環境変数設定

#### **Step 1: Supabase 認証情報を確認**

Supabase ダッシュボード → **Settings** → **API**

以下を確認：
- **Project URL**: `https://your-project.supabase.co`
- **Anon key** (public): `eyJhbGciOiJIUzI1NiIs...`

⚠️ **Service Role Key (secret)** は使わないこと！

#### **Step 2: .env.local を作成**

`shift-management/` ディレクトリで `.env.local` を作成：

**PowerShell:**

```powershell
cd "C:\Users\a2189\uv-envs\supabase\shift-management"

@'
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
'@ | Set-Content -Path .env.local
```

**Bash/WSL:**

```bash
cd C:\Users\a2189\uv-envs\supabase\shift-management

cat > .env.local <<'EOF'
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
EOF
```

#### **Step 3: 確認**

```powershell
type .env.local
```

正しく設定されていれば OK。（.gitignore に含まれているため、Git に上がりません）

---

## 🚀 初期化手順

### 1. Supabase に初期データを投入（オプション）

テスト用に医師を追加（Supabase Auth で新規ユーザーを作成してから以下を実行）：

```sql
insert into profiles (id, full_name, role, is_active)
values
  ('user-id-1', '田中太郎', 'doctor', true),
  ('user-id-2', '佐藤花子', 'doctor', true),
  ('user-id-3', '鈴木次郎', 'doctor', true);
```

### 2. React アプリを起動

```powershell
cd "C:\Users\a2189\uv-envs\supabase\shift-management"
npm run dev
```

ターミナルに表示される URL を開く（通常 `http://localhost:5173`）

### 3. ログイン

自分のメールアドレスとパスワードでログイン。

---

## ✅ 動作確認

### チェックリスト

- [ ] ログイン画面が表示される
- [ ] メール・パスワードでログイン可能
- [ ] ログイン後、カレンダーページに遷移
- [ ] 当月のカレンダーが表示される
- [ ] 集計ページで月別の回数が表示される（初期は 0）
- [ ] **管理者のみ**: セルクリック → 医師・勤務種別を選択できる
- [ ] **管理者のみ**: 割り当て後、カレンダーにシフトが反映される
- [ ] **管理者のみ**: /admin/doctors で医師一覧が見える
- [ ] ログアウトが機能する

### トラブルシューティング

#### エラー: `Missing Supabase credentials`

`.env.local` が正しく設定されているか確認：

```powershell
type .env.local
```

#### エラー: `relation "assignments" does not exist`

Supabase スキーマが完全に投入されているか確認：

```sql
-- SQL Editor で確認
select tablename from pg_tables where schemaname = 'public';
```

以下が表示されるべき：
- `profiles`
- `shift_types`
- `assignments`

#### ログイン後、"Loading..." のまま進まない

ブラウザの開発者ツール（F12）で Console を確認。エラーメッセージを見て対応。

---

## 📱 ページ一覧

| URL | 画面 | 対象 | 説明 |
|---|---|---|---|
| `/login` | ログイン | 全員 | メール・パスワード入力 |
| `/calendar` | カレンダー | 認証済み | 月別シフト表示・割り当て |
| `/summary` | 集計 | 認証済み | 医師ごとの月別回数 |
| `/admin/doctors` | 医師管理 | 管理者のみ | ロール変更・有効/無効切り替え |

---

## 🛠️ 今後の拡張案

### レベル 1: 基本機能 (現在のコード)

- ✅ ログイン・認証
- ✅ カレンダー表示・割り当て
- ✅ 月別集計
- ✅ 医師管理

### レベル 2: 運用効率化

- 📌 一括割り当て: CSV/Excel から月分一括投入
- 📌 希望休申請: 医師が「この日は不可」と申請
- 📌 自動配置提案: 偏りを自動検出して提案

### レベル 3: 高度な機能

- 📌 当番表エクスポート (PDF/Excel)
- 📌 メール通知: 割り当て時に医師に通知
- 📌 分析ダッシュボード: 年間の偏り、パターン分析

---

## 📚 技術スタック

| 層 | 技術 | バージョン |
|---|---|---|
| フロントエンド | React | 18+ |
| 言語 | TypeScript | ~6.0.2 |
| ビルド | Vite | ^8.0.12 |
| スタイル | Tailwind CSS | 最新 |
| 状態管理 | Zustand | ^5.0.14 |
| ルーティング | React Router | ^7.17.0 |
| 日付操作 | date-fns | ^4.4.0 |
| アイコン | Lucide React | ^1.17.0 |
| バックエンド・DB | Supabase | - |

---

## 📞 よくある質問

### Q: 医師を新規追加するには？

A: Supabase ダッシュボード → **Authentication** → **+ Create new user** で新規ユーザー作成。
自動的に `profiles` テーブルにレコード作成されるよう trigger を設定することを推奨。

### Q: パスワードをリセットしたい

A: Supabase Auth で "Reset password" 機能を提供できます。React アプリで UI を追加してください。

### Q: オフラインでも使えますか？

A: 現在のコードはオンライン前提です。オフライン対応には Service Worker / IndexedDB の追加が必要。

### Q: 本番環境にデプロイするには？

A: Vercel / Netlify に `shift-management` ディレクトリを Git push。
環境変数 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` を本番値に設定。

---

## 📄 ライセンス

MIT

---

**作成日**: 2026-06-12  
**最終更新**: 2026-06-12
