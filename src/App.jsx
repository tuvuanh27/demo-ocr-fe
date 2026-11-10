import { useState, useRef, useMemo } from 'react';
import {
  ThemeProvider,
  CssBaseline,
  Box,
  Typography,
  IconButton,
  Button,
  Chip,
  Tabs,
  Tab,
  Checkbox,
  FormControlLabel,
  Tooltip,
  Paper,
  CircularProgress,
  TextField,
  Snackbar,
  Alert,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import CheckIcon from '@mui/icons-material/Check';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import CropFreeIcon from '@mui/icons-material/CropFree';
import ViewSidebarOutlinedIcon from '@mui/icons-material/ViewSidebarOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import KeyIcon from '@mui/icons-material/Key';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import ChatBubbleOutlinedIcon from '@mui/icons-material/ChatBubbleOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { getMaterial3Theme } from './theme/materialTheme';
import { convertDocument, extractStructuredData } from './services/documentApi';
import { parseMarkdownToBlocks } from './utils/markdownParser';
import JsonViewer from './components/JsonViewer';
import DocumentChat from './components/DocumentChat';
import SettingsDialog from './components/SettingsDialog';
import { getInitialDatalabKey, getInitialLlmConfig } from './utils/envConfig';
import './theme/tokens.css';

const DEFAULT_EXTRACT_SCHEMA = JSON.stringify(
  {
    type: 'object',
    properties: {
      so_to: {
        type: 'string',
        description: 'Số tờ bản đồ (vd: B1-18, 12, ...)',
      },
      so_thua: {
        type: 'string',
        description: 'Số thửa đất (vd: 92, 105, ...)',
      },
      dia_chi: {
        type: 'string',
        description: 'Địa chỉ thửa đất (Khu đô thị, Phường/Xã, Quận/Huyện, Tỉnh/Thành phố)',
      },
      dien_tich: {
        type: 'number',
        description: 'Diện tích thửa đất tính theo đơn vị m2',
      },
      chieu_rong: {
        type: 'string',
        description: 'Chiều rộng hoặc kích thước mặt tiền thửa đất (nếu có ghi trên sơ đồ/thông tin)',
      },
      chieu_dai: {
        type: 'string',
        description: 'Chiều dài hoặc chiều sâu của thửa đất (nếu có)',
      },
      truc_duong_tiep_giap: {
        type: 'string',
        description: 'Tên trục đường, ngõ, hẻm hoặc lối đi tiếp giáp thửa đất',
      },
      muc_dich_su_dung: {
        type: 'string',
        description: 'Mục đích sử dụng đất (vd: Đất ở tại đô thị, đất nông nghiệp, ...)',
      },
      thoi_han_su_dung: {
        type: 'string',
        description: 'Thời hạn sử dụng đất (vd: Lâu dài, đến năm 2050, ...)',
      },
      cong_trinh_tren_dat: {
        type: 'string',
        description: 'Công trình xây dựng trên đất (nhà ở, diện tích sàn, kết cấu nhà hoặc -/- nếu không có)',
      },
      ngay_cap: {
        type: 'string',
        description: 'Ngày tháng năm ký cấp Giấy chứng nhận quyền sử dụng đất',
      },
      ghi_chu: {
        type: 'string',
        description: 'Nội dung ghi chú trên giấy chứng nhận (thông tin quy hoạch, quyết định phê duyệt...)',
      },
      noi_dung_thay_doi_sau_ngay_cap: {
        type: 'string',
        description: 'Những thay đổi và cơ sở pháp lý sau khi cấp giấy (chuyển nhượng, đăng ký thế chấp, xóa thế chấp, đính chính...)',
      },
    },
  },
  null,
  2
);

export default function App() {
  // Navigation & Pipeline step
  const [pipelineTitle, setPipelineTitle] = useState('Untitled Convert Pipeline...');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [activeStep, setActiveStep] = useState('convert'); // 'convert' (OCR) | 'extract' (Structured)
  const [mainTab, setMainTab] = useState('results'); // 'configuration' | 'results'
  const [resultsSubTab, setResultsSubTab] = useState('blocks'); // 'blocks' | 'json' | 'html' | 'markdown' | 'extract' | 'api' | 'eval'

  // Document & File state (Starts completely empty)
  const [currentFileName, setCurrentFileName] = useState('');
  const [documentImage, setDocumentImage] = useState(null);
  const [currentFileObj, setCurrentFileObj] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showBboxes, setShowBboxes] = useState(true);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [hoveredBlockId, setHoveredBlockId] = useState(null);

  // Results state from API (Starts completely empty)
  const [blocksData, setBlocksData] = useState([]);
  const [markdownContent, setMarkdownContent] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [jsonRawContent, setJsonRawContent] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [pageSchemaInput, setPageSchemaInput] = useState(DEFAULT_EXTRACT_SCHEMA);

  // Metadata
  const [qualityScore, setQualityScore] = useState(null);
  const [costCents, setCostCents] = useState(null);

  // Execution state
  const [isRunning, setIsRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [renderHtml, setRenderHtml] = useState(true);
  const [mode, setMode] = useState('accurate'); // 'fast' | 'balanced' | 'accurate'
  const [wordBboxes, setWordBboxes] = useState(true);

  // API Key & Settings (Priority: .env > localStorage > default)
  const [apiKey, setApiKey] = useState(getInitialDatalabKey);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState(0);

  // App View Mode: 'pipeline' (OCR Studio) or 'chat' (Document Chat App)
  const [currentView, setCurrentView] = useState('chat');

  // LLM Config (Priority: .env > localStorage > default)
  const [llmConfig, setLlmConfig] = useState(getInitialLlmConfig);

  // Notifications
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

  const fileInputRef = useRef(null);
  const theme = useMemo(() => getMaterial3Theme('light'), []);

  const showNotification = (msg, severity = 'success') => {
    setSnackbarMessage(msg);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  // Handle file selection from input
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const processSelectedFile = (file) => {
    setCurrentFileName(file.name);
    setCurrentFileObj(file);
    if (file.type.startsWith('image/')) {
      setDocumentImage(URL.createObjectURL(file));
    } else {
      setDocumentImage('/favicon.svg');
    }
    // Clear previous execution results
    setBlocksData([]);
    setMarkdownContent('');
    setHtmlContent('');
    setJsonRawContent(null);
    setExtractedData(null);
    setQualityScore(null);
    setCostCents(null);
    showNotification(`Đã tải file: ${file.name}`);
  };

  // Drag and Drop handlers for the left upload box
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const handleClearFile = () => {
    setCurrentFileName('');
    setCurrentFileObj(null);
    setDocumentImage(null);
    setCurrentPage(1);
    setBlocksData([]);
    setMarkdownContent('');
    setHtmlContent('');
    setJsonRawContent(null);
    setExtractedData(null);
    setQualityScore(null);
    setCostCents(null);
  };

  // MAIN RUN HANDLER: Calls backend API directly
  const handleRunPipeline = async () => {
    if (!currentFileObj) {
      showNotification('Vui lòng chọn hoặc kéo thả tệp tài liệu vào ô bên trái trước khi Run!', 'warning');
      return;
    }

    if (!apiKey) {
      setSettingsInitialTab(0);
      setSettingsOpen(true);
      showNotification('Vui lòng cấu hình API Key để thực hiện xử lý tài liệu!', 'warning');
      return;
    }

    setIsRunning(true);
    setStatusMessage('Đang chuẩn bị gửi tệp lên hệ thống xử lý...');

    try {
      if (activeStep === 'convert') {
        // CALL CONVERT (OCR)
        setStatusMessage('Đang nhận dạng văn bản (POST /api/v1/convert)...');
        const result = await convertDocument({
          apiKey,
          file: currentFileObj,
          mode,
          outputFormat: 'markdown',
          wordBboxes,
          onProgress: (p) => setStatusMessage(p.message || ''),
        });

        if (result.markdown) {
          setMarkdownContent(result.markdown);
          const parsed = parseMarkdownToBlocks(result.markdown);
          setBlocksData(parsed);
        }
        if (result.html) setHtmlContent(result.html);
        if (result.json) setJsonRawContent(result.json);
        if (result.page_count) setTotalPages(result.page_count);
        if (result.parse_quality_score) setQualityScore(result.parse_quality_score);
        if (result.cost_breakdown?.total_cost_cents) setCostCents(result.cost_breakdown.total_cost_cents);

        showNotification('Nhận dạng văn bản (OCR) thành công!');
      } else {
        // CALL EXTRACT
        setStatusMessage('Đang bóc tách dữ liệu có cấu trúc (POST /api/v1/extract)...');
        const result = await extractStructuredData({
          apiKey,
          file: currentFileObj,
          pageSchema: pageSchemaInput,
          mode,
          onProgress: (p) => setStatusMessage(p.message || ''),
        });

        if (result.extraction_schema_json) {
          let parsedExtract = result.extraction_schema_json;
          if (typeof parsedExtract === 'string') {
            try {
              parsedExtract = JSON.parse(parsedExtract);
              if (typeof parsedExtract === 'string') {
                parsedExtract = JSON.parse(parsedExtract);
              }
            } catch {
              // keep as is
            }
          }
          setExtractedData(parsedExtract);
          setResultsSubTab('extract');
        }
        if (result.page_count) setTotalPages(result.page_count);
        if (result.parse_quality_score) setQualityScore(result.parse_quality_score);
        if (result.cost_breakdown?.total_cost_cents) setCostCents(result.cost_breakdown.total_cost_cents);

        showNotification('Trích xuất dữ liệu có cấu trúc thành công!');
      }
    } catch (err) {
      showNotification(err.message || 'Lỗi khi xử lý tài liệu', 'error');
    } finally {
      setIsRunning(false);
      setStatusMessage('');
    }
  };

  const handleSaveDatalabKey = (newKey) => {
    const trimmed = (newKey || '').trim();
    setApiKey(trimmed);
    if (trimmed) {
      localStorage.setItem('app_api_key', trimmed);
      localStorage.setItem('datalab_api_key', trimmed);
      showNotification('Đã lưu Datalab API Key thành công!');
    } else {
      localStorage.removeItem('app_api_key');
      localStorage.removeItem('datalab_api_key');
      showNotification('Đã xóa Datalab API Key!');
    }
  };

  const handleSaveLlmConfig = (newConfig) => {
    setLlmConfig(newConfig);
    localStorage.setItem('app_llm_config', JSON.stringify(newConfig));
    if (newConfig.apiKey) {
      localStorage.setItem('llm_api_key', newConfig.apiKey);
    } else {
      localStorage.removeItem('llm_api_key');
    }
    showNotification('Đã lưu cấu hình AI Chat thành công!');
  };

  // API cURL snippet matching current active step
  const currentApiSnippet = useMemo(() => {
    const fileName = currentFileName || 'document.pdf';
    const keyVal = apiKey || 'YOUR_API_KEY';
    if (activeStep === 'convert') {
      return `# Convert a document via API (OCR -> Markdown)
API="https://www.datalab.to/api/v1"
API_KEY="${keyVal}"

# 1. Submit the document
RESPONSE=$(curl -s -X POST "$API/convert" \\
  -H "X-Api-Key: $API_KEY" \\
  -F "file=@${fileName}" \\
  -F "output_format=markdown" \\
  -F "mode=${mode}")

CHECK_URL=$(echo "$RESPONSE" | sed -E 's/.*"request_check_url"[[:space:]]*:[[:space:]]*"([^"]+)".*/\\1/')
echo "Job submitted. Polling $CHECK_URL"

# 2. Poll until status is "complete"
while true; do
  sleep 2
  RESULT=$(curl -s -H "X-Api-Key: $API_KEY" "$CHECK_URL")
  STATUS=$(echo "$RESULT" | sed -E 's/.*"status"[[:space:]]*:[[:space:]]*"([^"]+)".*/\\1/')
  echo "status: $STATUS"
  if [ "$STATUS" = "complete" ] || [ "$STATUS" = "failed" ]; then
    echo "$RESULT"
    break
  fi
done`;
    }
    return `# Structured Extraction via API (JSON Schema)
API="https://www.datalab.to/api/v1"
API_KEY="${keyVal}"

# 1. Submit document with page_schema
RESPONSE=$(curl -s -X POST "$API/extract" \\
  -H "X-Api-Key: $API_KEY" \\
  -F "file=@${fileName}" \\
  -F "mode=${mode}" \\
  -F 'page_schema=${pageSchemaInput.replace(/\n\s*/g, '')}')

CHECK_URL=$(echo "$RESPONSE" | sed -E 's/.*"request_check_url"[[:space:]]*:[[:space:]]*"([^"]+)".*/\\1/')
echo "Job submitted. Polling $CHECK_URL"

# 2. Poll until complete
while true; do
  sleep 2
  RESULT=$(curl -s -H "X-Api-Key: $API_KEY" "$CHECK_URL")
  STATUS=$(echo "$RESULT" | sed -E 's/.*"status"[[:space:]]*:[[:space:]]*"([^"]+)".*/\\1/')
  if [ "$STATUS" = "complete" ] || [ "$STATUS" = "failed" ]; then
    echo "$RESULT"
    break
  fi
done`;
  }, [activeStep, apiKey, currentFileName, mode, pageSchemaInput]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#FFFFFF', overflow: 'hidden' }}>
        {/* =========================================================================
            1. TOP NAVIGATION BAR (Header)
           ========================================================================= */}
        <Box
          sx={{
            height: 48,
            borderBottom: '1px solid #E5E7EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            bgcolor: '#FFFFFF',
            zIndex: 10,
          }}
        >
          {/* Left: Back & Pipeline Title */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              size="small"
              onClick={() => setCurrentView((prev) => (prev === 'chat' ? 'pipeline' : 'chat'))}
              sx={{ p: 0.5, color: '#374151' }}
            >
              <ChevronLeftIcon fontSize="small" />
            </IconButton>

            {isEditingTitle ? (
              <TextField
                size="small"
                variant="standard"
                value={pipelineTitle}
                autoFocus
                onBlur={() => setIsEditingTitle(false)}
                onChange={(e) => setPipelineTitle(e.target.value)}
                sx={{ '& input': { fontSize: '0.875rem', fontWeight: 500, py: 0.2 } }}
              />
            ) : (
              <Box
                onClick={() => setIsEditingTitle(true)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  cursor: 'pointer',
                  '&:hover': { opacity: 0.8 },
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#111827', maxWidth: 220 }} noWrap>
                  {pipelineTitle}
                </Typography>
                <EditOutlinedIcon sx={{ fontSize: 13, color: '#6B7280' }} />
              </Box>
            )}
          </Box>

          {/* Center: Main View Switcher (OCR Studio vs Doc Chat) & Pipeline Steps */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {/* View Mode Toggle Pill */}
            <Box sx={{ display: 'flex', bgcolor: '#F3F4F6', p: 0.35, borderRadius: '8px', gap: 0.5 }}>
              <Button
                size="small"
                onClick={() => setCurrentView('pipeline')}
                startIcon={<DescriptionOutlinedIcon sx={{ fontSize: 14 }} />}
                sx={{
                  py: 0.3,
                  px: 1.25,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'none',
                  borderRadius: '6px',
                  bgcolor: currentView === 'pipeline' ? '#FFFFFF' : 'transparent',
                  color: currentView === 'pipeline' ? '#111827' : '#6B7280',
                  boxShadow: currentView === 'pipeline' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                  '&:hover': { bgcolor: currentView === 'pipeline' ? '#FFFFFF' : '#E5E7EB' },
                }}
              >
                OCR Studio
              </Button>
              <Button
                size="small"
                onClick={() => setCurrentView('chat')}
                startIcon={<ChatBubbleOutlinedIcon sx={{ fontSize: 14 }} />}
                sx={{
                  py: 0.3,
                  px: 1.25,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'none',
                  borderRadius: '6px',
                  bgcolor: currentView === 'chat' ? '#FFFFFF' : 'transparent',
                  color: currentView === 'chat' ? '#111827' : '#6B7280',
                  boxShadow: currentView === 'chat' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                  '&:hover': { bgcolor: currentView === 'chat' ? '#FFFFFF' : '#E5E7EB' },
                }}
              >
                Chat với tài liệu (AI)
              </Button>
            </Box>

            {/* Pipeline Steps if in OCR Studio */}
            {currentView === 'pipeline' && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, pl: 1, borderLeft: '1px solid #E5E7EB' }}>
                <Box
                  onClick={() => setActiveStep('convert')}
                  sx={{
                    bgcolor: activeStep === 'convert' ? '#111827' : '#F3F4F6',
                    color: activeStep === 'convert' ? '#FFFFFF' : '#374151',
                    borderRadius: '16px',
                    px: 1.25,
                    py: 0.25,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    fontSize: '0.725rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                  }}
                >
                  <CheckIcon sx={{ fontSize: 13 }} />
                  Convert
                </Box>

                <Typography sx={{ color: '#9CA3AF', fontSize: '0.7rem' }}>→</Typography>

                <Box
                  onClick={() => setActiveStep('extract')}
                  sx={{
                    bgcolor: activeStep === 'extract' ? '#111827' : '#F3F4F6',
                    color: activeStep === 'extract' ? '#FFFFFF' : '#374151',
                    borderRadius: '16px',
                    px: 1.25,
                    py: 0.25,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    fontSize: '0.725rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                  }}
                >
                  {activeStep === 'extract' ? <CheckIcon sx={{ fontSize: 13 }} /> : <AddIcon sx={{ fontSize: 13 }} />}
                  Extract
                </Box>
              </Box>
            )}
          </Box>

          {/* Right: API Key Pill & Actions */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Cấu hình Datalab API Key">
              <Chip
                icon={<KeyIcon sx={{ fontSize: 13 }} />}
                label={apiKey ? 'Datalab: Đã lưu' : 'Nhập Datalab Key'}
                size="small"
                onClick={() => {
                  setSettingsInitialTab(0);
                  setSettingsOpen(true);
                }}
                sx={{
                  height: 24,
                  fontSize: '0.725rem',
                  bgcolor: apiKey ? '#ECFDF5' : '#FEF2F2',
                  color: apiKey ? '#059669' : '#DC2626',
                  fontWeight: 600,
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              />
            </Tooltip>

            <Tooltip title="Cài đặt hệ thống (OCR & AI LLM)">
              <IconButton
                size="small"
                onClick={() => {
                  setSettingsInitialTab(currentView === 'chat' ? 1 : 0);
                  setSettingsOpen(true);
                }}
                sx={{ p: 0.5, color: '#4B5563', border: '1px solid #E5E7EB' }}
              >
                <SettingsOutlinedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>

            <Chip
              label="Draft"
              size="small"
              sx={{
                height: 24,
                fontSize: '0.75rem',
                bgcolor: '#F3F4F6',
                color: '#4B5563',
                fontWeight: 500,
                borderRadius: '6px',
              }}
            />
          </Box>
        </Box>

        {/* =========================================================================
            2. MAIN CONTENT: Chat View AND Pipeline Studio (kept mounted to preserve state)
           ========================================================================= */}
        {/* Chat View */}
        <Box sx={{ flexGrow: 1, display: currentView === 'chat' ? 'flex' : 'none', flexDirection: 'column', overflow: 'hidden' }}>
          <DocumentChat
            datalabKey={apiKey}
            onOpenSettings={(tabIdx = 0) => {
              setSettingsInitialTab(tabIdx);
              setSettingsOpen(true);
            }}
            llmConfig={llmConfig}
            showNotification={showNotification}
          />
        </Box>

        {/* Pipeline Studio View */}
        <Box sx={{ flexGrow: 1, display: currentView === 'pipeline' ? 'flex' : 'none', flexDirection: 'column', overflow: 'hidden' }}>

        {/* =========================================================================
            2. SUB-HEADER / FILE TABS & MODE SELECTOR
           ========================================================================= */}
        <Box
          sx={{
            height: 40,
            borderBottom: '1px solid #E5E7EB',
            display: 'flex',
            bgcolor: '#FAFAFA',
          }}
        >
          {/* Left: File info & Tab */}
          <Box
            sx={{
              width: '50%',
              borderRight: '1px solid #E5E7EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, overflow: 'hidden' }}>
              <Typography variant="caption" sx={{ color: '#6B7280', fontWeight: 500, whiteSpace: 'nowrap' }}>
                {currentFileName ? '1 File' : '0 File'}
              </Typography>

              {/* Active File Tab if loaded */}
              {currentFileName ? (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    bgcolor: '#FFFFFF',
                    border: '1px solid #E5E7EB',
                    borderBottom: 'none',
                    borderRadius: '6px 6px 0 0',
                    px: 1.5,
                    py: 0.5,
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    color: '#111827',
                  }}
                >
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#10B981' }} />
                  <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 500, maxWidth: 200 }} noWrap>
                    {currentFileName}
                  </Typography>
                  <IconButton size="small" onClick={handleClearFile} sx={{ p: 0.2, color: '#9CA3AF' }}>
                    <CloseIcon sx={{ fontSize: 13 }} />
                  </IconButton>
                </Box>
              ) : (
                <Typography variant="caption" color="text.secondary">
                  Chưa có tài liệu tải lên
                </Typography>
              )}
            </Box>

            {/* Hidden Input & Upload trigger */}
            <input type="file" ref={fileInputRef} hidden accept="image/*,application/pdf" onChange={handleFileUpload} />
            <Button
              size="small"
              onClick={() => fileInputRef.current?.click()}
              sx={{
                fontSize: '0.75rem',
                textTransform: 'none',
                color: '#111827',
                p: 0,
                minWidth: 'auto',
                fontWeight: 600,
              }}
            >
              + Chọn file tải lên
            </Button>
          </Box>

          {/* Right: Configuration vs Results */}
          <Box sx={{ width: '50%', display: 'flex', alignItems: 'center', px: 2 }}>
            <Box sx={{ display: 'flex', gap: 3, height: '100%' }}>
              <Box
                onClick={() => setMainTab('configuration')}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  color: mainTab === 'configuration' ? '#111827' : '#6B7280',
                  borderBottom: mainTab === 'configuration' ? '2px solid #111827' : '2px solid transparent',
                  px: 1,
                  height: '100%',
                }}
              >
                Configuration
              </Box>

              <Box
                onClick={() => setMainTab('results')}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: mainTab === 'results' ? '#111827' : '#6B7280',
                  borderBottom: mainTab === 'results' ? '2px solid #111827' : '2px solid transparent',
                  px: 1,
                  height: '100%',
                }}
              >
                Results
              </Box>
            </Box>
          </Box>
        </Box>

        {/* =========================================================================
            3. TWO-COLUMN WORKSPACE
           ========================================================================= */}
        <Box sx={{ flexGrow: 1, display: 'flex', overflow: 'hidden' }}>
          {/* -----------------------------------------------------------------------
              CỘT BÊN TRÁI: Ô UPLOAD FILE & XEM TRƯỚC TÀI LIỆU
             ----------------------------------------------------------------------- */}
          <Box
            sx={{
              width: '50%',
              borderRight: '1px solid #E5E7EB',
              display: 'flex',
              flexDirection: 'column',
              bgcolor: '#F9FAFB',
              height: '100%',
              overflow: 'hidden',
            }}
          >
            {/* Khi chưa có file: Hiển thị Ô UPLOAD FILE (Dropzone) */}
            {!currentFileObj ? (
              <Box
                sx={{
                  flexGrow: 1,
                  p: 3,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Paper
                  variant="outlined"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  sx={{
                    width: '100%',
                    maxWidth: 480,
                    minHeight: 340,
                    p: 4,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px dashed',
                    borderColor: isDragging ? '#111827' : '#D1D5DB',
                    bgcolor: isDragging ? '#F3F4F6' : '#FFFFFF',
                    borderRadius: 3,
                    cursor: 'pointer',
                    transition: 'all 200ms ease',
                    textAlign: 'center',
                    '&:hover': {
                      borderColor: '#111827',
                      bgcolor: '#FAFAFA',
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      bgcolor: '#F3F4F6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#111827',
                      mb: 2,
                    }}
                  >
                    <CloudUploadIcon sx={{ fontSize: 32 }} />
                  </Box>

                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#111827', mb: 0.5 }}>
                    Kéo & thả tệp tài liệu vào đây
                  </Typography>

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, maxWidth: 320 }}>
                    Hỗ trợ định dạng hình ảnh (PNG, JPG, WEBP) hoặc PDF lên tới 25MB để xử lý OCR & trích xuất văn bản
                  </Typography>

                  <Button
                    variant="contained"
                    size="small"
                    sx={{
                      bgcolor: '#111827',
                      color: '#FFFFFF',
                      textTransform: 'none',
                      borderRadius: '6px',
                      px: 2.5,
                      fontWeight: 600,
                      '&:hover': { bgcolor: '#1F2937' },
                    }}
                  >
                    Chọn file từ máy tính
                  </Button>
                </Paper>
              </Box>
            ) : (
              /* Khi đã có file: Hiển thị Toolbar + Viewport tài liệu */
              <>
                {/* Document Toolbar */}
                <Box
                  sx={{
                    height: 38,
                    borderBottom: '1px solid #E5E7EB',
                    bgcolor: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    px: 1.5,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      sx={{
                        height: 26,
                        fontSize: '0.75rem',
                        textTransform: 'none',
                        px: 1,
                        minWidth: 'auto',
                        color: '#374151',
                        borderColor: '#E5E7EB',
                      }}
                    >
                      Prev
                    </Button>

                    <Typography variant="body2" sx={{ fontSize: '0.75rem', color: '#4B5563', px: 1 }}>
                      Page {currentPage} / {totalPages}
                    </Typography>

                    <Button
                      size="small"
                      variant="outlined"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      sx={{
                        height: 26,
                        fontSize: '0.75rem',
                        textTransform: 'none',
                        px: 1,
                        minWidth: 'auto',
                        color: '#374151',
                        borderColor: '#E5E7EB',
                      }}
                    >
                      Next
                    </Button>

                    {/* Bboxes Toggle */}
                    <Tooltip title="Bật/Tắt hiển thị Bounding Boxes">
                      <Button
                        size="small"
                        variant={showBboxes ? 'contained' : 'outlined'}
                        onClick={() => setShowBboxes(!showBboxes)}
                        startIcon={<CropFreeIcon sx={{ fontSize: 14 }} />}
                        sx={{
                          ml: 1,
                          height: 26,
                          fontSize: '0.75rem',
                          textTransform: 'none',
                          px: 1,
                          bgcolor: showBboxes ? '#F3F4F6' : '#FFFFFF',
                          color: '#111827',
                          borderColor: '#E5E7EB',
                          boxShadow: 'none',
                          fontWeight: 500,
                        }}
                      >
                        Bboxes
                      </Button>
                    </Tooltip>

                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => setShowThumbnails(!showThumbnails)}
                      startIcon={<ViewSidebarOutlinedIcon sx={{ fontSize: 14 }} />}
                      sx={{
                        ml: 0.5,
                        height: 26,
                        fontSize: '0.75rem',
                        textTransform: 'none',
                        px: 1,
                        color: '#374151',
                        borderColor: '#E5E7EB',
                        fontWeight: 500,
                      }}
                    >
                      Show Thumbnails
                    </Button>
                  </Box>

                  {/* Actions for current file */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Tooltip title="Đổi sang file khác">
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => fileInputRef.current?.click()}
                        sx={{ fontSize: '0.75rem', textTransform: 'none', color: '#111827', fontWeight: 500 }}
                      >
                        Đổi file
                      </Button>
                    </Tooltip>

                    <Tooltip title="Xóa file">
                      <IconButton size="small" onClick={handleClearFile} sx={{ color: '#EF4444', p: 0.5 }}>
                        <DeleteOutlinedIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>

                {/* Document Viewport */}
                <Box
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  sx={{
                    flexGrow: 1,
                    overflowY: 'auto',
                    p: 2,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'flex-start',
                    bgcolor: isDragging ? '#D1D5DB' : '#E5E7EB',
                    transition: 'background-color 150ms ease',
                    position: 'relative',
                  }}
                >
                  <Box
                    sx={{
                      position: 'relative',
                      maxWidth: '100%',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      bgcolor: '#FFFFFF',
                      borderRadius: '4px',
                      lineHeight: 0,
                      userSelect: 'none',
                    }}
                  >
                    {documentImage ? (
                      <Box
                        component="img"
                        src={documentImage}
                        alt={currentFileName}
                        sx={{
                          display: 'block',
                          maxWidth: '100%',
                          height: 'auto',
                          borderRadius: '4px',
                        }}
                      />
                    ) : (
                      <Box sx={{ p: 4, textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary">
                          {currentFileName}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>
              </>
            )}
          </Box>

          {/* -----------------------------------------------------------------------
              CỘT BÊN PHẢI: CONFIGURATION HOẶC RESULTS
             ----------------------------------------------------------------------- */}
          <Box
            sx={{
              width: '50%',
              display: 'flex',
              flexDirection: 'column',
              bgcolor: '#FFFFFF',
              height: '100%',
              overflow: 'hidden',
            }}
          >
            {mainTab === 'configuration' ? (
              /* CONFIGURATION VIEW */
              <Box sx={{ flexGrow: 1, p: 3, overflowY: 'auto' }}>
                <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600, mb: 1 }}>
                  Pipeline Configuration
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Điều chỉnh các tham số xử lý tài liệu cho bước Convert và Extract.
                </Typography>

                <Paper variant="outlined" sx={{ p: 2.5, mb: 2, borderRadius: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
                    1. Chế độ xử lý (Processing Mode)
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    {['fast', 'balanced', 'accurate'].map((m) => (
                      <Chip
                        key={m}
                        label={m.toUpperCase()}
                        color={mode === m ? 'primary' : 'default'}
                        variant={mode === m ? 'filled' : 'outlined'}
                        onClick={() => setMode(m)}
                        sx={{ fontWeight: 600, cursor: 'pointer' }}
                      />
                    ))}
                  </Box>
                </Paper>

                <Paper variant="outlined" sx={{ p: 2.5, mb: 2, borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      2. Cấu hình Trích xuất Thông tin Sổ đỏ (page_schema)
                    </Typography>
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => setPageSchemaInput(DEFAULT_EXTRACT_SCHEMA)}
                      sx={{ fontSize: '0.75rem', textTransform: 'none' }}
                    >
                      Khôi phục Schema mặc định
                    </Button>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Định nghĩa các trường cần bóc tách từ Giấy chứng nhận quyền sử dụng đất (Số tờ, số thửa, diện tích, kích thước, trục đường tiếp giáp, mục đích, thời hạn, ngày cấp, thay đổi sau ngày cấp...):
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={12}
                    value={pageSchemaInput}
                    onChange={(e) => setPageSchemaInput(e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        fontFamily: 'monospace',
                        fontSize: '0.8rem',
                        bgcolor: '#F9FAFB',
                      },
                    }}
                  />
                </Paper>

                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    3. Bounding Boxes
                  </Typography>
                  <FormControlLabel
                    control={<Checkbox checked={wordBboxes} onChange={(e) => setWordBboxes(e.target.checked)} />}
                    label="Tạo bounding boxes từng từ (word_bboxes)"
                  />
                </Paper>
              </Box>
            ) : (
              /* RESULTS VIEW */
              <>
                {/* Sub-Tabs: Blocks | JSON | HTML | Markdown | Extract | API | Eval */}
                <Box
                  sx={{
                    height: 38,
                    borderBottom: '1px solid #E5E7EB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    px: 2,
                    bgcolor: '#FFFFFF',
                  }}
                >
                  <Tabs
                    value={resultsSubTab}
                    onChange={(_, val) => setResultsSubTab(val)}
                    sx={{
                      minHeight: 38,
                      '& .MuiTab-root': {
                        minHeight: 38,
                        minWidth: 'auto',
                        px: 1.25,
                        py: 0,
                        textTransform: 'none',
                        fontSize: '0.8rem',
                        fontWeight: 500,
                        color: '#6B7280',
                        '&.Mui-selected': {
                          color: '#111827',
                          fontWeight: 600,
                        },
                      },
                      '& .MuiTabs-indicator': {
                        backgroundColor: '#111827',
                        height: 2,
                      },
                    }}
                  >
                    <Tab
                      value="blocks"
                      icon={<InfoOutlinedIcon sx={{ fontSize: 14, mr: 0.5 }} />}
                      iconPosition="start"
                      label="Blocks"
                    />
                    <Tab value="json" label="JSON" />
                    <Tab value="html" label="HTML" />
                    <Tab value="markdown" label="Markdown" />
                    <Tab value="extract" label="Extract (JSON)" />
                    <Tab value="api" label="API" />
                    <Tab value="eval" label="Eval" />
                  </Tabs>

                  {/* Right controls */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FormControlLabel
                      sx={{ m: 0 }}
                      control={
                        <Checkbox
                          size="small"
                          checked={renderHtml}
                          onChange={(e) => setRenderHtml(e.target.checked)}
                          sx={{ p: 0.5, color: '#111827', '&.Mui-checked': { color: '#111827' } }}
                        />
                      }
                      label={
                        <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 500, color: '#374151' }}>
                          Render HTML
                        </Typography>
                      }
                    />

                    <IconButton
                      size="small"
                      onClick={() => {
                        setSettingsInitialTab(0);
                        setSettingsOpen(true);
                      }}
                      sx={{ p: 0.5, color: '#6B7280' }}
                    >
                      <SettingsOutlinedIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                </Box>

                {/* Sub-tab Content Panels */}
                <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2, bgcolor: '#FFFFFF' }}>
                  {isRunning ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 280, gap: 2 }}>
                      <CircularProgress size={38} sx={{ color: '#111827' }} />
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#111827' }}>
                        {statusMessage || 'Hệ thống đang xử lý...'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Đang phân tích cấu trúc và nhận diện dữ liệu...
                      </Typography>
                    </Box>
                  ) : !markdownContent && !extractedData && !jsonRawContent ? (
                    /* EMPTY STATE KHI CHƯA CHẠY HOẶC CHƯA CÓ KẾT QUẢ */
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        minHeight: 320,
                        textAlign: 'center',
                        p: 3,
                      }}
                    >
                      <Box
                        sx={{
                          width: 56,
                          height: 56,
                          borderRadius: '50%',
                          bgcolor: '#F3F4F6',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#9CA3AF',
                          mb: 2,
                        }}
                      >
                        <PlayArrowIcon sx={{ fontSize: 28 }} />
                      </Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#111827', mb: 0.5 }}>
                        Chưa có dữ liệu phân tích
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360, mb: 2 }}>
                        Hãy tải file lên ở cột bên trái và bấm nút <strong>"Run"</strong> để bắt đầu xử lý.
                      </Typography>
                      {!apiKey && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            setSettingsInitialTab(0);
                            setSettingsOpen(true);
                          }}
                          sx={{ textTransform: 'none', color: '#111827', borderColor: '#D1D5DB' }}
                        >
                          Cấu hình API Key
                        </Button>
                      )}
                    </Box>
                  ) : (
                    <>
                      {/* VIEW 1: BLOCKS */}
                      {resultsSubTab === 'blocks' && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                          {blocksData.length > 0 ? (
                            blocksData.map((block) => {
                              const isHovered = hoveredBlockId === block.id;
                              return (
                                <Paper
                                  key={block.id}
                                  variant="outlined"
                                  onMouseEnter={() => setHoveredBlockId(block.id)}
                                  onMouseLeave={() => setHoveredBlockId(null)}
                                  sx={{
                                    p: 2,
                                    borderLeft: `4px solid ${block.color}`,
                                    borderColor: isHovered ? block.color : '#E5E7EB',
                                    borderLeftColor: block.color,
                                    borderRadius: '4px',
                                    bgcolor: isHovered ? '#F9FAFB' : '#FFFFFF',
                                    transition: 'all 150ms ease',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      color: block.color,
                                      fontWeight: 700,
                                      fontSize: '0.7rem',
                                      letterSpacing: '0.8px',
                                      textTransform: 'uppercase',
                                      display: 'block',
                                      mb: 1,
                                    }}
                                  >
                                    {block.category}
                                  </Typography>

                                  <Typography
                                    variant="body2"
                                    sx={{
                                      color: '#111827',
                                      fontSize: '0.85rem',
                                      lineHeight: 1.6,
                                      whiteSpace: 'pre-line',
                                      fontWeight: block.category === 'SECTIONHEADER' ? 500 : 400,
                                    }}
                                  >
                                    {block.text}
                                  </Typography>
                                </Paper>
                              );
                            })
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              Không có khối nội dung nào được trích xuất.
                            </Typography>
                          )}
                        </Box>
                      )}

                      {/* VIEW 2: JSON */}
                      {resultsSubTab === 'json' && (
                        <Box sx={{ p: 1 }}>
                          <JsonViewer
                            data={
                              jsonRawContent || {
                                file_name: currentFileName || 'document.pdf',
                                parse_quality_score: qualityScore,
                                cost_breakdown: { total_cost_cents: costCents },
                                blocks: blocksData,
                              }
                            }
                            title="Toàn bộ JSON phản hồi"
                            onCopy={(text) => {
                              navigator.clipboard.writeText(text);
                              showNotification('Đã sao chép JSON!');
                            }}
                          />
                        </Box>
                      )}

                      {/* VIEW 3: HTML */}
                      {resultsSubTab === 'html' && (
                        renderHtml ? (
                          <Box
                            sx={{
                              p: 2,
                              '& h2, & h3': { color: '#111827', my: 1 },
                              '& ul': { pl: 2.5, my: 1 },
                              '& li': { my: 0.5, fontSize: '0.85rem' },
                            }}
                            dangerouslySetInnerHTML={{
                              __html: htmlContent || `<div>${markdownContent}</div>`,
                            }}
                          />
                        ) : (
                          <Box
                            component="pre"
                            sx={{
                              m: 0,
                              p: 2,
                              bgcolor: '#F9FAFB',
                              borderRadius: 1,
                              fontSize: '0.8rem',
                              fontFamily: 'monospace',
                              color: '#1F2937',
                              overflowX: 'auto',
                            }}
                          >
                            {htmlContent || `<div>${markdownContent}</div>`}
                          </Box>
                        )
                      )}

                      {/* VIEW 4: MARKDOWN */}
                      {resultsSubTab === 'markdown' && (
                        <Box sx={{ p: 2 }}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {markdownContent}
                          </ReactMarkdown>
                        </Box>
                      )}

                      {/* VIEW 5: EXTRACTED JSON DATA */}
                      {resultsSubTab === 'extract' && (
                        <Box sx={{ p: 1 }}>
                          {extractedData ? (
                            <JsonViewer
                              data={extractedData}
                              title="Thông tin trích xuất từ Sổ đỏ (Giấy CN QSD đất)"
                              onCopy={(text) => {
                                navigator.clipboard.writeText(text);
                                showNotification('Đã sao chép JSON trích xuất!');
                              }}
                            />
                          ) : (
                            <Box sx={{ p: 4, textAlign: 'center', color: '#6B7280' }}>
                              <Typography variant="body2">
                                Chưa chạy bước Extract. Vui lòng chọn bước <strong>"Extract"</strong> ở thanh trên cùng và bấm nút <strong>[► Run]</strong> để trích xuất thông tin.
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      )}

                      {/* VIEW 6: API */}
                      {resultsSubTab === 'api' && (
                        <Box sx={{ p: 2 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                            cURL Command ({activeStep === 'convert' ? 'POST /api/v1/convert' : 'POST /api/v1/extract'})
                          </Typography>
                          <Box
                            component="pre"
                            sx={{
                              p: 2,
                              bgcolor: '#111827',
                              color: '#E5E7EB',
                              borderRadius: 1,
                              fontSize: '0.8rem',
                              fontFamily: 'monospace',
                              overflowX: 'auto',
                            }}
                          >
                            {currentApiSnippet}
                          </Box>
                          <Button
                            size="small"
                            startIcon={<ContentCopyIcon fontSize="small" />}
                            onClick={() => {
                              navigator.clipboard.writeText(currentApiSnippet);
                              showNotification('Đã copy mã cURL!');
                            }}
                            sx={{ mt: 1, textTransform: 'none' }}
                          >
                            Copy cURL Command
                          </Button>
                        </Box>
                      )}

                      {/* VIEW 7: EVAL */}
                      {resultsSubTab === 'eval' && (
                        <Box sx={{ p: 2 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                            Pipeline Evaluation Metrics
                          </Typography>
                          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                            <Typography variant="body2" sx={{ mb: 1 }}>
                              <strong>Parse Quality Score:</strong> {qualityScore ? `${qualityScore} / 5.0` : 'N/A'}
                            </Typography>
                            <Typography variant="body2" sx={{ mb: 1 }}>
                              <strong>Processing Mode:</strong> {mode.toUpperCase()}
                            </Typography>
                            <Typography variant="body2">
                              <strong>Cost breakdown:</strong> {costCents != null ? `${costCents}¢` : 'N/A'}
                            </Typography>
                          </Paper>
                        </Box>
                      )}
                    </>
                  )}
                </Box>
              </>
            )}

            {/* Bottom Toolbar of Right Column */}
            <Box
              sx={{
                height: 48,
                borderTop: '1px solid #E5E7EB',
                bgcolor: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 2,
              }}
            >
              {/* Left: Active endpoint indicator */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip
                  label={activeStep === 'convert' ? 'POST /api/v1/convert' : 'POST /api/v1/extract'}
                  size="small"
                  variant="outlined"
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    height: 24,
                    borderColor: '#E5E7EB',
                    color: '#6B7280',
                  }}
                />
                {currentFileName && (
                  <Typography variant="caption" sx={{ color: '#4B5563' }}>
                    Tệp: <strong>{currentFileName}</strong>
                  </Typography>
                )}
              </Box>

              {/* Right: Run Button */}
              <Button
                variant="contained"
                size="small"
                onClick={handleRunPipeline}
                disabled={isRunning}
                startIcon={
                  isRunning ? <CircularProgress size={14} color="inherit" /> : <PlayArrowIcon sx={{ fontSize: 16 }} />
                }
                sx={{
                  bgcolor: '#1D4ED8',
                  color: '#FFFFFF',
                  textTransform: 'none',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  px: 2.5,
                  height: 32,
                  borderRadius: '4px',
                  boxShadow: 'none',
                  '&:hover': { bgcolor: '#1E40AF', boxShadow: 'none' },
                }}
              >
                {isRunning ? 'Running...' : 'Run'}
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>

        {/* System Settings Dialog (Datalab OCR & LLM AI Chat) */}
        <SettingsDialog
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          datalabKey={apiKey}
          onSaveDatalabKey={handleSaveDatalabKey}
          llmConfig={llmConfig}
          onSaveLlmConfig={handleSaveLlmConfig}
          initialTab={settingsInitialTab}
        />

        {/* Global Feedback Snackbar */}
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={3500}
          onClose={() => setSnackbarOpen(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width: '100%', borderRadius: 3 }}>
            {snackbarMessage}
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
}
