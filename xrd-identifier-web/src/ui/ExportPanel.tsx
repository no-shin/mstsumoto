/** CSV / レポートのダウンロード */

import type { AnalysisResult } from '../core/types';
import { peakListCsv, resultTableCsv, unmatchedPeaksCsv } from '../core/export/csv';
import { buildReport } from '../core/export/report';
import { downloadText } from '../plot/exportImage';

interface Props {
  result: AnalysisResult;
}

export function ExportPanel({ result }: Props) {
  const name = result.sampleName;
  return (
    <div className="panel">
      <h2>レポート出力</h2>
      <div className="row">
        <button onClick={() => downloadText(buildReport(result), `${name}_match_report.txt`)}>
          match_report.txt
        </button>
        <button
          onClick={() => downloadText(resultTableCsv(result), `${name}_result_table.csv`, 'text/csv')}
        >
          result_table.csv
        </button>
        <button
          onClick={() => downloadText(peakListCsv(result), `${name}_peak_list.csv`, 'text/csv')}
        >
          peak_list.csv
        </button>
        <button
          onClick={() =>
            downloadText(unmatchedPeaksCsv(result), `${name}_unmatched_peaks.csv`, 'text/csv')
          }
        >
          unmatched_peaks.csv
        </button>
      </div>
    </div>
  );
}
