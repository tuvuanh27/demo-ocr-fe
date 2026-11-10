import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  TextField,
  Paper,
  Chip,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import SendIcon from '@mui/icons-material/Send';
import StopCircleOutlinedIcon from '@mui/icons-material/StopCircleOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import PlayCircleOutlinedIcon from '@mui/icons-material/PlayCircleOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { convertDocument } from '../services/documentApi';
import {
  sendChatMessage,
  DEFAULT_SYSTEM_PROMPT,
} from '../services/llmApi';
import {
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_COUNT,
  formatFileSize,
  extractPagesFromOcrResult,
  buildDocumentsContext,
  CITATION_REGEX,
} from '../utils/documentHelper';

export default function DocumentChat({
  datalabKey,
  onOpenSettings,
  llmConfig,
  showNotification,
}) {
  // Document Files state
  // fileItem: { id, file, name, size, type, status: 'idle' | 'preparing' | 'ready' | 'error', errorMsg, markdown, pages: [{pageNumber, markdown}] }
  const [docFiles, setDocFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isPreparingAll, setIsPreparingAll] = useState(false);

  // System Prompt State
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [isSysPromptExpanded, setIsSysPromptExpanded] = useState(false);

  // Preview OCR Dialog state
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewPageTab, setPreviewPageTab] = useState(1);

  // Chat conversation state
  // message: { id, role: 'user' | 'assistant', content, timestamp, citations: [] }
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const fileInputRef = useRef(null);
  const chatBottomRef = useRef(null);
  const abortControllerRef = useRef(null);
  const idCounterRef = useRef(0);

  const getNextId = (prefix) => {
    idCounterRef.current += 1;
    return `${prefix}_${idCounterRef.current}`;
  };

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  // Prepared documents ready for LLM context
  const readyDocuments = useMemo(() => {
    return docFiles.filter((d) => d.status === 'ready' && d.markdown);
  }, [docFiles]);

  const preparedContext = useMemo(() => {
    return buildDocumentsContext(readyDocuments);
  }, [readyDocuments]);

  // Handle uploading files
  const handleFilesAdded = (incomingFileList) => {
    if (!incomingFileList || incomingFileList.length === 0) return;

    const currentCount = docFiles.length;
    const availableSlots = MAX_FILE_COUNT - currentCount;

    if (availableSlots <= 0) {
      showNotification(`Bạn chỉ có thể tải lên tối đa ${MAX_FILE_COUNT} tệp tài liệu.`, 'warning');
      return;
    }

    const filesToProcess = Array.from(incomingFileList).slice(0, availableSlots);
    if (incomingFileList.length > availableSlots) {
      showNotification(`Chỉ có thể thêm ${availableSlots} tệp nữa (tối đa ${MAX_FILE_COUNT} tệp).`, 'info');
    }

    const newDocItems = [];
    for (const file of filesToProcess) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        showNotification(`Tệp "${file.name}" vượt quá giới hạn 5MB (${formatFileSize(file.size)}). Bỏ qua tệp này!`, 'error');
        continue;
      }

      // Check if file already added
      const isDuplicate = docFiles.some((d) => d.name === file.name && d.size === file.size);
      if (isDuplicate) {
        showNotification(`Tệp "${file.name}" đã có trong danh sách!`, 'warning');
        continue;
      }

      newDocItems.push({
        id: getNextId('doc'),
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'idle', // 'idle' | 'preparing' | 'ready' | 'error'
        errorMsg: '',
        markdown: '',
        pages: [],
      });
    }

    if (newDocItems.length > 0) {
      setDocFiles((prev) => [...prev, ...newDocItems]);
      showNotification(`Đã thêm ${newDocItems.length} tệp tài liệu. Bấm "Prepare" để OCR tài liệu!`, 'success');
    }
  };

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
    if (e.dataTransfer.files) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const handleRemoveFile = (docId) => {
    setDocFiles((prev) => prev.filter((d) => d.id !== docId));
  };

  const handleClearAllFiles = () => {
    setDocFiles([]);
    showNotification('Đã xóa tất cả tài liệu.');
  };

  // Run OCR Prepare on a single file
  const prepareSingleFile = async (docItem) => {
    if (!datalabKey) {
      showNotification('Vui lòng cài đặt Datalab API Key để thực hiện OCR!', 'warning');
      onOpenSettings(0);
      return;
    }

    setDocFiles((prev) =>
      prev.map((d) => (d.id === docItem.id ? { ...d, status: 'preparing', errorMsg: '' } : d))
    );

    try {
      const result = await convertDocument({
        apiKey: datalabKey,
        file: docItem.file,
        mode: 'balanced',
        outputFormat: 'markdown',
        paginate: true,
      });

      const pages = extractPagesFromOcrResult(result);
      const markdown = result.markdown || pages.map((p) => p.markdown).join('\n\n') || '';

      setDocFiles((prev) =>
        prev.map((d) =>
          d.id === docItem.id
            ? {
                ...d,
                status: 'ready',
                markdown,
                pages,
              }
            : d
        )
      );
      showNotification(`OCR thành công: ${docItem.name} (${pages.length} trang)`, 'success');
    } catch (err) {
      const msg = err.message || 'Lỗi xử lý OCR';
      setDocFiles((prev) =>
        prev.map((d) => (d.id === docItem.id ? { ...d, status: 'error', errorMsg: msg } : d))
      );
      showNotification(`OCR thất bại [${docItem.name}]: ${msg}`, 'error');
    }
  };

  // Run OCR Prepare on all un-prepared files
  const handlePrepareAll = async () => {
    if (docFiles.length === 0) {
      showNotification('Chưa có tệp nào được tải lên để Prepare!', 'warning');
      return;
    }

    if (!datalabKey) {
      showNotification('Vui lòng nhập Datalab API Key trong Cài đặt trước khi Prepare!', 'warning');
      onOpenSettings(0);
      return;
    }

    const pendingDocs = docFiles.filter((d) => d.status !== 'ready');
    if (pendingDocs.length === 0) {
      showNotification('Tất cả tài liệu đã được Prepare sẵn sàng!', 'info');
      return;
    }

    setIsPreparingAll(true);
    showNotification(`Bắt đầu OCR chuẩn bị ${pendingDocs.length} tài liệu...`, 'info');

    for (const doc of pendingDocs) {
      await prepareSingleFile(doc);
    }

    setIsPreparingAll(false);
  };

  // Open Preview Dialog
  const handleOpenPreview = (doc) => {
    setPreviewDoc(doc);
    setPreviewPageTab(1);
  };

  // Handle clicking citation pill in chat: opens preview of that document & page
  const handleCitationClick = (citationText) => {
    // citationText format: "[filename.pdf, Trang 2]"
    const match = /\[([^[\s\]\n\r,]+?),\s*(?:Trang|trang|Page|page)\s*(\d+)\]/.exec(citationText);
    if (!match) return;

    const targetFileName = match[1].trim();
    const targetPage = parseInt(match[2], 10) || 1;

    // Find matching document
    const foundDoc = docFiles.find(
      (d) => d.name.toLowerCase() === targetFileName.toLowerCase() || d.name.includes(targetFileName)
    );

    if (foundDoc && foundDoc.markdown) {
      setPreviewDoc(foundDoc);
      setPreviewPageTab(targetPage);
    } else {
      showNotification(`Không tìm thấy tài liệu tương ứng cho: ${targetFileName}`, 'info');
    }
  };

  // Send Chat message
  const handleSendMessage = async (customPrompt) => {
    const textToSend = (typeof customPrompt === 'string' ? customPrompt : userInput).trim();
    if (!textToSend || isGenerating) return;

    if (readyDocuments.length === 0) {
      showNotification('Vui lòng tải lên tài liệu và bấm "Prepare" để OCR trước khi hỏi đáp!', 'warning');
      return;
    }

    if (!llmConfig?.apiKey && !llmConfig?.baseURL?.includes('localhost')) {
      showNotification('Vui lòng cấu hình API Key cho AI trong Cài đặt!', 'warning');
      onOpenSettings(1);
      return;
    }

    const userMsgId = getNextId('user');
    const assistantMsgId = getNextId('asst');

    const newMessages = [
      ...messages,
      { id: userMsgId, role: 'user', content: textToSend },
      { id: assistantMsgId, role: 'assistant', content: '', isStreaming: true },
    ];

    setMessages(newMessages);
    setUserInput('');
    setIsGenerating(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Prepare message history for LLM (only user and assistant text)
    const historyForLlm = newMessages
      .slice(0, -1) // exclude the empty assistant message
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      await sendChatMessage({
        baseURL: llmConfig?.baseURL,
        apiKey: llmConfig?.apiKey,
        model: llmConfig?.model,
        messages: historyForLlm,
        systemPrompt,
        documentsContext: preparedContext,
        signal: abortController.signal,
        onChunk: (accumulated) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsgId ? { ...m, content: accumulated } : m))
          );
        },
      });

      // Mark streaming done
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMsgId ? { ...m, isStreaming: false } : m))
      );
    } catch (err) {
      if (err.name === 'AbortError') {
        showNotification('Đã dừng tạo câu trả lời.', 'info');
      } else {
        const errorContent = `⚠️ **Lỗi:** ${err.message || 'Không thể nhận phản hồi từ AI.'}\n\n*Gợi ý: Kiểm tra lại cấu hình API Key, Base URL hoặc Model trong Cài đặt.*`;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, content: errorContent, isError: true, isStreaming: false } : m
          )
        );
        showNotification(err.message || 'Lỗi khi gọi API AI', 'error');
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    showNotification('Đã xóa lịch sử trò chuyện.');
  };

  // Helper to render file icon by type
  const renderFileIcon = (fileName) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') {
      return <PictureAsPdfOutlinedIcon sx={{ color: '#EF4444', fontSize: 20 }} />;
    }
    if (['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff'].includes(ext)) {
      return <ImageOutlinedIcon sx={{ color: '#3B82F6', fontSize: 20 }} />;
    }
    return <InsertDriveFileOutlinedIcon sx={{ color: '#6B7280', fontSize: 20 }} />;
  };

  // Extract all citations from a text for display
  const extractCitationsList = (text) => {
    if (!text) return [];
    const citations = [];
    let match;
    const regex = new RegExp(CITATION_REGEX);
    while ((match = regex.exec(text)) !== null) {
      const full = match[0];
      if (!citations.includes(full)) {
        citations.push(full);
      }
    }
    return citations;
  };

  return (
    <Box sx={{ flexGrow: 1, display: 'flex', height: 'calc(100vh - 48px)', bgcolor: '#F9FAFB', overflow: 'hidden' }}>
      {/* =========================================================================
          LEFT PANEL: Documents, Upload, System Prompt & Preparation
         ========================================================================= */}
      <Box
        sx={{
          width: { xs: '100%', md: 360, lg: 400 },
          borderRight: '1px solid #E5E7EB',
          bgcolor: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
      >
        {/* Left Header */}
        <Box
          sx={{
            p: 2,
            borderBottom: '1px solid #E5E7EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#111827', fontSize: '0.9rem' }}>
              Tài liệu & Chuẩn bị
            </Typography>
            <Typography variant="caption" sx={{ color: '#6B7280' }}>
              Tối đa {MAX_FILE_COUNT} tệp (mỗi tệp ≤ 5MB)
            </Typography>
          </Box>

          <Chip
            size="small"
            label={`${docFiles.length}/${MAX_FILE_COUNT} tệp`}
            color={docFiles.length >= MAX_FILE_COUNT ? 'warning' : 'default'}
            sx={{ fontWeight: 600, fontSize: '0.75rem', height: 22 }}
          />
        </Box>

        {/* Scrollable Document & System Prompt Section */}
        <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Drag & Drop Upload Box */}
          <Paper
            variant="outlined"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            sx={{
              p: 2.5,
              borderRadius: 2,
              textAlign: 'center',
              cursor: docFiles.length >= MAX_FILE_COUNT ? 'not-allowed' : 'pointer',
              borderColor: isDragging ? '#2563EB' : '#D1D5DB',
              bgcolor: isDragging ? '#EFF6FF' : '#F9FAFB',
              borderStyle: 'dashed',
              borderWidth: 2,
              transition: 'all 150ms ease',
              '&:hover': {
                borderColor: docFiles.length >= MAX_FILE_COUNT ? '#D1D5DB' : '#2563EB',
                bgcolor: docFiles.length >= MAX_FILE_COUNT ? '#F9FAFB' : '#F8FAFC',
              },
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
              style={{ display: 'none' }}
              disabled={docFiles.length >= MAX_FILE_COUNT}
              onChange={(e) => {
                handleFilesAdded(e.target.files);
                e.target.value = '';
              }}
            />
            <CloudUploadIcon sx={{ fontSize: 32, color: isDragging ? '#2563EB' : '#9CA3AF', mb: 0.5 }} />
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#1F2937', fontSize: '0.825rem' }}>
              Kéo thả tệp hoặc bấm để tải lên
            </Typography>
            <Typography variant="caption" sx={{ color: '#6B7280', display: 'block', mt: 0.25 }}>
              Hỗ trợ PDF, PNG, JPG (tối đa 5MB/file)
            </Typography>
          </Paper>

          {/* Files List */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: '#4B5563', textTransform: 'uppercase' }}>
                Danh sách tệp ({docFiles.length})
              </Typography>
              {docFiles.length > 0 && (
                <Button
                  size="small"
                  onClick={handleClearAllFiles}
                  sx={{ textTransform: 'none', fontSize: '0.7rem', color: '#EF4444', p: 0, minWidth: 'auto' }}
                >
                  Xóa tất cả
                </Button>
              )}
            </Box>

            {docFiles.length === 0 ? (
              <Box sx={{ py: 3, textAlign: 'center', bgcolor: '#F9FAFB', borderRadius: 2, border: '1px solid #E5E7EB' }}>
                <Typography variant="caption" sx={{ color: '#9CA3AF' }}>
                  Chưa có tệp nào. Tải lên tệp để bắt đầu.
                </Typography>
              </Box>
            ) : (
              docFiles.map((doc) => (
                <Paper
                  key={doc.id}
                  variant="outlined"
                  sx={{
                    p: 1.25,
                    borderRadius: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.75,
                    borderColor: doc.status === 'ready' ? '#A7F3D0' : doc.status === 'error' ? '#FECACA' : '#E5E7EB',
                    bgcolor: doc.status === 'ready' ? '#F0FDF4' : doc.status === 'error' ? '#FEF2F2' : '#FFFFFF',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flexGrow: 1 }}>
                      {renderFileIcon(doc.name)}
                      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 600,
                            fontSize: '0.8rem',
                            color: '#111827',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {doc.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '0.7rem' }}>
                          {formatFileSize(doc.size)}
                        </Typography>
                      </Box>
                    </Box>

                    <IconButton
                      size="small"
                      onClick={() => handleRemoveFile(doc.id)}
                      sx={{ p: 0.5, color: '#9CA3AF', '&:hover': { color: '#EF4444' } }}
                    >
                      <DeleteOutlinedIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>

                  {/* Status & actions row */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 0.5 }}>
                    {/* Status Chip */}
                    {doc.status === 'idle' && (
                      <Chip
                        size="small"
                        label="Chờ Prepare"
                        sx={{ fontSize: '0.675rem', height: 20, bgcolor: '#F3F4F6', color: '#6B7280' }}
                      />
                    )}
                    {doc.status === 'preparing' && (
                      <Chip
                        size="small"
                        icon={<CircularProgress size={10} color="inherit" />}
                        label="Đang OCR..."
                        sx={{ fontSize: '0.675rem', height: 20, bgcolor: '#EFF6FF', color: '#1D4ED8' }}
                      />
                    )}
                    {doc.status === 'ready' && (
                      <Chip
                        size="small"
                        icon={<CheckCircleOutlinedIcon sx={{ fontSize: '12px !important' }} />}
                        label={`Đã sẵn sàng (${doc.pages?.length || 1} trang)`}
                        sx={{ fontSize: '0.675rem', height: 20, bgcolor: '#DCFCE7', color: '#15803D', fontWeight: 600 }}
                      />
                    )}
                    {doc.status === 'error' && (
                      <Tooltip title={doc.errorMsg || 'Lỗi OCR'}>
                        <Chip
                          size="small"
                          icon={<ErrorOutlinedIcon sx={{ fontSize: '12px !important' }} />}
                          label="Lỗi OCR"
                          sx={{ fontSize: '0.675rem', height: 20, bgcolor: '#FEE2E2', color: '#B91C1C' }}
                        />
                      </Tooltip>
                    )}

                    {/* Action buttons */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {doc.status === 'ready' && (
                        <Button
                          size="small"
                          startIcon={<VisibilityOutlinedIcon sx={{ fontSize: 13 }} />}
                          onClick={() => handleOpenPreview(doc)}
                          sx={{ textTransform: 'none', fontSize: '0.7rem', py: 0.2, px: 0.8 }}
                        >
                          Xem Markdown
                        </Button>
                      )}
                      {doc.status === 'error' && (
                        <Button
                          size="small"
                          startIcon={<RefreshIcon sx={{ fontSize: 13 }} />}
                          onClick={() => prepareSingleFile(doc)}
                          sx={{ textTransform: 'none', fontSize: '0.7rem', py: 0.2, px: 0.8 }}
                        >
                          Thử lại
                        </Button>
                      )}
                    </Box>
                  </Box>
                </Paper>
              ))
            )}
          </Box>

          {/* System Prompt Customizer (Accordion) */}
          <Accordion
            expanded={isSysPromptExpanded}
            onChange={() => setIsSysPromptExpanded(!isSysPromptExpanded)}
            variant="outlined"
            sx={{ borderRadius: '8px !important', '&:before': { display: 'none' } }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: 18 }} />} sx={{ minHeight: 40, px: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SmartToyOutlinedIcon sx={{ fontSize: 16, color: '#4B5563' }} />
                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem', color: '#1F2937' }}>
                  System Prompt (Tùy chỉnh)
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 1.5, pb: 1.5, pt: 0 }}>
              <Typography variant="caption" sx={{ color: '#6B7280', display: 'block', mb: 1 }}>
                Chỉnh sửa lời nhắc hệ thống điều khiển cách AI trả lời và tạo trích dẫn (citation).
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={6}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    bgcolor: '#F9FAFB',
                  },
                }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                <Button
                  size="small"
                  onClick={() => setSystemPrompt(DEFAULT_SYSTEM_PROMPT)}
                  sx={{ textTransform: 'none', fontSize: '0.7rem', color: '#6B7280' }}
                >
                  Khôi phục mặc định
                </Button>
              </Box>
            </AccordionDetails>
          </Accordion>
        </Box>

        {/* Prepare Action Toolbar at Bottom of Left Panel */}
        <Box sx={{ p: 2, borderTop: '1px solid #E5E7EB', bgcolor: '#FFFFFF' }}>
          <Button
            fullWidth
            variant="contained"
            disabled={docFiles.length === 0 || isPreparingAll}
            onClick={handlePrepareAll}
            startIcon={
              isPreparingAll ? <CircularProgress size={16} color="inherit" /> : <PlayCircleOutlinedIcon />
            }
            sx={{
              bgcolor: '#111827',
              color: '#FFFFFF',
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.875rem',
              py: 1,
              borderRadius: 2,
              '&:hover': { bgcolor: '#1F2937' },
              '&.Mui-disabled': { bgcolor: '#E5E7EB', color: '#9CA3AF' },
            }}
          >
            {isPreparingAll ? 'Đang Prepare OCR...' : 'Prepare (OCR ra Markdown)'}
          </Button>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1, px: 0.5 }}>
            <Typography variant="caption" sx={{ color: '#6B7280' }}>
              Trạng thái: <strong>{readyDocuments.length}/{docFiles.length}</strong> sẵn sàng
            </Typography>
            {!datalabKey && (
              <Typography
                variant="caption"
                onClick={() => onOpenSettings(0)}
                sx={{ color: '#EF4444', fontWeight: 600, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
              >
                Chưa có Datalab Key
              </Typography>
            )}
          </Box>
        </Box>
      </Box>

      {/* =========================================================================
          RIGHT PANEL: Interactive Document Chat Workspace
         ========================================================================= */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#FFFFFF' }}>
        {/* Chat Header */}
        <Box
          sx={{
            height: 48,
            borderBottom: '1px solid #E5E7EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            px: 2.5,
            bgcolor: '#FFFFFF',
          }}
        >
          {/* Right Header Controls */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {messages.length > 0 && (
              <Button
                size="small"
                onClick={handleClearChat}
                sx={{ textTransform: 'none', fontSize: '0.75rem', color: '#6B7280' }}
              >
                Xóa đoạn chat
              </Button>
            )}

            <Tooltip title="Cài đặt BaseURL, Model & API Key">
              <IconButton size="small" onClick={() => onOpenSettings(1)} sx={{ color: '#4B5563' }}>
                <SettingsOutlinedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Chat Message Scroll Area */}
        <Box sx={{ flexGrow: 1, overflowY: 'auto', p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Empty State */}
          {messages.length === 0 ? (
            <Box
              sx={{
                flexGrow: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                maxWidth: 640,
                mx: 'auto',
                textAlign: 'center',
                py: 4,
              }}
            >
              <Box
                sx={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  bgcolor: '#EEF2FF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 2,
                }}
              >
                <SmartToyOutlinedIcon sx={{ fontSize: 28, color: '#4F46E5' }} />
              </Box>

              <Typography variant="h6" sx={{ fontWeight: 700, color: '#111827', mb: 1, fontSize: '1.1rem' }}>
                Hỏi đáp tài liệu thông minh (Doc Q&A)
              </Typography>

              <Typography variant="body2" sx={{ color: '#6B7280', mb: 3, maxWidth: 480 }}>
                {readyDocuments.length > 0
                  ? `Đã nạp ${readyDocuments.length} tài liệu vào bộ nhớ AI. Hãy đặt bất kỳ câu hỏi nào về nội dung, số liệu hoặc điều khoản.`
                  : 'Hãy tải lên tối đa 5 tài liệu (PDF, hình ảnh) ở cột bên trái và bấm nút "Prepare" để OCR tài liệu trước khi bắt đầu trò chuyện.'}
              </Typography>

              {/* Starter Suggestions */}
              {readyDocuments.length > 0 && (
                <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase' }}>
                    Gợi ý câu hỏi:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
                    {[
                      'Tóm tắt các điểm chính của các tài liệu này',
                      'Liệt kê các số liệu, ngày tháng và đối tượng quan trọng',
                      'So sánh sự khác biệt giữa các tài liệu đã tải lên',
                      'Có những điều khoản hoặc rủi ro pháp lý nào cần lưu ý?',
                    ].map((promptText) => (
                      <Chip
                        key={promptText}
                        label={promptText}
                        onClick={() => handleSendMessage(promptText)}
                        sx={{
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          bgcolor: '#FFFFFF',
                          border: '1px solid #E5E7EB',
                          py: 1,
                          '&:hover': { bgcolor: '#F3F4F6', borderColor: '#D1D5DB' },
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          ) : (
            messages.map((msg) => {
              const isUser = msg.role === 'user';
              const citationsList = !isUser ? extractCitationsList(msg.content) : [];

              return (
                <Box
                  key={msg.id}
                  sx={{
                    display: 'flex',
                    flexDirection: isUser ? 'row-reverse' : 'row',
                    gap: 1.5,
                    maxWidth: { xs: '100%', md: '88%' },
                    alignSelf: isUser ? 'flex-end' : 'flex-start',
                  }}
                >
                  {/* Avatar */}
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      bgcolor: isUser ? '#111827' : '#EEF2FF',
                      color: isUser ? '#FFFFFF' : '#4F46E5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      mt: 0.5,
                    }}
                  >
                    {isUser ? <PersonOutlinedIcon sx={{ fontSize: 18 }} /> : <SmartToyOutlinedIcon sx={{ fontSize: 18 }} />}
                  </Box>

                  {/* Message Bubble */}
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 3,
                      bgcolor: isUser ? '#111827' : '#F9FAFB',
                      color: isUser ? '#FFFFFF' : '#111827',
                      border: isUser ? 'none' : '1px solid #E5E7EB',
                      position: 'relative',
                      overflowWrap: 'break-word',
                      maxWidth: '100%',
                    }}
                  >
                    {isUser ? (
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}>
                        {msg.content}
                      </Typography>
                    ) : (
                      <Box
                        sx={{
                          fontSize: '0.875rem',
                          lineHeight: 1.6,
                          '& p': { m: 0, mb: 1, '&:last-child': { mb: 0 } },
                          '& ul, & ol': { pl: 2.5, m: 0, mb: 1 },
                          '& li': { mb: 0.5 },
                          '& code': {
                            fontFamily: 'monospace',
                            bgcolor: '#EEF2FF',
                            px: 0.6,
                            py: 0.2,
                            borderRadius: '4px',
                            color: '#4338CA',
                            fontSize: '0.8rem',
                          },
                          '& pre': {
                            bgcolor: '#1E293B',
                            color: '#F8FAFC',
                            p: 1.5,
                            borderRadius: 2,
                            overflowX: 'auto',
                            fontSize: '0.8rem',
                            my: 1,
                          },
                          '& table': {
                            borderCollapse: 'collapse',
                            width: '100%',
                            my: 1,
                            fontSize: '0.8rem',
                          },
                          '& th, & td': {
                            border: '1px solid #D1D5DB',
                            p: 0.75,
                            textAlign: 'left',
                          },
                          '& th': {
                            bgcolor: '#F3F4F6',
                            fontWeight: 600,
                          },
                        }}
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>

                        {/* Streaming cursor indicator */}
                        {msg.isStreaming && (
                          <Box
                            component="span"
                            sx={{
                              display: 'inline-block',
                              width: 6,
                              height: 15,
                              bgcolor: '#4F46E5',
                              ml: 0.5,
                              verticalAlign: 'middle',
                              animation: 'blink 1s infinite',
                              '@keyframes blink': {
                                '0%, 100%': { opacity: 1 },
                                '50%': { opacity: 0 },
                              },
                            }}
                          />
                        )}

                        {/* Interactive Citations Bar */}
                        {citationsList.length > 0 && (
                          <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px dashed #D1D5DB' }}>
                            <Typography
                              variant="caption"
                              sx={{ fontWeight: 600, color: '#6B7280', display: 'block', mb: 0.75 }}
                            >
                              📌 Trích dẫn nguồn (bấm để xem trang):
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                              {citationsList.map((cite) => (
                                <Chip
                                  key={cite}
                                  label={cite}
                                  size="small"
                                  onClick={() => handleCitationClick(cite)}
                                  sx={{
                                    cursor: 'pointer',
                                    fontSize: '0.725rem',
                                    fontWeight: 600,
                                    height: 24,
                                    bgcolor: '#EFF6FF',
                                    color: '#1D4ED8',
                                    borderColor: '#BFDBFE',
                                    border: '1px solid',
                                    '&:hover': { bgcolor: '#DBEAFE' },
                                  }}
                                />
                              ))}
                            </Box>
                          </Box>
                        )}
                      </Box>
                    )}

                    {/* Copy action for assistant messages */}
                    {!isUser && msg.content && (
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                        <Tooltip title="Sao chép câu trả lời">
                          <IconButton
                            size="small"
                            onClick={() => {
                              navigator.clipboard.writeText(msg.content);
                              showNotification('Đã sao chép nội dung!');
                            }}
                            sx={{ p: 0.5, color: '#9CA3AF', '&:hover': { color: '#111827' } }}
                          >
                            <ContentCopyIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    )}
                  </Paper>
                </Box>
              );
            })
          )}
          <div ref={chatBottomRef} />
        </Box>

        {/* Input Bar */}
        <Box sx={{ p: 2, borderTop: '1px solid #E5E7EB', bgcolor: '#FFFFFF' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 1,
              bgcolor: '#F9FAFB',
              borderRadius: 3,
              border: '1px solid #E5E7EB',
              p: 1,
              '&:focus-within': { borderColor: '#111827', bgcolor: '#FFFFFF' },
            }}
          >
            <TextField
              fullWidth
              multiline
              maxRows={4}
              placeholder={
                readyDocuments.length > 0
                  ? 'Hỏi đáp về các tài liệu đã nạp (Enter để gửi, Shift+Enter xuống dòng)...'
                  : 'Vui lòng Prepare ít nhất 1 tài liệu ở cột bên trái để bắt đầu chat...'
              }
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              disabled={isGenerating}
              sx={{
                '& .MuiOutlinedInput-root': {
                  p: 0.5,
                  fontSize: '0.875rem',
                  '& fieldset': { border: 'none' },
                },
              }}
            />

            {isGenerating ? (
              <Button
                variant="contained"
                color="error"
                size="small"
                onClick={handleStopGenerating}
                startIcon={<StopCircleOutlinedIcon />}
                sx={{ textTransform: 'none', borderRadius: 2, height: 36, px: 2, fontWeight: 600 }}
              >
                Dừng
              </Button>
            ) : (
              <IconButton
                color="primary"
                disabled={!userInput.trim() || readyDocuments.length === 0}
                onClick={() => handleSendMessage()}
                sx={{
                  bgcolor: userInput.trim() && readyDocuments.length > 0 ? '#111827' : '#E5E7EB',
                  color: '#FFFFFF',
                  width: 36,
                  height: 36,
                  '&:hover': { bgcolor: '#1F2937' },
                  '&.Mui-disabled': { bgcolor: '#E5E7EB', color: '#9CA3AF' },
                }}
              >
                <SendIcon sx={{ fontSize: 16 }} />
              </IconButton>
            )}
          </Box>

          {/* Context Footer Status */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.75, px: 0.5 }}>
            <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '0.725rem' }}>
              💡 Trả lời kèm trích dẫn nguồn <code>[file, Trang X]</code>
            </Typography>
            <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '0.725rem' }}>
              Tài liệu trong ngữ cảnh: <strong>{readyDocuments.length}</strong>
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* =========================================================================
          OCR MARKDOWN PREVIEW DIALOG
         ========================================================================= */}
      <Dialog
        open={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        maxWidth="md"
        fullWidth
        scroll="paper"
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {previewDoc && renderFileIcon(previewDoc.name)}
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {previewDoc?.name} (Nội dung OCR Markdown)
            </Typography>
          </Box>
          <Chip
            size="small"
            label={`${previewDoc?.pages?.length || 1} trang`}
            sx={{ fontWeight: 600, fontSize: '0.75rem' }}
          />
        </DialogTitle>

        <Divider />

        {/* Page selector bar if multiple pages */}
        {previewDoc?.pages && previewDoc.pages.length > 1 && (
          <Box sx={{ px: 3, pt: 1.5, pb: 0.5, display: 'flex', flexWrap: 'wrap', gap: 0.75, bgcolor: '#F9FAFB' }}>
            <Typography variant="caption" sx={{ alignSelf: 'center', fontWeight: 600, mr: 0.5, color: '#4B5563' }}>
              Trang:
            </Typography>
            {previewDoc.pages.map((p) => (
              <Button
                key={p.pageNumber}
                size="small"
                variant={previewPageTab === p.pageNumber ? 'contained' : 'outlined'}
                onClick={() => setPreviewPageTab(p.pageNumber)}
                sx={{
                  minWidth: 32,
                  height: 28,
                  fontSize: '0.75rem',
                  p: 0,
                  bgcolor: previewPageTab === p.pageNumber ? '#111827' : 'transparent',
                  color: previewPageTab === p.pageNumber ? '#FFFFFF' : '#374151',
                  borderColor: '#D1D5DB',
                }}
              >
                {p.pageNumber}
              </Button>
            ))}
          </Box>
        )}

        <DialogContent sx={{ p: 3, bgcolor: '#FFFFFF' }}>
          <Box
            sx={{
              p: 2,
              bgcolor: '#F9FAFB',
              borderRadius: 2,
              border: '1px solid #E5E7EB',
              fontFamily: 'monospace',
              fontSize: '0.825rem',
              whiteSpace: 'pre-wrap',
              maxHeight: 480,
              overflowY: 'auto',
            }}
          >
            {(() => {
              if (!previewDoc) return null;
              if (previewDoc.pages && previewDoc.pages.length > 0) {
                const currentPageObj =
                  previewDoc.pages.find((p) => p.pageNumber === previewPageTab) || previewDoc.pages[0];
                return currentPageObj?.markdown || '(Trang này không có văn bản)';
              }
              return previewDoc.markdown || '(Không có nội dung)';
            })()}
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            size="small"
            startIcon={<ContentCopyIcon sx={{ fontSize: 14 }} />}
            onClick={() => {
              if (previewDoc) {
                navigator.clipboard.writeText(previewDoc.markdown);
                showNotification('Đã sao chép toàn bộ Markdown!');
              }
            }}
            sx={{ textTransform: 'none', color: '#4B5563' }}
          >
            Copy toàn bộ Markdown
          </Button>
          <Button
            variant="contained"
            onClick={() => setPreviewDoc(null)}
            sx={{ bgcolor: '#111827', textTransform: 'none' }}
          >
            Đóng
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
