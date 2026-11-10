import { configDefaults, defineConfig } from 'vitest/config'

// 单元测试独立配置，不启动 Vite 的本机配音 API 插件。
export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'tests/unit/**/*.test.ts',
      'src/engine/*.test.ts',
    ],
    exclude: [...configDefaults.exclude, '**/._*'],
  },
})
