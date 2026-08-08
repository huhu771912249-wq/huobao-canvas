import vue from 'eslint-plugin-vue'
import globals from 'globals'

export default [
  { ignores: ['dist/**', 'node_modules/**', 'public/**'] },
  ...vue.configs['flat/essential'],
  {
    files: ['**/*.{js,mjs,vue}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node }
    },
    rules: {
      'no-debugger': 'error',
      'no-dupe-keys': 'error',
      'no-unreachable': 'error',
      'valid-typeof': 'error',
      'no-unused-vars': 'off',
      'no-undef': 'off',
      'no-control-regex': 'off',
      'no-useless-escape': 'off',
      'vue/multi-word-component-names': 'off'
    }
  }
]
