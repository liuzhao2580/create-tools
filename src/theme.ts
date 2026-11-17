import type { ThemeConfig } from 'antd'

/** Shared by all editors, including portal-mounted menus and dialogs. */
export const studioTheme: ThemeConfig = {
  token: {
    colorPrimary: '#7c3aed', colorInfo: '#7c3aed',
    colorText: '#302a3b', colorTextSecondary: '#71677e',
    colorBorder: '#e3dcea', colorBorderSecondary: '#eee8f4',
    colorBgLayout: '#f8f6fc', colorBgContainer: '#ffffff',
    colorFillAlter: '#f7f3fc', colorFillSecondary: '#f0e9f8',
    borderRadius: 8, fontSize: 16, fontSizeSM: 14, fontSizeLG: 18,
    controlHeight: 42, controlHeightSM: 34, controlHeightLG: 48,
    fontFamily: 'StudioPingFang, "PingFang SC", sans-serif',
  },
  components: {
    Card: { headerFontSize: 18 },
    Modal: { titleFontSize: 22 },
    Segmented: { itemSelectedBg: '#ece0fb', itemSelectedColor: '#6d28d9' },
    Slider: { trackBg: '#a875ef', trackHoverBg: '#7c3aed', handleColor: '#a875ef' },
  },
}
