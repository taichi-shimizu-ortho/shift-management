# 医師シフト管理システム

React + TypeScript + Supabase を使用した医師シフト管理アプリケーション。

## 機能

- **カレンダー表示**: 月単位でシフト状況を視覚的に表示
- **シフト割り当て**: 管理者が医師に当直・外勤を割り当て（管理者のみ）
- **月別集計**: 医師ごとの当直・外勤回数を自動集計
- **ロール管理**: 医師・管理者の権限制御（DB側の RLS で強制）
- **リアルタイム同期**: Supabase Realtime で管理者の変更を全員に即反映

## セットアップ

### 1. 環境変数の設定

`.env.local` ファイルを作成して、Supabase の認証情報を設定します：

```bash
cp .env.example .env.local
```

`.env.local` を編集：

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Supabase のプロジェクト設定から URL とアノンキーを取得してください。

### 2. Supabase スキーマの投入

Supabase の SQL Editor で以下を実行：

1. **テーブル作成** (以前提供されたスキーマ SQL)
2. **RLS ポリシー投入** (以前提供されたポリシー SQL)
3. **月別集計ビュー作成** (以前提供されたビュー SQL)
4. **初期管理者昇格**:
   ```sql
   update profiles set role = 'admin' where id = '自分のauth.users.id';
   ```

### 3. 依存関係のインストール

```bash
npm install
```

### 4. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで `http://localhost:5173` を開きます。

## 使い方

### 一般医師

1. メールアドレスとパスワードでログイン
2. **カレンダー**: 全医師のシフト状況を閲覧
3. **集計**: 月別の当直・外勤回数を確認

### 管理者

上記に加えて：

1. **カレンダー**: 日付セルをクリック → 医師選択 → 勤務種別選択 で割り当て
2. **医師管理** (`/admin/doctors`): 医師のロール変更・有効/無効切り替え

## 画面構成

| ページ | URL | 対象 |
|---|---|---|
| ログイン | `/login` | 全員 |
| カレンダー | `/calendar` | 認証済み |
| 集計 | `/summary` | 認証済み |
| 医師管理 | `/admin/doctors` | 管理者のみ |

## プロジェクト構造

```
src/
├── components/         # UI コンポーネント
│   ├── ProtectedRoute.tsx
│   └── ShiftBadge.tsx
├── hooks/              # Supabase データ取得フック
│   └── useShifts.ts
├── lib/                # ライブラリ
│   └── supabaseClient.ts
├── pages/              # ページコンポーネント
│   ├── Login.tsx
│   ├── Calendar.tsx
│   ├── Summary.tsx
│   └── AdminDoctors.tsx
├── store/              # Zustand 状態管理
│   └── authStore.ts
├── types.ts            # TypeScript 型定義
├── App.tsx             # ルーティング
├── main.tsx            # エントリーポイント
└── style.css           # Tailwind CSS
```

## 技術スタック

- **フロントエンド**: React 18 + TypeScript
- **ビルド**: Vite
- **スタイル**: Tailwind CSS
- **認証・DB**: Supabase (Postgres + Auth)
- **状態管理**: Zustand
- **ルーティング**: React Router v7
- **日付操作**: date-fns
- **アイコン**: Lucide React

## ビルド

```bash
npm run build
```

## ライセンス

MIT
