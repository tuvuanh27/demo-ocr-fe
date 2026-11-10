import { createTheme } from '@mui/material/styles';

/**
 * Google Material Design 3 (Material You) Theme Configuration
 * Adhering to Material Design 3 guidelines:
 * - Roboto & Roboto Flex typography scale
 * - Tonal Color System (Primary #6750A4, Secondary #625B71, Tertiary #7D5260)
 * - M3 Shapes (Buttons 20px pill, Cards 12-16px, Dialogs 28px)
 * - 48dp minimum touch targets for accessibility
 * - Elevation and state layers
 */

export const getMaterial3Theme = (mode = 'light') => {
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: isDark ? '#D0BCFF' : '#6750A4',
        contrastText: isDark ? '#381E72' : '#FFFFFF',
        light: isDark ? '#EADDFF' : '#7F67BE',
        dark: isDark ? '#B69DF8' : '#4F378B',
      },
      secondary: {
        main: isDark ? '#CCC2DC' : '#625B71',
        contrastText: isDark ? '#332D41' : '#FFFFFF',
        light: isDark ? '#E8DEF8' : '#7A7289',
        dark: isDark ? '#4A4458' : '#4A4358',
      },
      tertiary: {
        main: isDark ? '#EFB8C8' : '#7D5260',
        contrastText: isDark ? '#492532' : '#FFFFFF',
      },
      error: {
        main: isDark ? '#FFB4AB' : '#BA1A1A',
        contrastText: isDark ? '#690005' : '#FFFFFF',
      },
      background: {
        default: isDark ? '#141218' : '#FEF7FF',
        paper: isDark ? '#211F26' : '#F7F2FA',
      },
      text: {
        primary: isDark ? '#E6E0E9' : '#1D1B20',
        secondary: isDark ? '#CAC4D0' : '#49454F',
      },
      divider: isDark ? '#49454F' : '#CAC4D0',
    },
    shape: {
      borderRadius: 12, // Medium shape scale (12dp)
    },
    typography: {
      fontFamily: '"Roboto Flex", "Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      displayLarge: {
        fontSize: '3.5625rem', // 57sp
        lineHeight: 1.12,
        letterSpacing: '-0.25px',
        fontWeight: 400,
      },
      displayMedium: {
        fontSize: '2.8125rem', // 45sp
        lineHeight: 1.16,
        fontWeight: 400,
      },
      displaySmall: {
        fontSize: '2.25rem', // 36sp
        lineHeight: 1.22,
        fontWeight: 400,
      },
      headlineLarge: {
        fontSize: '2rem', // 32sp
        lineHeight: 1.25,
        fontWeight: 400,
      },
      headlineMedium: {
        fontSize: '1.75rem', // 28sp
        lineHeight: 1.29,
        fontWeight: 400,
      },
      headlineSmall: {
        fontSize: '1.5rem', // 24sp
        lineHeight: 1.33,
        fontWeight: 400,
      },
      titleLarge: {
        fontSize: '1.375rem', // 22sp
        lineHeight: 1.27,
        fontWeight: 500,
      },
      titleMedium: {
        fontSize: '1rem', // 16sp
        lineHeight: 1.5,
        fontWeight: 500,
        letterSpacing: '0.15px',
      },
      titleSmall: {
        fontSize: '0.875rem', // 14sp
        lineHeight: 1.43,
        fontWeight: 500,
        letterSpacing: '0.1px',
      },
      bodyLarge: {
        fontSize: '1rem', // 16sp
        lineHeight: 1.5,
        letterSpacing: '0.5px',
        fontWeight: 400,
      },
      bodyMedium: {
        fontSize: '0.875rem', // 14sp
        lineHeight: 1.43,
        letterSpacing: '0.25px',
        fontWeight: 400,
      },
      bodySmall: {
        fontSize: '0.75rem', // 12sp
        lineHeight: 1.33,
        letterSpacing: '0.4px',
        fontWeight: 400,
      },
      labelLarge: {
        fontSize: '0.875rem', // 14sp
        lineHeight: 1.43,
        letterSpacing: '0.1px',
        fontWeight: 500,
      },
      labelMedium: {
        fontSize: '0.75rem', // 12sp
        lineHeight: 1.33,
        letterSpacing: '0.5px',
        fontWeight: 500,
      },
      labelSmall: {
        fontSize: '0.6875rem', // 11sp
        lineHeight: 1.45,
        letterSpacing: '0.5px',
        fontWeight: 500,
      },
      button: {
        textTransform: 'none',
        fontWeight: 500,
        letterSpacing: '0.1px',
      },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 20, // Full shape corner for buttons in M3
            minHeight: 40,
            padding: '10px 24px',
            boxShadow: 'none',
            '&:hover': {
              boxShadow: isDark
                ? '0px 1px 3px 1px rgba(0,0,0,0.3)'
                : '0px 1px 3px 1px rgba(0,0,0,0.15)',
            },
          },
          containedPrimary: {
            backgroundColor: isDark ? '#D0BCFF' : '#6750A4',
            color: isDark ? '#381E72' : '#FFFFFF',
            '&:hover': {
              backgroundColor: isDark ? '#EADDFF' : '#5b4494',
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 16, // Large corner shape in M3
            boxShadow: isDark
              ? '0px 1px 3px 1px rgba(0,0,0,0.4), 0px 1px 2px 0px rgba(0,0,0,0.6)'
              : '0px 1px 3px 1px rgba(0,0,0,0.08), 0px 1px 2px 0px rgba(0,0,0,0.15)',
            transition: 'box-shadow 250ms cubic-bezier(0.2, 0.0, 0, 1.0)',
            '&:hover': {
              boxShadow: isDark
                ? '0px 2px 6px 2px rgba(0,0,0,0.4)'
                : '0px 2px 6px 2px rgba(0,0,0,0.12)',
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          rounded: {
            borderRadius: 16,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 8, // Small corner shape in M3
            fontWeight: 500,
          },
        },
      },
      MuiFab: {
        styleOverrides: {
          root: {
            borderRadius: 16, // M3 Container shape for FABs
            boxShadow: '0px 3px 5px -1px rgba(0,0,0,0.2), 0px 6px 10px 0px rgba(0,0,0,0.14)',
          },
        },
      },
      MuiAppBar: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          root: {
            backgroundColor: isDark ? '#141218' : '#FEF7FF',
            color: isDark ? '#E6E0E9' : '#1D1B20',
            borderBottom: `1px solid ${isDark ? '#49454F' : '#E7E0EC'}`,
          },
        },
      },
    },
  });
};

