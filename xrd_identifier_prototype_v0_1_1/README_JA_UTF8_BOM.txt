XRD Identifier Prototype v0.1.1
================================

文字化け対策版です。

変更点:
- 日本語ファイル名をやめました。
- batファイル内の表示を英語中心にしました。
- CSVとmatch_report.txtをUTF-8 with BOMで保存するようにしました。
- Windowsのコマンドプロンプト用に PYTHONUTF8=1 / PYTHONIOENCODING=utf-8 を設定しました。

使い方:
1. このZIPをWindows PCで解凍します。
2. build_exe_windows.bat をダブルクリックします。
3. dist フォルダに XRDIdentifierPrototype.exe ができます。
4. XRDIdentifierPrototype.exe を起動します。
5. 測定データ，参照値フォルダ，出力フォルダを選んで解析します。

サンプル:
- sample_data/007_Ba3Cu2Fe24O41_1050C.TXT
- reference_db/private_import/M-type/M-type BaFe12O19 PDF 00-039-1433.txt

文字化けした場合:
- README_JA_UTF8_BOM.txt はWindowsのメモ帳で開いてください。
- CSVをExcelで開く場合は，ダブルクリックで文字化けするなら「データ > テキストまたはCSVから」でUTF-8を指定してください。
- build_exe_windows.bat の実行画面だけ文字化けする場合でも，ビルド自体は進むことがあります。

注意:
- これはRietveld解析ではありません。
- 完全な相同定ではなく，候補相と根拠ピークを出す支援ツールです。
- 今回同梱している参照値はM-typeのみです。Z-typeやCuO等は後から参照値フォルダへ追加してください。
