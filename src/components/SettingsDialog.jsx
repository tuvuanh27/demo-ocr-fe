import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Box,
  Typography,
  TextField,
  Button,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  InputAdornment,
  IconButton,
  Alert,
  Divider,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import KeyIcon from '@mui/icons-material/Key';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import { LLM_PRESETS } from '../services/llmApi';
import { ENV_CONFIG } from '../utils/envConfig';

function SettingsDialogContent({
  onClose,
  datalabKey,
  onSaveDatalabKey,
  llmConfig,
  onSaveLlmConfig,
  initialTab = 0,
}) {
  const [tabIndex, setTabIndex] = useState(initialTab);

  // Datalab OCR state
  const [tempDatalabKey, setTempDatalabKey] = useState(datalabKey || '');
  const [showDatalabKey, setShowDatalabKey] = useState(false);

  // LLM State
  const [preset, setPreset] = useState(llmConfig?.preset || 'openai');
  const [baseURL, setBaseURL] = useState(llmConfig?.baseURL || 'https://api.openai.com/v1');
  const [llmApiKey, setLlmApiKey] = useState(llmConfig?.apiKey || '');
  const [model, setModel] = useState(llmConfig?.model || 'gpt-4o-mini');
  const [showLlmKey, setShowLlmKey] = useState(false);

  const handlePresetChange = (newPresetId) => {
    setPreset(newPresetId);
    const found = LLM_PRESETS.find((p) => p.id === newPresetId);
    if (found && found.id !== 'custom') {
      setBaseURL(found.baseURL);
      setModel(found.defaultModel);
    }
  };

  const handleSave = () => {
    // Save Datalab Key
    onSaveDatalabKey(tempDatalabKey.trim());

    // Save LLM Config
    onSaveLlmConfig({
      preset,
      baseURL: baseURL.trim(),
      apiKey: llmApiKey.trim(),
      model: model.trim(),
    });

    onClose();
  };

  const currentPresetObj = LLM_PRESETS.find((p) => p.id === preset);

  return (
    <>
      <DialogTitle sx={{ fontSize: '1.1rem', fontWeight: 600, pb: 1 }}>
        Cài đặt hệ thống
      </DialogTitle>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}>
        <Tabs value={tabIndex} onChange={(_, val) => setTabIndex(val)}>
          <Tab
            icon={<KeyIcon sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label="OCR Datalab API"
            sx={{ textTransform: 'none', fontSize: '0.875rem', minHeight: 44 }}
          />
          <Tab
            icon={<SmartToyOutlinedIcon sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label="AI / LLM Chat"
            sx={{ textTransform: 'none', fontSize: '0.875rem', minHeight: 44 }}
          />
        </Tabs>
      </Box>

      <DialogContent sx={{ pt: 2.5, pb: 2 }}>
        {tabIndex === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Alert severity="info" sx={{ fontSize: '0.8rem' }}>
              Datalab API được dùng để nhận diện ký tự (OCR) và chuyển đổi tài liệu (PDF, hình ảnh) sang định dạng Markdown phân trang.
            </Alert>

            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                Datalab API Key
              </Typography>
              <TextField
                fullWidth
                size="small"
                type={showDatalabKey ? 'text' : 'password'}
                placeholder="Nhập secret Datalab API Key"
                value={tempDatalabKey}
                onChange={(e) => setTempDatalabKey(e.target.value)}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={() => setShowDatalabKey(!showDatalabKey)}
                          edge="end"
                        >
                          {showDatalabKey ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
                helperText={
                  ENV_CONFIG.datalabApiKey
                    ? '⚡ Đang lấy giá trị từ file .env. Bạn có thể thay đổi để ghi đè tạm thời.'
                    : 'Khóa API được lưu cục bộ trong trình duyệt của bạn (localStorage).'
                }
              />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Chưa có tài khoản?
              </Typography>
              <Button
                component="a"
                href="https://www.datalab.to"
                target="_blank"
                rel="noopener noreferrer"
                size="small"
                endIcon={<OpenInNewIcon sx={{ fontSize: 12 }} />}
                sx={{ textTransform: 'none', fontSize: '0.75rem', p: 0, minWidth: 'auto' }}
              >
                Đăng ký Datalab.to
              </Button>
            </Box>
          </Box>
        )}

        {tabIndex === 1 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Alert severity="info" sx={{ fontSize: '0.8rem' }}>
              Hỗ trợ tất cả các nhà cung cấp AI tương thích định dạng OpenAI Chat Completions (OpenAI, OpenRouter, Groq, Ollama, DeepSeek, v.v.).
            </Alert>

            {/* Provider Preset */}
            <FormControl fullWidth size="small">
              <InputLabel id="preset-select-label">Nhà cung cấp (Preset)</InputLabel>
              <Select
                labelId="preset-select-label"
                value={preset}
                label="Nhà cung cấp (Preset)"
                onChange={(e) => handlePresetChange(e.target.value)}
              >
                {LLM_PRESETS.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {currentPresetObj?.helperText && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: -1.5 }}>
                💡 {currentPresetObj.helperText}
              </Typography>
            )}

            <Divider />

            {/* Base URL */}
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                Base URL
              </Typography>
              <TextField
                fullWidth
                size="small"
                placeholder="https://api.openai.com/v1"
                value={baseURL}
                onChange={(e) => setBaseURL(e.target.value)}
                helperText="Endpoint API Chat Completions (hệ thống sẽ tự động gọi tới /chat/completions)"
              />
            </Box>

            {/* API Key */}
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                LLM API Key
              </Typography>
              <TextField
                fullWidth
                size="small"
                type={showLlmKey ? 'text' : 'password'}
                placeholder="sk-..."
                value={llmApiKey}
                onChange={(e) => setLlmApiKey(e.target.value)}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={() => setShowLlmKey(!showLlmKey)}
                          edge="end"
                        >
                          {showLlmKey ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
                helperText={
                  ENV_CONFIG.llmApiKey
                    ? '⚡ Đang lấy giá trị từ file .env. Bạn có thể thay đổi để ghi đè.'
                    : preset === 'ollama'
                    ? 'Với Ollama local, bạn có thể để trống trường này'
                    : 'Khóa API dùng để xác thực với nhà cung cấp mô hình AI'
                }
              />
            </Box>

            {/* Model Name */}
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                Model
              </Typography>
              <TextField
                fullWidth
                size="small"
                placeholder="gpt-4o-mini"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                helperText="Tên định danh của mô hình AI (VD: gpt-4o-mini, gpt-4o, claude-3-5-sonnet, llama-3.3-70b-versatile, ...)"
              />

              {/* Suggested models chips */}
              {currentPresetObj?.models?.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                  <Typography variant="caption" sx={{ alignSelf: 'center', color: 'text.secondary', mr: 0.5 }}>
                    Gợi ý:
                  </Typography>
                  {currentPresetObj.models.map((m) => (
                    <Button
                      key={m}
                      variant="outlined"
                      size="small"
                      onClick={() => setModel(m)}
                      sx={{
                        fontSize: '0.7rem',
                        py: 0.2,
                        px: 0.8,
                        minWidth: 'auto',
                        textTransform: 'none',
                        bgcolor: model === m ? '#F3F4F6' : 'transparent',
                        borderColor: model === m ? '#111827' : '#E5E7EB',
                        color: model === m ? '#111827' : '#4B5563',
                      }}
                    >
                      {m}
                    </Button>
                  ))}
                </Box>
              )}
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none', color: '#6B7280' }}>
          Hủy
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          sx={{
            bgcolor: '#111827',
            textTransform: 'none',
            fontWeight: 600,
            '&:hover': { bgcolor: '#1F2937' },
          }}
        >
          Lưu cài đặt
        </Button>
      </DialogActions>
    </>
  );
}

export default function SettingsDialog({
  open,
  onClose,
  datalabKey,
  onSaveDatalabKey,
  llmConfig,
  onSaveLlmConfig,
  initialTab = 0,
}) {
  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <SettingsDialogContent
        onClose={onClose}
        datalabKey={datalabKey}
        onSaveDatalabKey={onSaveDatalabKey}
        llmConfig={llmConfig}
        onSaveLlmConfig={onSaveLlmConfig}
        initialTab={initialTab}
      />
    </Dialog>
  );
}
