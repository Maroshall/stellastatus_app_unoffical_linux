# StellaStatus

**[한국어](README.md)** | [English](README.en.md) | 日本語

StellaLive メンバーのCHZZK配信状態を確認し、配信開始時にデスクトップ通知を表示するLinux向け非公式フォークです。

> このリポジトリは元プロジェクトのフォークです。  
> 元プロジェクト: https://github.com/tabiluv/stellastatus_app  
> Linux環境で使用できるようAppImageビルドとLinux対応を追加しています。Linux固有の変更を除き、元プロジェクトの機能とMITライセンスを引き継いでいます。

StellaLive公式サービスではなく、ファンによる非公式プロジェクトです。

## 機能

- CHZZK配信状態の定期確認
- 登録メンバーの配信開始時のデスクトップ通知
- 配信開始時のブラウザ自動起動（任意）
- メンバープロフィール、配信タイトル・カテゴリ・視聴者数・サムネイル表示
- StelLightのデータを利用した本日の配信予定表示
- システムトレイ、ログイン時の自動起動
- GitHub ReleasesによるLinux AppImageの更新確認・ダウンロード

## Linux対応

現在の配布対象:

- Linux x86_64 (x64)
- AppImage

## インストール

GitHub Releasesから`.AppImage`をダウンロードし、以下を実行してください。

```bash
chmod +x StellaStatus-*.AppImage
./StellaStatus-*.AppImage
```

## 開発

Node.js 24以降を推奨します。

```bash
npm ci
npm run gen-icon
npm run gen-logos
npm start
```

## ビルド

```bash
npm ci
npm run gen-icon
npm run gen-logos
npm run dist
```

AppImageは`dist/`に生成されます。

## リリース

`v*`タグをpushすると、GitHub ActionsがLinux AppImageをビルドしてGitHub Releaseへアップロードします。

```bash
git tag v1.0.7
git push origin v1.0.7
```

## ライセンス

MIT License。

元プロジェクト: https://github.com/tabiluv/stellastatus_app  
Linuxフォーク: https://github.com/Maroshall/stellastatus_app

詳細は`LICENSE`をご確認ください。
