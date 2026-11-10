import { useState } from 'react';
import {
  Box,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
} from '@mui/material';
import CodeIcon from '@mui/icons-material/Code';
import TableChartIcon from '@mui/icons-material/TableChart';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';

// Human-friendly field labels mapping for Sổ đỏ & Land documents
const FIELD_LABELS = {
  so_to: 'Số tờ bản đồ',
  so_thua: 'Số thửa đất',
  dia_chi: 'Địa chỉ thửa đất',
  dien_tich: 'Diện tích (m²)',
  chieu_rong: 'Chiều rộng (mặt tiền)',
  chieu_dai: 'Chiều dài (chiều sâu)',
  truc_duong_tiep_giap: 'Trục đường tiếp giáp',
  muc_dich_su_dung: 'Mục đích sử dụng đất',
  thoi_han_su_dung: 'Thời hạn sử dụng',
  cong_trinh_tren_dat: 'Công trình trên đất',
  ngay_cap: 'Ngày cấp GCN',
  ghi_chu: 'Ghi chú phê duyệt',
  noi_dung_thay_doi_sau_ngay_cap: 'Nội dung thay đổi sau ngày cấp',
};

/**
 * Syntax highlighter for multi-line JSON
 */
function syntaxHighlightJson(jsonString) {
  if (!jsonString) return '';
  const escaped = jsonString
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = '#10B981'; // string - green
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = '#0284C7'; // key - blue
          return `<span style="color: ${cls}; font-weight: 600;">${match}</span>`;
        }
      } else if (/true|false/.test(match)) {
        cls = '#F59E0B'; // boolean - orange
      } else if (/null/.test(match)) {
        cls = '#9CA3AF'; // null - gray
      } else {
        cls = '#8B5CF6'; // number - purple
      }
      return `<span style="color: ${cls};">${match}</span>`;
    }
  );
}

export default function JsonViewer({ data, onCopy, title = 'Kết quả trích xuất' }) {
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'json'

  // Ensure data is properly parsed as an object, not a raw string
  const parsedData = (() => {
    if (!data) return null;
    if (typeof data === 'object') return data;
    try {
      let res = JSON.parse(data);
      if (typeof res === 'string') {
        res = JSON.parse(res);
      }
      return res;
    } catch {
      return data;
    }
  })();

  if (!parsedData) {
    return (
      <Box sx={{ p: 4, textAlign: 'center', color: '#6B7280' }}>
        <Typography variant="body2">Chưa có dữ liệu trích xuất.</Typography>
      </Box>
    );
  }

  // Filter out internal citation and metadata keys for clean human-readable table
  const displayEntries = Object.entries(parsedData).filter(
    ([key]) => !key.endsWith('_citations') && !key.endsWith('_meta')
  );

  const formattedJsonString = JSON.stringify(parsedData, null, 2);

  const handleDownload = () => {
    const blob = new Blob([formattedJsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extracted_data_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Action Header Bar */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1,
          pb: 1,
          borderBottom: '1px solid #E5E7EB',
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#111827' }}>
          {title}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* View Mode Toggle: Dạng Bảng vs Dạng JSON */}
          <ToggleButtonGroup
            size="small"
            value={viewMode}
            exclusive
            onChange={(_, val) => val && setViewMode(val)}
            sx={{ height: 28 }}
          >
            <ToggleButton value="table" sx={{ textTransform: 'none', px: 1.2, py: 0, fontSize: '0.75rem', fontWeight: 500 }}>
              <TableChartIcon sx={{ fontSize: 14, mr: 0.5 }} /> Dạng bảng
            </ToggleButton>
            <ToggleButton value="json" sx={{ textTransform: 'none', px: 1.2, py: 0, fontSize: '0.75rem', fontWeight: 500 }}>
              <CodeIcon sx={{ fontSize: 14, mr: 0.5 }} /> JSON Code
            </ToggleButton>
          </ToggleButtonGroup>

          <Button
            size="small"
            variant="outlined"
            startIcon={<ContentCopyIcon sx={{ fontSize: 13 }} />}
            onClick={() => onCopy?.(formattedJsonString)}
            sx={{
              height: 28,
              fontSize: '0.75rem',
              textTransform: 'none',
              color: '#374151',
              borderColor: '#D1D5DB',
              px: 1.2,
            }}
          >
            Copy JSON
          </Button>

          <Button
            size="small"
            variant="outlined"
            startIcon={<DownloadIcon sx={{ fontSize: 13 }} />}
            onClick={handleDownload}
            sx={{
              height: 28,
              fontSize: '0.75rem',
              textTransform: 'none',
              color: '#374151',
              borderColor: '#D1D5DB',
              px: 1.2,
            }}
          >
            Tải .json
          </Button>
        </Box>
      </Box>

      {/* VIEW 1: DẠNG BẢNG RÕ RÀNG, DỄ ĐỌC */}
      {viewMode === 'table' ? (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5, borderColor: '#E5E7EB' }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: '#F9FAFB' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, width: '32%', color: '#374151', py: 1 }}>
                  Thông tin trích xuất
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#374151', py: 1 }}>
                  Giá trị nhận diện được
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayEntries.map(([key, value]) => {
                const label = FIELD_LABELS[key] || key;
                return (
                  <TableRow key={key} sx={{ '&:hover': { bgcolor: '#F9FAFB' } }}>
                    <TableCell sx={{ py: 1, verticalAlign: 'top' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#111827', fontSize: '0.8rem' }}>
                        {label}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#6B7280', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                        {key}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1, verticalAlign: 'top' }}>
                      {value == null || value === '' ? (
                        <Typography variant="body2" sx={{ color: '#9CA3AF', fontStyle: 'italic', fontSize: '0.8rem' }}>
                          (Không có)
                        </Typography>
                      ) : typeof value === 'object' ? (
                        <Box
                          component="pre"
                          sx={{
                            m: 0,
                            p: 1,
                            bgcolor: '#F3F4F6',
                            borderRadius: 1,
                            fontSize: '0.75rem',
                            fontFamily: 'monospace',
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {JSON.stringify(value, null, 2)}
                        </Box>
                      ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography variant="body2" sx={{ color: '#111827', fontSize: '0.85rem', fontWeight: 500 }}>
                            {String(value)}
                          </Typography>
                          {key === 'dien_tich' && typeof value === 'number' && (
                            <Chip label="m²" size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
                          )}
                        </Box>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        /* VIEW 2: DẠNG JSON MULTI-LINE CÓ MÀU SẮC ĐẸP MẮT */
        <Box
          component="pre"
          sx={{
            m: 0,
            p: 2,
            bgcolor: '#0F172A',
            color: '#F8FAFC',
            borderRadius: 1.5,
            fontSize: '0.8rem',
            lineHeight: 1.6,
            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: 560,
          }}
          dangerouslySetInnerHTML={{
            __html: syntaxHighlightJson(formattedJsonString),
          }}
        />
      )}
    </Box>
  );
}

