---
description: GitHub Pagesへのデプロイ手順
---
このワークフローは、作成した家計簿アプリをGitHub Pagesにデプロイして公開するための手順です。

1. **GitHubアカウントの準備**
   - GitHubアカウントを持っていない場合は、[GitHub.com](https://github.com/)で作成してください。
   - ログインした状態で、右上の「+」アイコンから「New repository」を選択します。
   - **Repository name** に `glass-dash` (または好きな名前) を入力します。
   - **Public** (公開) を選択します（PrivateだとGitHub Pagesの無料枠で公開できない場合があります）。
   - 「Create repository」ボタンをクリックします。

2. **Gitの初期設定 (初回のみ)**
   - ターミナルで以下のコマンドを実行して、Gitのユーザー名とメールアドレスを設定します（設定済みの場合はスキップ可）。
   ```bash
   git config --global user.name "あなたのGitHubユーザー名"
   git config --global user.email "あなたのメールアドレス"
   ```

3. **ローカルリポジトリの作成とコミット**
   - 以下のコマンドを順番に実行して、現在のコードをGitで管理します。
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

4. **GitHubリポジトリとの連携**
   - 手順1で作成したリポジトリのURL（`https://github.com/ユーザー名/リポジトリ名.git`）を使用します。
   - 以下のコマンドを実行します（URL部分は自分のものに置き換えてください）。
   ```bash
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/glass-dash.git
   ```

5. **GitHubへのプッシュ**
   - コードをGitHubにアップロードします。
   ```bash
   git push -u origin main
   ```

6. **デプロイの実行**
   - `gh-pages` パッケージを使って、ビルドとデプロイを行います。
   ```bash
   npm run deploy
   ```
   - 「Published」と表示されれば成功です。

7. **公開サイトの確認**
   - 数分待ってから、ブラウザで `https://YOUR_USERNAME.github.io/glass-dash/` にアクセスします。
   - サイトが表示されれば完了です！スマホのブラウザで開いて「ホーム画面に追加」を試してみてください。

**注意点**:
- `vite.config.js` の `base` 設定が `'./'` になっていることを確認してください（設定済みです）。
- 画像などのアセットが正しく読み込まれない場合は、パスを確認してください。
