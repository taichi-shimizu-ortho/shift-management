// Google のアクセストークンを発行する Edge Function。
//
// - リクエストに refresh_token が含まれていれば保存する（ログイン直後の1回だけ届く）
// - 保存済みのリフレッシュトークンを使って新しいアクセストークンを発行して返す
//
// client_secret はこの関数の環境変数にのみ存在し、ブラウザには一切渡らない。
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      return json({ error: 'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET が設定されていません。' }, 500);
    }

    // 1. 呼び出し元のユーザーを特定する
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: '認証情報がありません。' }, 401);
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return json({ error: 'ユーザーを特定できませんでした。' }, 401);
    }

    // 2. service_role でトークン表を操作する（ブラウザからは触れないテーブル）
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let incomingRefreshToken: string | null = null;
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      incomingRefreshToken = body?.refresh_token ?? null;
    }

    if (incomingRefreshToken) {
      const { error } = await adminClient
        .from('google_refresh_tokens')
        .upsert({
          user_id: user.id,
          refresh_token: incomingRefreshToken,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        return json({ error: `リフレッシュトークンの保存に失敗しました: ${error.message}` }, 500);
      }
    }

    // 3. 保存済みのリフレッシュトークンを取り出す
    const { data: stored } = await adminClient
      .from('google_refresh_tokens')
      .select('refresh_token')
      .eq('user_id', user.id)
      .maybeSingle();

    const refreshToken = stored?.refresh_token;
    if (!refreshToken) {
      return json(
        { error: 'Googleのリフレッシュトークンが未登録です。一度ログアウトしてGoogleログインし直してください。' },
        404
      );
    }

    // 4. Google に新しいアクセストークンを要求する
    const googleResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const googleData = await googleResponse.json();

    if (!googleResponse.ok) {
      // 失効・取り消し済みの場合は保存分を消して、次回ログインで取り直させる
      if (googleData?.error === 'invalid_grant') {
        await adminClient.from('google_refresh_tokens').delete().eq('user_id', user.id);
        return json(
          { error: 'Googleの連携が無効になっています。一度ログアウトしてGoogleログインし直してください。' },
          401
        );
      }
      return json({ error: `Googleのトークン更新に失敗しました: ${googleData?.error ?? googleResponse.status}` }, 502);
    }

    return json({
      access_token: googleData.access_token,
      expires_in: googleData.expires_in,
    });
  } catch (err) {
    return json({ error: `想定外のエラー: ${err instanceof Error ? err.message : String(err)}` }, 500);
  }
});
