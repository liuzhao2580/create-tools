import type { ThemeConfig } from 'antd'

/** Shared by all editors, including portal-mounted menus and dialogs. */
export const studioTheme: ThemeConfig = {
  token: {
    colorPrimary: '#0077b6', colorInfo: '#0077b6',
    colorText: '#2a353b', colorTextSecondary: '#67767e',
    colorBorder: '#dce5ea', colorBorderSecondary: '#e8f0f4',
    colorBgLayout: '#f6fafc', colorBgContainer: '#ffffff',
    colorFillAlter: '#f3f9fc', colorFillSecondary: '#e9f3f8',
    borderRadius: 8, fontSize: 16, fontSizeSM: 14, fontSizeLG: 18,
    controlHeight: 42, controlHeightSM: 34, controlHeightLG: 48,
    fontFamily: 'StudioPingFang, "PingFang SC", sans-serif',
  },
  components: {
    Card: { headerFontSize: 18 },
    Modal: { titleFontSize: 22 },
    Segmented: { itemSelectedBg: '#e0f2fe', itemSelectedColor: '#0369a1' },
    Slider: { trackBg: '#38bdf8', trackHoverBg: '#0077b6', handleColor: '#38bdf8' },
  },
}
