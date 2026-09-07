// Google アカウントの表示名は「清水太一(taichi8)」のようにIDが併記されていることがある。
// カレンダーのバッジは横幅が狭いので、末尾の括弧書きを落として名前だけを取り出す。
// 全角・半角どちらの括弧にも対応する。
export function cleanDisplayName(name: string): string {
  const stripped = name.replace(/\s*[(（][^)）]*[)）]\s*$/, '').trim();

  // 括弧を外した結果が空になる場合（名前全体が括弧書きだった等）は元の値を使う
  return stripped || name;
}
